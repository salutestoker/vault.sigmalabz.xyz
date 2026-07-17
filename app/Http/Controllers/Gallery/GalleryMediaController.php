<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Http\Resources\GalleryMediaResource;
use App\Models\GalleryMedia;
use App\Services\Gallery\GalleryMediaQuery;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Throwable;

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

    public function clipboard(Request $request, GalleryMedia $media): SymfonyResponse
    {
        if (! $request->user()?->isAdmin()) {
            abort_unless($media->visibility->value === 'public', 404);
        }

        return $this->storedMediaResponse($media)
            ?? $this->remoteMediaResponse($media)
            ?? abort(404);
    }

    public function asset(Request $request, GalleryMedia $media): SymfonyResponse
    {
        if (! $request->user()?->isAdmin()) {
            abort_unless($media->visibility->value === 'public', 404);
        }

        return $this->storedMediaResponse($media) ?? abort(404);
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

    private function storedMediaResponse(GalleryMedia $media): ?SymfonyResponse
    {
        if (! $media->media_path) {
            return null;
        }

        try {
            $disk = Storage::disk(config('gallery.media_disk'));

            if (! $disk->exists($media->media_path)) {
                return null;
            }

            $stream = $disk->readStream($media->media_path);

            if ($stream === false) {
                return null;
            }

            return response()->stream(
                function () use ($stream): void {
                    fpassthru($stream);

                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                },
                200,
                $this->clipboardHeaders($media),
            );
        } catch (Throwable) {
            return null;
        }
    }

    private function remoteMediaResponse(GalleryMedia $media): ?SymfonyResponse
    {
        $url = $media->original_url ?: $media->media_url ?: $media->preview_url;

        if (! $url) {
            return null;
        }

        try {
            $response = Http::timeout(120)->get($url)->throw();

            return response(
                $response->body(),
                200,
                $this->clipboardHeaders(
                    $media,
                    $response->header('Content-Type') ?: null,
                ),
            );
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, string>
     */
    private function clipboardHeaders(GalleryMedia $media, ?string $contentType = null): array
    {
        $filename = Str::ascii($media->filename ?: "gallery-media-{$media->id}");
        $filename = str_replace(['"', '\\'], '', $filename);

        return [
            'Cache-Control' => 'public, max-age=3600',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
            'Content-Type' => $contentType ?: ($media->mime_type ?: 'application/octet-stream'),
            'X-Content-Type-Options' => 'nosniff',
        ];
    }
}
