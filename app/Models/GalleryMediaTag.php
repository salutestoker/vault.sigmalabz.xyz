<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GalleryMediaTag extends Model
{
    use HasFactory;

    protected $fillable = [
        'gallery_media_id',
        'tag',
        'confidence',
        'source',
    ];

    protected function casts(): array
    {
        return [
            'confidence' => 'decimal:4',
        ];
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(GalleryMedia::class, 'gallery_media_id');
    }
}
