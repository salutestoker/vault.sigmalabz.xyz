<?php

namespace Tests\Unit\Gallery;

use App\Jobs\AnalyzeGalleryMedia;
use App\Jobs\ExtractGalleryMediaColors;
use App\Models\GalleryMedia;
use App\Services\Gallery\GalleryMediaStorageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GalleryMediaStorageServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_copy_remote_media_skips_existing_stored_media(): void
    {
        Queue::fake();
        Storage::fake('public');
        Http::fake();
        config(['gallery.media_disk' => 'public']);

        $copiedAt = now()->subDay()->setMicrosecond(0);
        $mediaPath = 'gallery/media/1/image.jpg';

        Storage::disk('public')->put($mediaPath, 'stored-bytes');

        $media = GalleryMedia::factory()->create([
            'media_path' => $mediaPath,
            'thumbnail_path' => 'gallery/media/1/thumbnail.jpg',
            'original_url' => 'https://cdn.example.test/image.jpg',
            'copied_at' => $copiedAt,
        ]);

        app(GalleryMediaStorageService::class)->copyRemoteMedia($media);

        $media->refresh();

        $this->assertSame($mediaPath, $media->media_path);
        $this->assertSame('gallery/media/1/thumbnail.jpg', $media->thumbnail_path);
        $this->assertSame($copiedAt->timestamp, $media->copied_at?->timestamp);
        Http::assertNothingSent();
        Queue::assertNothingPushed();
    }

    public function test_copy_remote_media_refreshes_missing_stored_media(): void
    {
        Queue::fake([
            AnalyzeGalleryMedia::class,
            ExtractGalleryMediaColors::class,
        ]);
        Storage::fake('public');
        config([
            'gallery.ai.enabled' => false,
            'gallery.media_disk' => 'public',
        ]);

        $bytes = $this->jpegBytes();
        $url = 'https://cdn.example.test/image.jpg';
        Http::fake([
            $url => Http::response($bytes, 200, ['Content-Type' => 'image/jpeg']),
        ]);

        $media = GalleryMedia::factory()->create([
            'filename' => 'image.jpg',
            'media_path' => null,
            'thumbnail_path' => null,
            'original_url' => $url,
            'copied_at' => null,
        ]);

        $media->forceFill([
            'media_path' => "gallery/media/{$media->id}/image.jpg",
        ])->save();

        app(GalleryMediaStorageService::class)->copyRemoteMedia($media);

        $media->refresh();

        $this->assertSame("gallery/media/{$media->id}/image.jpg", $media->media_path);
        $this->assertNotNull($media->copied_at);
        Storage::disk('public')->assertExists($media->media_path);
        Http::assertSentCount(1);
    }

    private function jpegBytes(): string
    {
        $image = imagecreatetruecolor(20, 20);
        $color = imagecolorallocate($image, 216, 27, 151);
        imagefilledrectangle($image, 0, 0, 20, 20, $color);

        ob_start();
        imagejpeg($image);

        return (string) ob_get_clean();
    }
}
