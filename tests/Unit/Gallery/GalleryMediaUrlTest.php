<?php

namespace Tests\Unit\Gallery;

use App\Models\GalleryMedia;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class GalleryMediaUrlTest extends TestCase
{
    public function test_media_url_falls_back_to_original_url_when_storage_disk_is_unavailable(): void
    {
        Config::set('gallery.media_disk', 'missing-gallery-disk');

        $media = new GalleryMedia([
            'media_path' => 'gallery/media/1/image.jpg',
            'original_url' => 'https://cdn.example.test/image.jpg',
        ]);

        $this->assertSame('https://cdn.example.test/image.jpg', $media->media_url);
    }

    public function test_thumbnail_url_falls_back_to_preview_url_when_storage_disk_is_unavailable(): void
    {
        Config::set('gallery.media_disk', 'missing-gallery-disk');

        $media = new GalleryMedia([
            'media_path' => 'gallery/media/1/image.jpg',
            'thumbnail_path' => 'gallery/media/1/thumbnail.jpg',
            'original_url' => 'https://cdn.example.test/image.jpg',
            'preview_url' => 'https://cdn.example.test/preview.jpg',
        ]);

        $this->assertSame('https://cdn.example.test/preview.jpg', $media->thumbnail_url);
    }
}
