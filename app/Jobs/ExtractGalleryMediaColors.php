<?php

namespace App\Jobs;

use App\Models\GalleryMedia;
use App\Services\Gallery\ColorPaletteExtractor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ExtractGalleryMediaColors implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 120;

    public function __construct(
        public GalleryMedia $media,
    ) {}

    public function handle(ColorPaletteExtractor $extractor): void
    {
        $media = $this->media->fresh();
        $colors = $extractor->extract($media);

        if ($colors === []) {
            return;
        }

        $media->colors()->delete();

        foreach ($colors as $index => $color) {
            $media->colors()->create([
                'hex' => $color['hex'],
                'percentage' => $color['percentage'],
                'sort_order' => $index,
                'source' => 'local',
            ]);
        }

        $media->update([
            'dominant_color' => $colors[0]['hex'],
            'color_palette' => $colors,
        ]);
    }
}
