<?php

namespace App\Services\Gallery;

use App\Enums\GalleryMediaType;
use App\Models\GalleryMedia;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class GalleryMediaQuery
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function build(array $filters, ?User $user = null): Builder
    {
        $category = (string) ($filters['category'] ?? 'all');
        $creator = $filters['creator'] ?? null;
        $color = $filters['color'] ?? null;
        $favorites = filter_var($filters['favorites'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $preferLocal = filter_var($filters['prefer_local'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $random = filter_var($filters['random'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $query = GalleryMedia::query()
            ->readyForGallery()
            ->with([
                'category:id,slug,name',
                'creator:id,display_name,twitter_handle,discord_username,avatar_url,profile_image_path',
                'colors' => fn ($query) => $query->orderBy('sort_order')->limit(5),
                'tags:id,gallery_media_id,tag',
            ])
            ->withCount('favorites')
            ->when($user, fn (Builder $query) => $query->withExists([
                'favorites as is_favorited' => fn (Builder $favoriteQuery) => $favoriteQuery->where('user_id', $user->id),
            ]))
            ->search($filters['search'] ?? null)
            ->when($category !== '' && $category !== 'all', function (Builder $query) use ($category): void {
                if ($category === 'videos') {
                    $query->where(function (Builder $query) use ($category): void {
                        $query->where('type', GalleryMediaType::Video->value)
                            ->orWhereHas('category', fn (Builder $categoryQuery) => $categoryQuery->where('slug', $category));
                    });

                    return;
                }

                $query->whereHas('category', fn (Builder $categoryQuery) => $categoryQuery->where('slug', $category));
            })
            ->when($creator, fn (Builder $query) => $query->where('creator_id', $creator))
            ->when($color, function (Builder $query) use ($color): void {
                $hex = strtolower((string) $color);

                $query->where(function (Builder $query) use ($hex): void {
                    $query->whereRaw('LOWER(dominant_color) = ?', [$hex])
                        ->orWhereHas('colors', fn (Builder $colorQuery) => $colorQuery->whereRaw('LOWER(hex) = ?', [$hex]));
                });
            })
            ->when($favorites, function (Builder $query) use ($user): void {
                if (! $user) {
                    $query->whereRaw('1 = 0');

                    return;
                }

                $query->whereHas('favorites', fn (Builder $favoriteQuery) => $favoriteQuery->where('user_id', $user->id));
            });

        if ($random) {
            return $query->inRandomOrder();
        }

        return $query
            ->when(
                $preferLocal,
                fn (Builder $query) => $query->orderByRaw(
                    'CASE WHEN media_path IS NOT NULL OR thumbnail_path IS NOT NULL THEN 0 ELSE 1 END'
                )
            )
            ->latest('source_created_at')
            ->latest('id');
    }
}
