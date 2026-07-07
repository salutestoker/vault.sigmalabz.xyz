<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Creator extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'discord_id',
        'display_name',
        'twitter_handle',
        'discord_username',
        'avatar_url',
        'profile_image_path',
        'is_verified',
        'metadata',
    ];

    protected $appends = [
        'profile_image_url',
        'preferred_handle',
    ];

    protected function casts(): array
    {
        return [
            'is_verified' => 'boolean',
            'metadata' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(GalleryMedia::class);
    }

    public function getProfileImageUrlAttribute(): ?string
    {
        if ($this->profile_image_path) {
            return Storage::disk(config('gallery.media_disk'))->url($this->profile_image_path);
        }

        return $this->avatar_url;
    }

    public function getPreferredHandleAttribute(): string
    {
        return $this->twitter_handle ?: ($this->discord_username ?: $this->display_name);
    }
}
