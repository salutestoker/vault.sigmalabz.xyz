<?php

namespace App\Services\Gallery;

use App\Enums\GalleryMediaStatus;
use App\Enums\GalleryMediaType;
use App\Jobs\AnalyzeGalleryMedia;
use App\Jobs\ExtractGalleryMediaColors;
use App\Models\GalleryMedia;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Process\Process;
use Throwable;

class GalleryMediaStorageService
{
    public function copyRemoteMedia(GalleryMedia $media): void
    {
        if ($this->hasStoredMedia($media)) {
            return;
        }

        if (! $media->original_url) {
            throw new RuntimeException('Gallery media has no original URL to copy.');
        }

        $response = Http::timeout(120)->get($media->original_url)->throw();
        $bytes = $response->body();

        if (strlen($bytes) > config('gallery.max_media_bytes')) {
            throw new RuntimeException('Discord media exceeds configured size limit.');
        }

        $disk = Storage::disk(config('gallery.media_disk'));
        $extension = $this->extensionFor($media);
        $filename = Str::slug(pathinfo($media->filename ?: "media-{$media->id}", PATHINFO_FILENAME)) ?: "media-{$media->id}";
        $mediaPath = "gallery/media/{$media->id}/{$filename}.{$extension}";

        $disk->put($mediaPath, $bytes);

        try {
            $thumbnailPath = $media->type === GalleryMediaType::Video
                ? $this->thumbnailVideo($media, $mediaPath)
                : $this->thumbnailImage($media, $mediaPath);
        } catch (Throwable) {
            $thumbnailPath = $mediaPath;
        }

        $media->update([
            'media_path' => $mediaPath,
            'thumbnail_path' => $thumbnailPath ?: $mediaPath,
            'status' => GalleryMediaStatus::Processing,
            'copied_at' => now(),
        ]);

        ExtractGalleryMediaColors::dispatch($media->fresh())->afterCommit();

        if (config('gallery.ai.enabled')) {
            AnalyzeGalleryMedia::dispatch($media->fresh())->afterCommit();
        }
    }

    public function hasStoredMedia(GalleryMedia $media): bool
    {
        if (! $media->media_path) {
            return false;
        }

        try {
            return Storage::disk(config('gallery.media_disk'))->exists($media->media_path);
        } catch (Throwable) {
            return false;
        }
    }

    private function extensionFor(GalleryMedia $media): string
    {
        $extension = strtolower(pathinfo((string) $media->filename, PATHINFO_EXTENSION));

        if ($extension !== '') {
            return $extension;
        }

        return match ($media->mime_type) {
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            'video/mp4' => 'mp4',
            'video/webm' => 'webm',
            default => $media->type === GalleryMediaType::Video ? 'mp4' : 'jpg',
        };
    }

    private function thumbnailImage(GalleryMedia $media, string $mediaPath): ?string
    {
        $disk = Storage::disk(config('gallery.media_disk'));

        if (! $this->isLocalMediaDisk() || ! method_exists($disk, 'path') || ! class_exists(\Imagick::class)) {
            return $mediaPath;
        }

        $sourcePath = $disk->path($mediaPath);
        $thumbnailPath = "gallery/media/{$media->id}/thumbnail.jpg";

        $image = new \Imagick($sourcePath);
        $image->setImageColorspace(\Imagick::COLORSPACE_SRGB);
        $image->thumbnailImage(900, 900, true, true);
        $image->setImageFormat('jpeg');
        $image->setImageCompressionQuality(84);

        $disk->put($thumbnailPath, $image->getImagesBlob());
        $image->clear();

        return $thumbnailPath;
    }

    private function thumbnailVideo(GalleryMedia $media, string $mediaPath): ?string
    {
        $disk = Storage::disk(config('gallery.media_disk'));

        if (! $this->isLocalMediaDisk() || ! method_exists($disk, 'path')) {
            return null;
        }

        $sourcePath = $disk->path($mediaPath);
        $thumbnailPath = "gallery/media/{$media->id}/thumbnail.jpg";
        $targetPath = $disk->path($thumbnailPath);

        @mkdir(dirname($targetPath), 0755, true);

        $process = new Process([
            'ffmpeg',
            '-y',
            '-ss',
            '00:00:01',
            '-i',
            $sourcePath,
            '-frames:v',
            '1',
            '-vf',
            'scale=900:-1',
            $targetPath,
        ]);
        $process->setTimeout(60);
        $process->run();

        return $process->isSuccessful() && $disk->exists($thumbnailPath) ? $thumbnailPath : null;
    }

    private function isLocalMediaDisk(): bool
    {
        $disk = (string) config('gallery.media_disk');

        return config("filesystems.disks.{$disk}.driver") === 'local';
    }
}
