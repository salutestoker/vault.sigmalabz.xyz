<?php

namespace App\Jobs;

use App\Enums\GalleryMediaStatus;
use App\Models\GalleryMedia;
use App\Services\Gallery\GalleryMediaStorageService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ImportDiscordMediaAttachment implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 180;

    public array $backoff = [60, 180, 300];

    public function __construct(
        public GalleryMedia $media,
    ) {}

    public function handle(GalleryMediaStorageService $storage): void
    {
        $storage->copyRemoteMedia($this->media->fresh());
    }

    public function failed(Throwable $exception): void
    {
        $this->media->update([
            'status' => GalleryMediaStatus::Failed,
            'ai_metadata' => [
                'import_error' => $exception->getMessage(),
            ],
        ]);
    }
}
