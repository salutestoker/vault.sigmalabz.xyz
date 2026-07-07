<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GalleryMediaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'status' => $this->status->value,
            'visibility' => $this->visibility->value,
            'title' => $this->display_title,
            'description' => $this->display_description,
            'media_url' => $this->media_url,
            'thumbnail_url' => $this->thumbnail_url,
            'preview_url' => $this->preview_url,
            'mime_type' => $this->mime_type,
            'width' => $this->width,
            'height' => $this->height,
            'duration_seconds' => $this->duration_seconds,
            'dominant_color' => $this->dominant_color,
            'favorites_count' => $this->favorites_count ?? 0,
            'is_favorited' => (bool) ($this->is_favorited ?? false),
            'source' => [
                'provider' => $this->source_provider,
                'channel_name' => $this->source_channel_name,
                'message_url' => $this->source_message_url,
                'created_at' => $this->source_created_at?->toISOString(),
            ],
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->id,
                'slug' => $this->category->slug,
                'name' => $this->category->name,
            ] : null),
            'creator' => new CreatorResource($this->whenLoaded('creator')),
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->pluck('tag')->values()),
            'colors' => $this->whenLoaded('colors', fn () => $this->colors->map(fn ($color) => [
                'hex' => $color->hex,
                'name' => $color->name,
                'percentage' => (float) $color->percentage,
            ])->values()),
        ];
    }
}
