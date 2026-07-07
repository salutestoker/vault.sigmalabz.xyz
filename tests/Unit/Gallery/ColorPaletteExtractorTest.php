<?php

namespace Tests\Unit\Gallery;

use App\Models\GalleryMedia;
use App\Services\Gallery\ColorPaletteExtractor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ColorPaletteExtractorTest extends TestCase
{
    use RefreshDatabase;

    public function test_extracts_dominant_colors_from_stored_image(): void
    {
        Storage::fake('public');
        config(['gallery.media_disk' => 'public']);

        $image = imagecreatetruecolor(20, 20);
        $color = imagecolorallocate($image, 216, 27, 151);
        imagefilledrectangle($image, 0, 0, 20, 20, $color);
        ob_start();
        imagejpeg($image);
        $bytes = ob_get_clean();

        Storage::disk('public')->put('gallery/test.jpg', $bytes);

        $media = GalleryMedia::factory()->create([
            'thumbnail_path' => 'gallery/test.jpg',
        ]);

        $colors = app(ColorPaletteExtractor::class)->extract($media);

        $this->assertNotEmpty($colors);
        $this->assertStringStartsWith('#', $colors[0]['hex']);
    }
}
