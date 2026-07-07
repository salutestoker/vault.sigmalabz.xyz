<?php

namespace App\Models;

use App\Enums\GalleryMediaStatus;
use App\Enums\GalleryMediaType;
use App\Enums\GalleryMediaVisibility;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class GalleryMedia extends Model
{
    use HasFactory;

    protected $table = 'gallery_media';

    protected $fillable = [
        'creator_id',
        'gallery_category_id',
        'type',
        'status',
        'visibility',
        'source_provider',
        'source_guild_id',
        'source_channel_id',
        'source_channel_name',
        'source_message_id',
        'source_attachment_id',
        'source_author_id',
        'source_author_username',
        'source_message_url',
        'original_url',
        'media_path',
        'thumbnail_path',
        'preview_url',
        'mime_type',
        'filename',
        'title',
        'description',
        'ai_title',
        'ai_description',
        'ai_search_text',
        'ai_metadata',
        'dominant_color',
        'color_palette',
        'width',
        'height',
        'duration_seconds',
        'file_size',
        'is_featured',
        'copied_at',
        'indexed_at',
        'source_created_at',
    ];

    protected $appends = [
        'media_url',
        'thumbnail_url',
        'display_title',
        'display_description',
    ];

    protected function casts(): array
    {
        return [
            'type' => GalleryMediaType::class,
            'status' => GalleryMediaStatus::class,
            'visibility' => GalleryMediaVisibility::class,
            'ai_metadata' => 'array',
            'color_palette' => 'array',
            'width' => 'integer',
            'height' => 'integer',
            'duration_seconds' => 'decimal:3',
            'file_size' => 'integer',
            'is_featured' => 'boolean',
            'copied_at' => 'datetime',
            'indexed_at' => 'datetime',
            'source_created_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(GalleryCategory::class, 'gallery_category_id');
    }

    public function tags(): HasMany
    {
        return $this->hasMany(GalleryMediaTag::class);
    }

    public function colors(): HasMany
    {
        return $this->hasMany(GalleryMediaColor::class);
    }

    public function favorites(): HasMany
    {
        return $this->hasMany(GalleryFavorite::class);
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('visibility', GalleryMediaVisibility::Public->value);
    }

    public function scopeReadyForGallery(Builder $query): Builder
    {
        return $query->visible()
            ->whereIn('status', [
                GalleryMediaStatus::Imported->value,
                GalleryMediaStatus::Processing->value,
                GalleryMediaStatus::Ready->value,
            ]);
    }

    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        $search = trim((string) $search);

        if ($search === '') {
            return $query;
        }

        $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';

        return $query->where(function (Builder $query) use ($like, $search): void {
            $query->where('title', 'like', $like)
                ->orWhere('description', 'like', $like)
                ->orWhere('ai_title', 'like', $like)
                ->orWhere('ai_description', 'like', $like)
                ->orWhere('ai_search_text', 'like', $like)
                ->orWhereHas('tags', fn (Builder $tagQuery) => $tagQuery->where('tag', 'like', $like));

            if (config('database.default') === 'mysql') {
                $query->orWhereFullText(['title', 'description', 'ai_search_text'], $search);
            }
        });
    }

    public function getMediaUrlAttribute(): ?string
    {
        if ($this->media_path) {
            return Storage::disk(config('gallery.media_disk'))->url($this->media_path);
        }

        return $this->original_url;
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        if ($this->thumbnail_path) {
            return Storage::disk(config('gallery.media_disk'))->url($this->thumbnail_path);
        }

        return $this->preview_url ?: $this->media_url;
    }

    public function getDisplayTitleAttribute(): string
    {
        return $this->title ?: ($this->ai_title ?: ($this->filename ?: 'Untitled media'));
    }

    public function getDisplayDescriptionAttribute(): ?string
    {
        return $this->description ?: $this->ai_description;
    }
}
