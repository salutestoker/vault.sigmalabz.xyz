<?php

namespace App\Http\Controllers\Gallery;

use App\Http\Controllers\Controller;
use App\Models\GalleryMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GalleryFavoriteController extends Controller
{
    public function store(Request $request, GalleryMedia $media): JsonResponse
    {
        abort_unless($media->visibility->value === 'public', 404);

        $request->user()->favorites()->firstOrCreate([
            'gallery_media_id' => $media->id,
        ]);

        return response()->json([
            'is_favorited' => true,
            'favorites_count' => $media->favorites()->count(),
        ]);
    }

    public function destroy(Request $request, GalleryMedia $media): JsonResponse
    {
        $request->user()->favorites()
            ->where('gallery_media_id', $media->id)
            ->delete();

        return response()->json([
            'is_favorited' => false,
            'favorites_count' => $media->favorites()->count(),
        ]);
    }
}
