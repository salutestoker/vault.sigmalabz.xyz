<?php

namespace App\Jobs;

use App\Enums\GalleryMediaStatus;
use App\Models\GalleryCategory;
use App\Models\GalleryMedia;
use App\Services\OpenAI\OpenAIMediaMetadataService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Arr;
use Throwable;

class AnalyzeGalleryMedia implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 180;

    public array $backoff = [120, 300];

    public function __construct(
        public GalleryMedia $media,
    ) {}

    public function handle(OpenAIMediaMetadataService $metadata): void
    {
        $media = $this->media->fresh();
        $result = $metadata->analyze($media);

        if (! $result) {
            $media->update([
                'status' => GalleryMediaStatus::Ready,
                'indexed_at' => now(),
            ]);

            return;
        }

        $category = GalleryCategory::where('slug', $result['category_slug'] ?? null)->first();
        $tags = collect([
            ...Arr::wrap($result['tags'] ?? []),
            ...Arr::wrap($result['detected_objects'] ?? []),
            ...Arr::wrap($result['scenes'] ?? []),
            ...Arr::wrap($result['dominant_keywords'] ?? []),
        ])
            ->map(fn ($tag) => str($tag)->lower()->squish()->toString())
            ->filter()
            ->unique()
            ->take(30)
            ->values();

        $media->update([
            'gallery_category_id' => $media->gallery_category_id ?: $category?->id,
            'ai_title' => $result['title'] ?? null,
            'ai_description' => $result['description'] ?? null,
            'ai_search_text' => implode(' ', [
                $result['title'] ?? '',
                $result['description'] ?? '',
                $tags->implode(' '),
            ]),
            'ai_metadata' => $result,
            'status' => GalleryMediaStatus::Ready,
            'indexed_at' => now(),
        ]);

        foreach ($tags as $tag) {
            $media->tags()->updateOrCreate(
                ['tag' => $tag],
                ['source' => 'ai'],
            );
        }
    }

    public function failed(Throwable $exception): void
    {
        $this->media->update([
            'status' => GalleryMediaStatus::Ready,
            'indexed_at' => now(),
            'ai_metadata' => [
                ...($this->media->ai_metadata ?? []),
                'analysis_error' => $exception->getMessage(),
            ],
        ]);
    }
}
