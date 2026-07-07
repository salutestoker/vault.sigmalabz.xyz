<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscordSyncItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'discord_sync_run_id',
        'gallery_media_id',
        'source_channel_id',
        'source_message_id',
        'source_attachment_id',
        'status',
        'action',
        'error_message',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public function syncRun(): BelongsTo
    {
        return $this->belongsTo(DiscordSyncRun::class, 'discord_sync_run_id');
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(GalleryMedia::class, 'gallery_media_id');
    }
}
