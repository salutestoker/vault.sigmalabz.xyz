<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DiscordSyncRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'status',
        'started_at',
        'finished_at',
        'channels_scanned',
        'messages_scanned',
        'media_imported',
        'media_skipped',
        'media_failed',
        'error_message',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'channels_scanned' => 'integer',
            'messages_scanned' => 'integer',
            'media_imported' => 'integer',
            'media_skipped' => 'integer',
            'media_failed' => 'integer',
            'metadata' => 'array',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(DiscordSyncItem::class);
    }
}
