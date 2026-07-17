<?php

namespace App\Http\Controllers\Gallery;

use App\Enums\GalleryMediaType;
use App\Http\Controllers\Controller;
use App\Http\Resources\GalleryMediaResource;
use App\Models\GalleryCategory;
use App\Models\GalleryMedia;
use App\Services\Gallery\GalleryMediaQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GalleryV2PageController extends Controller
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

        $categories = $this->categories();

        if (
            $filters['category'] !== 'all' &&
            ! collect($categories)->contains('slug', $filters['category'])
        ) {
            $filters['category'] = 'all';
        }

        $media = $mediaQuery
            ->build([...$filters, 'prefer_local' => true, 'random' => true], $request->user())
            ->paginate(100)
            ->withQueryString();

        return Inertia::render('Gallery/V2', [
            'initialMedia' => GalleryMediaResource::collection($media),
            'filters' => $filters,
            'categories' => $categories,
        ]);
    }

    /**
     * @return array<int, array{slug: string, name: string}>
     */
    private function categories(): array
    {
        $imageCategorySlugs = GalleryCategory::query()
            ->whereHas('media', fn (Builder $query) => $query
                ->readyForGallery()
                ->storedForGallery()
                ->where('type', GalleryMediaType::Image->value)
            )
            ->pluck('slug');

        $hasVideos = GalleryMedia::query()
            ->readyForGallery()
            ->storedForGallery()
            ->where('type', GalleryMediaType::Video->value)
            ->exists();

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
            ->filter(fn (array $category) => $category['slug'] === 'all'
                || $imageCategorySlugs->contains($category['slug'])
                || ($category['slug'] === 'videos' && $hasVideos)
            )
            ->values()
            ->all();
    }
}
