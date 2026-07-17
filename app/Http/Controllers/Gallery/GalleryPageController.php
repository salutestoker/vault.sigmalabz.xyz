<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Http\Resources\CreatorResource;
use App\Http\Resources\GalleryMediaResource;
use App\Models\Creator;
use App\Models\GalleryCategory;
use App\Models\GalleryMediaColor;
use App\Services\Gallery\GalleryMediaQuery;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GalleryPageController extends Controller
{
    public function __invoke(Request $request, GalleryMediaQuery $mediaQuery): Response
    {
        $filters = [
            'search' => $request->string('search')->toString(),
            'category' => $request->string('category', 'all')->toString(),
            'creator' => $request->integer('creator') ?: null,
            'color' => $request->string('color')->toString(),
            'favorites' => $request->boolean('favorites'),
        ];

        $media = $mediaQuery
            ->build($filters, $request->user())
            ->paginate(48)
            ->withQueryString();

        return Inertia::render('Gallery/Index', [
            'initialMedia' => GalleryMediaResource::collection($media),
            'filters' => $filters,
            'categories' => $this->categories(),
            'creators' => CreatorResource::collection(
                Creator::query()
                    ->withCount(['media' => fn ($query) => $query
                        ->readyForGallery()
                        ->storedForGallery()])
                    ->having('media_count', '>', 0)
                    ->orderBy('display_name')
                    ->get(),
            ),
            'colors' => $this->topColors(),
        ]);
    }

    /**
     * @return array<int, array{slug: string, name: string}>
     */
    private function categories(): array
    {
        $configured = collect(config('gallery.categories'))
            ->map(fn (array $category) => [
                'slug' => $category['slug'],
                'name' => $category['name'],
            ]);

        $stored = GalleryCategory::query()
            ->where('is_active', true)
            ->orderBy('position')
            ->get(['slug', 'name'])
            ->map(fn (GalleryCategory $category) => [
                'slug' => $category->slug,
                'name' => $category->name,
            ]);

        return $configured->merge($stored)
            ->unique('slug')
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{hex: string, count: int}>
     */
    private function topColors(): array
    {
        return GalleryMediaColor::query()
            ->selectRaw('LOWER(hex) as hex, COUNT(*) as count')
            ->whereHas('media', fn ($query) => $query
                ->readyForGallery()
                ->storedForGallery())
            ->groupByRaw('LOWER(hex)')
            ->orderByDesc('count')
            ->limit(10)
            ->get()
            ->map(fn ($color) => [
                'hex' => $color->hex,
                'count' => (int) $color->count,
            ])
            ->all();
    }
}
