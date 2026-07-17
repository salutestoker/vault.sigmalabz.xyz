<?php

namespace App\Jobs;

use App\Models\DiscordSyncRun;
use App\Services\Discord\DiscordMediaImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncDiscordVaultMedia implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 900;

    public int $uniqueFor = 1800;

    public function __construct(
        public DiscordSyncRun $syncRun,
        public bool $incremental = false,
    ) {}

    public function uniqueId(): string
    {
        return 'discord-vault-media-sync';
    }

    public function handle(DiscordMediaImportService $service): void
    {
        $service->sync($this->syncRun, $this->incremental);
    }
}
