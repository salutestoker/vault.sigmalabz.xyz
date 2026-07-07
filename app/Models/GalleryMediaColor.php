<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GalleryMediaColor extends Model
{
    use HasFactory;

    protected $fillable = [
        'gallery_media_id',
        'hex',
        'name',
        'percentage',
        'sort_order',
        'source',
    ];

    protected function casts(): array
    {
        return [
            'percentage' => 'decimal:4',
            'sort_order' => 'integer',
        ];
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(GalleryMedia::class, 'gallery_media_id');
    }
}
