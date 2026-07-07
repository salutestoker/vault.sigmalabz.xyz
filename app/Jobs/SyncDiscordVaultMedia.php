<?php

namespace App\Jobs;

use App\Models\DiscordSyncRun;
use App\Services\Discord\DiscordMediaImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncDiscordVaultMedia implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 900;

    public function __construct(
        public DiscordSyncRun $syncRun,
    ) {}

    public function handle(DiscordMediaImportService $service): void
    {
        $service->sync($this->syncRun);
    }
}
