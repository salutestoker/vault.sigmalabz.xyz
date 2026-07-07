<?php

use App\Jobs\SyncDiscordVaultMedia;
use App\Models\DiscordSyncRun;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('gallery:sync-discord {--sync : Run synchronously instead of queueing}', function (): int {
    $syncRun = DiscordSyncRun::create([
        'status' => $this->option('sync') ? 'running' : 'queued',
    ]);

    if ($this->option('sync')) {
        SyncDiscordVaultMedia::dispatchSync($syncRun);
        $this->info("Discord sync {$syncRun->fresh()->status}.");

        return 0;
    }

    SyncDiscordVaultMedia::dispatch($syncRun);
    $this->info('Discord sync queued.');

    return 0;
})->purpose('Sync gallery media from the configured Discord VAULT category');
