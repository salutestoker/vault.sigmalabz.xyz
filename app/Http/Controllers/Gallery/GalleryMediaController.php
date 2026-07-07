<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Http\Resources\GalleryMediaResource;
use App\Models\GalleryMedia;
use App\Services\Gallery\GalleryMediaQuery;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class GalleryMediaController extends Controller
{
    public function index(Request $request, GalleryMediaQuery $mediaQuery): AnonymousResourceCollection
    {
        return $this->paginatedMedia($request, $mediaQuery, 48, 24);
    }

    public function v2Index(Request $request, GalleryMediaQuery $mediaQuery): AnonymousResourceCollection
    {
        return $this->paginatedMedia($request, $mediaQuery, 100, 100, [
            ...$request->query(),
            'prefer_local' => true,
            'random' => true,
        ]);
    }

    public function show(Request $request, GalleryMedia $media): GalleryMediaResource
    {
        $query = GalleryMedia::query()
            ->whereKey($media->id)
            ->with([
                'category:id,slug,name',
                'creator:id,display_name,twitter_handle,discord_username,avatar_url,profile_image_path',
                'colors' => fn ($query) => $query->orderBy('sort_order'),
                'tags:id,gallery_media_id,tag',
            ])
            ->withCount('favorites')
            ->when($request->user(), fn ($query) => $query->withExists([
                'favorites as is_favorited' => fn ($favoriteQuery) => $favoriteQuery->where('user_id', $request->user()->id),
            ]));

        if (! $request->user()?->isAdmin()) {
            $query->visible();
        }

        $media = $query->firstOrFail();

        return new GalleryMediaResource($media);
    }

    private function paginatedMedia(
        Request $request,
        GalleryMediaQuery $mediaQuery,
        int $maxPerPage,
        int $defaultPerPage,
        ?array $filters = null,
    ): AnonymousResourceCollection {
        $perPage = min(max($request->integer('per_page', $defaultPerPage), 1), $maxPerPage);

        $media = $mediaQuery
            ->build($filters ?? $request->query(), $request->user())
            ->paginate($perPage)
            ->withQueryString();

        return GalleryMediaResource::collection($media);
    }
}
