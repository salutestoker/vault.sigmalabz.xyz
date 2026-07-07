<?php

namespace App\Services\Gallery;

use App\Models\GalleryMedia;
use Illuminate\Support\Facades\Storage;

class ColorPaletteExtractor
{
    /**
     * @return array<int, array{hex: string, percentage: float}>
     */
    public function extract(GalleryMedia $media, int $limit = 5): array
    {
        $path = $media->thumbnail_path ?: $media->media_path;

        if (! $path) {
            return [];
        }

        $disk = Storage::disk(config('gallery.media_disk'));

        if (! $disk->exists($path)) {
            return [];
        }

        $image = @imagecreatefromstring($disk->get($path));

        if (! $image) {
            return [];
        }

        $sampleSize = 64;
        $sample = imagecreatetruecolor($sampleSize, $sampleSize);
        imagecopyresampled($sample, $image, 0, 0, 0, 0, $sampleSize, $sampleSize, imagesx($image), imagesy($image));

        $counts = [];

        for ($x = 0; $x < $sampleSize; $x++) {
            for ($y = 0; $y < $sampleSize; $y++) {
                $rgb = imagecolorat($sample, $x, $y);
                $r = (($rgb >> 16) & 0xFF);
                $g = (($rgb >> 8) & 0xFF);
                $b = ($rgb & 0xFF);

                if (($r + $g + $b) < 36 || ($r + $g + $b) > 735) {
                    continue;
                }

                $hex = sprintf(
                    '#%02x%02x%02x',
                    min((int) round($r / 32) * 32, 255),
                    min((int) round($g / 32) * 32, 255),
                    min((int) round($b / 32) * 32, 255),
                );

                $counts[$hex] = ($counts[$hex] ?? 0) + 1;
            }
        }

        arsort($counts);

        $total = max(array_sum($counts), 1);

        return collect($counts)
            ->take($limit)
            ->map(fn (int $count, string $hex) => [
                'hex' => $this->normalizeHex($hex),
                'percentage' => round($count / $total, 4),
            ])
            ->values()
            ->all();
    }

    private function normalizeHex(string $hex): string
    {
        return '#'.str_pad(substr(strtolower($hex), 1), 6, '0', STR_PAD_LEFT);
    }
}
