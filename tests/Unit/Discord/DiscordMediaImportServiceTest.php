<?php

namespace Tests\Unit\Discord;

use App\Jobs\ImportDiscordMediaAttachment;
use App\Models\DiscordSyncRun;
use App\Models\GalleryMedia;
use App\Services\Discord\DiscordApiService;
use App\Services\Discord\DiscordMediaImportService;
use App\Services\Gallery\GalleryMediaStorageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class DiscordMediaImportServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_incremental_sync_queues_new_media_and_stops_at_stored_media(): void
    {
        Queue::fake();
        Storage::fake('public');
        config([
            'gallery.discord.message_page_limit' => 2,
            'gallery.discord.vault_category_id' => 'vault-category',
            'gallery.media_disk' => 'public',
        ]);

        $storedPath = 'gallery/media/old/image.jpg';
        Storage::disk('public')->put($storedPath, 'stored-bytes');

        $storedMedia = GalleryMedia::factory()->create([
            'source_attachment_id' => 'old-attachment',
            'source_channel_id' => 'channel-1',
            'source_message_id' => 'old-message',
            'media_path' => $storedPath,
        ]);

        $discord = Mockery::mock(DiscordApiService::class);
        $discord->shouldReceive('guildChannels')
            ->once()
            ->andReturn($this->channels());
        $discord->shouldReceive('channelMessages')
            ->once()
            ->with('channel-1', null)
            ->andReturn([
                $this->message('new-message', 'new-attachment', 'new.jpg'),
                $this->message('old-message', 'old-attachment', 'old.jpg'),
            ]);

        $run = DiscordSyncRun::create(['status' => 'queued']);

        $this->service($discord)->sync($run, incremental: true);

        $this->assertDatabaseHas('gallery_media', [
            'source_attachment_id' => 'new-attachment',
            'source_message_id' => 'new-message',
        ]);
        $this->assertDatabaseHas('discord_sync_items', [
            'gallery_media_id' => $storedMedia->id,
            'source_attachment_id' => 'old-attachment',
            'status' => 'skipped',
            'action' => 'stored',
        ]);
        Queue::assertPushed(ImportDiscordMediaAttachment::class, 1);
        Queue::assertPushed(
            ImportDiscordMediaAttachment::class,
            fn (ImportDiscordMediaAttachment $job): bool => $job->media->source_attachment_id === 'new-attachment',
        );
        Queue::assertNotPushed(
            ImportDiscordMediaAttachment::class,
            fn (ImportDiscordMediaAttachment $job): bool => $job->media->source_attachment_id === 'old-attachment',
        );
    }

    public function test_existing_missing_media_is_refreshed_and_queued(): void
    {
        Queue::fake();
        Storage::fake('public');
        config([
            'gallery.discord.message_page_limit' => 1,
            'gallery.discord.vault_category_id' => 'vault-category',
            'gallery.media_disk' => 'public',
        ]);

        GalleryMedia::factory()->create([
            'source_attachment_id' => 'missing-attachment',
            'source_channel_id' => 'channel-1',
            'source_message_id' => 'missing-message',
            'media_path' => 'gallery/media/missing/image.jpg',
        ]);

        $discord = Mockery::mock(DiscordApiService::class);
        $discord->shouldReceive('guildChannels')
            ->once()
            ->andReturn($this->channels());
        $discord->shouldReceive('channelMessages')
            ->once()
            ->with('channel-1', null)
            ->andReturn([
                $this->message('missing-message', 'missing-attachment', 'missing.jpg'),
            ]);
        $discord->shouldReceive('channelMessages')
            ->once()
            ->with('channel-1', 'missing-message')
            ->andReturn([]);

        $run = DiscordSyncRun::create(['status' => 'queued']);

        $this->service($discord)->sync($run, incremental: true);

        Queue::assertPushed(
            ImportDiscordMediaAttachment::class,
            fn (ImportDiscordMediaAttachment $job): bool => $job->media->source_attachment_id === 'missing-attachment',
        );
        $this->assertDatabaseHas('discord_sync_items', [
            'source_attachment_id' => 'missing-attachment',
            'status' => 'queued',
            'action' => 'updated',
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function channels(): array
    {
        return [
            ['id' => 'vault-category', 'name' => 'VAULT', 'type' => 4],
            ['id' => 'channel-1', 'name' => 'aura', 'parent_id' => 'vault-category', 'type' => 0],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function message(string $messageId, string $attachmentId, string $filename): array
    {
        return [
            'id' => $messageId,
            'content' => 'aura',
            'timestamp' => now()->toISOString(),
            'author' => [
                'id' => "author-{$messageId}",
                'username' => 'creator',
            ],
            'attachments' => [
                [
                    'id' => $attachmentId,
                    'filename' => $filename,
                    'url' => "https://cdn.discordapp.test/{$filename}",
                    'proxy_url' => "https://media.discordapp.test/{$filename}",
                    'content_type' => 'image/jpeg',
                    'width' => 100,
                    'height' => 100,
                    'size' => 1024,
                ],
            ],
        ];
    }

    private function service(DiscordApiService $discord): DiscordMediaImportService
    {
        return new DiscordMediaImportService(
            $discord,
            app(GalleryMediaStorageService::class),
        );
    }
}
