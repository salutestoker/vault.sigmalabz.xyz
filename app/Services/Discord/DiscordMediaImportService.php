<?php

namespace App\Services\Discord;

use App\Enums\GalleryMediaStatus;
use App\Enums\GalleryMediaType;
use App\Jobs\ImportDiscordMediaAttachment;
use App\Models\Creator;
use App\Models\DiscordSyncRun;
use App\Models\GalleryCategory;
use App\Models\GalleryMedia;
use App\Services\Gallery\GalleryMediaStorageService;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Throwable;

class DiscordMediaImportService
{
    public function __construct(
        private readonly DiscordApiService $discord,
        private readonly GalleryMediaStorageService $storage,
    ) {}

    public function sync(DiscordSyncRun $run, bool $incremental = false): void
    {
        $run->update([
            'status' => 'running',
            'started_at' => now(),
            'metadata' => array_merge($run->metadata ?? [], [
                'incremental' => $incremental,
            ]),
        ]);

        try {
            $channels = collect($this->discord->guildChannels());
            $categoryId = $this->resolveVaultCategoryId($channels);
            $mediaChannels = $channels
                ->filter(fn (array $channel) => ($channel['parent_id'] ?? null) === $categoryId)
                ->values();

            $run->increment('channels_scanned', $mediaChannels->count());

            foreach ($mediaChannels as $channel) {
                $this->syncChannel($run, $channel, $incremental);
            }

            $run->update([
                'status' => 'completed',
                'finished_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $run->update([
                'status' => 'failed',
                'finished_at' => now(),
                'error_message' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }

    /**
     * @param  array<int, array<string, mixed>>|Collection<int, array<string, mixed>>  $channels
     */
    private function resolveVaultCategoryId(iterable $channels): string
    {
        $configuredId = config('gallery.discord.vault_category_id');

        if ($configuredId) {
            return (string) $configuredId;
        }

        $categoryName = Str::lower((string) config('gallery.discord.vault_category_name', 'VAULT'));

        foreach ($channels as $channel) {
            if ((int) ($channel['type'] ?? -1) === 4 && Str::lower((string) ($channel['name'] ?? '')) === $categoryName) {
                return (string) $channel['id'];
            }
        }

        throw new \RuntimeException('Unable to find Discord VAULT category.');
    }

    /**
     * @param  array<string, mixed>  $channel
     */
    private function syncChannel(DiscordSyncRun $run, array $channel, bool $incremental): void
    {
        $before = null;

        do {
            $messages = $this->discord->channelMessages((string) $channel['id'], $before);
            $run->increment('messages_scanned', count($messages));

            foreach ($messages as $message) {
                if ($this->syncMessage($run, $channel, $message, $incremental)) {
                    return;
                }
            }

            $before = Arr::last($messages)['id'] ?? null;
        } while (count($messages) === (int) config('gallery.discord.message_page_limit'));
    }

    /**
     * @param  array<string, mixed>  $channel
     * @param  array<string, mixed>  $message
     */
    private function syncMessage(DiscordSyncRun $run, array $channel, array $message, bool $incremental): bool
    {
        $supportedAttachments = [];

        foreach (($message['attachments'] ?? []) as $attachment) {
            if (! $this->isSupportedAttachment($attachment)) {
                $run->increment('media_skipped');

                continue;
            }

            $supportedAttachments[] = $attachment;
        }

        if ($supportedAttachments === []) {
            return false;
        }

        $storedBoundary = $incremental && collect($supportedAttachments)
            ->every(function (array $attachment): bool {
                $media = $this->existingMediaForAttachment($attachment);

                return $media !== null && $this->storage->hasStoredMedia($media);
            });

        foreach ($supportedAttachments as $attachment) {
            $existingMedia = $this->existingMediaForAttachment($attachment);

            if ($existingMedia && $this->storage->hasStoredMedia($existingMedia)) {
                $this->createSyncItem($run, $existingMedia, $attachment, 'skipped', 'stored');
                $run->increment('media_skipped');

                continue;
            }

            $media = $this->upsertMedia($channel, $message, $attachment);

            $this->createSyncItem(
                $run,
                $media,
                $attachment,
                'queued',
                $media->wasRecentlyCreated ? 'created' : 'updated',
            );

            $run->increment($media->wasRecentlyCreated ? 'media_imported' : 'media_skipped');
            ImportDiscordMediaAttachment::dispatch($media)->afterCommit();
        }

        return $storedBoundary;
    }

    /**
     * @param  array<string, mixed>  $attachment
     */
    private function existingMediaForAttachment(array $attachment): ?GalleryMedia
    {
        return GalleryMedia::query()
            ->where('source_provider', 'discord')
            ->where('source_attachment_id', (string) $attachment['id'])
            ->first();
    }

    /**
     * @param  array<string, mixed>  $attachment
     */
    private function createSyncItem(
        DiscordSyncRun $run,
        GalleryMedia $media,
        array $attachment,
        string $status,
        string $action,
    ): void {
        $run->items()->create([
            'gallery_media_id' => $media->id,
            'source_channel_id' => $media->source_channel_id,
            'source_message_id' => $media->source_message_id,
            'source_attachment_id' => $media->source_attachment_id,
            'status' => $status,
            'action' => $action,
            'metadata' => [
                'filename' => $attachment['filename'] ?? null,
                'content_type' => $attachment['content_type'] ?? null,
            ],
        ]);
    }

    /**
     * @param  array<string, mixed>  $attachment
     */
    private function isSupportedAttachment(array $attachment): bool
    {
        $contentType = Str::lower((string) ($attachment['content_type'] ?? ''));
        $filename = Str::lower((string) ($attachment['filename'] ?? ''));

        return Str::startsWith($contentType, ['image/', 'video/'])
            || preg_match('/\.(avif|gif|jpe?g|png|webp|mp4|mov|m4v|webm)$/', $filename) === 1;
    }

    /**
     * @param  array<string, mixed>  $channel
     * @param  array<string, mixed>  $message
     * @param  array<string, mixed>  $attachment
     */
    private function upsertMedia(array $channel, array $message, array $attachment): GalleryMedia
    {
        $author = $message['author'] ?? [];
        $type = $this->mediaType($attachment);
        $category = $this->categoryFor($type, $channel, $message, $attachment);
        $creator = $this->creatorFor($author);
        $guildId = config('gallery.discord.guild_id');
        $messageId = (string) ($message['id'] ?? '');
        $channelId = (string) ($channel['id'] ?? '');

        return GalleryMedia::updateOrCreate(
            [
                'source_provider' => 'discord',
                'source_attachment_id' => (string) $attachment['id'],
            ],
            [
                'creator_id' => $creator?->id,
                'gallery_category_id' => $category?->id,
                'type' => $type,
                'status' => GalleryMediaStatus::Imported,
                'source_guild_id' => $guildId,
                'source_channel_id' => $channelId,
                'source_channel_name' => $channel['name'] ?? null,
                'source_message_id' => $messageId,
                'source_author_id' => $author['id'] ?? null,
                'source_author_username' => $author['username'] ?? null,
                'source_message_url' => "https://discord.com/channels/{$guildId}/{$channelId}/{$messageId}",
                'original_url' => $attachment['url'] ?? null,
                'preview_url' => $attachment['proxy_url'] ?? ($attachment['url'] ?? null),
                'mime_type' => $attachment['content_type'] ?? null,
                'filename' => $attachment['filename'] ?? null,
                'width' => $attachment['width'] ?? null,
                'height' => $attachment['height'] ?? null,
                'duration_seconds' => $attachment['duration_secs'] ?? null,
                'file_size' => $attachment['size'] ?? null,
                'source_created_at' => $message['timestamp'] ?? null,
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $attachment
     */
    private function mediaType(array $attachment): string
    {
        $contentType = Str::lower((string) ($attachment['content_type'] ?? ''));

        if (Str::startsWith($contentType, 'video/')) {
            return GalleryMediaType::Video->value;
        }

        $filename = Str::lower((string) ($attachment['filename'] ?? ''));

        return preg_match('/\.(mp4|mov|m4v|webm)$/', $filename) === 1
            ? GalleryMediaType::Video->value
            : GalleryMediaType::Image->value;
    }

    /**
     * @param  array<string, mixed>  $author
     */
    private function creatorFor(array $author): ?Creator
    {
        $discordId = $author['id'] ?? null;

        if (! $discordId) {
            return null;
        }

        return Creator::updateOrCreate(
            ['discord_id' => (string) $discordId],
            [
                'display_name' => $author['global_name'] ?? $author['username'] ?? 'Discord Creator',
                'discord_username' => $author['username'] ?? null,
                'avatar_url' => $this->avatarUrl($author),
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $author
     */
    private function avatarUrl(array $author): ?string
    {
        if (! isset($author['id'], $author['avatar'])) {
            return null;
        }

        return "https://cdn.discordapp.com/avatars/{$author['id']}/{$author['avatar']}.png";
    }

    /**
     * @param  array<string, mixed>  $channel
     * @param  array<string, mixed>  $message
     * @param  array<string, mixed>  $attachment
     */
    private function categoryFor(string $type, array $channel, array $message, array $attachment): ?GalleryCategory
    {
        if ($type === GalleryMediaType::Video->value) {
            return GalleryCategory::where('slug', 'videos')->first();
        }

        $haystack = Str::lower(implode(' ', [
            $channel['name'] ?? '',
            $message['content'] ?? '',
            $attachment['filename'] ?? '',
        ]));

        foreach (GalleryCategory::where('is_active', true)->get(['id', 'slug', 'name']) as $category) {
            if (Str::contains($haystack, [$category->slug, Str::lower($category->name)])) {
                return $category;
            }
        }

        return null;
    }
}
