<?php

use App\Jobs\SyncDiscordVaultMedia;
use App\Models\DiscordSyncRun;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('gallery:sync-discord {--sync : Run synchronously instead of queueing} {--incremental : Stop scanning when existing channel media is reached}', function (): int {
    $incremental = (bool) $this->option('incremental');

    $syncRun = DiscordSyncRun::create([
        'status' => $this->option('sync') ? 'running' : 'queued',
    ]);

    if ($this->option('sync')) {
        SyncDiscordVaultMedia::dispatchSync($syncRun, $incremental);
        $this->info("Discord sync {$syncRun->fresh()->status}.");

        return 0;
    }

    SyncDiscordVaultMedia::dispatch($syncRun, $incremental);
    $this->info('Discord sync queued.');

    return 0;
})->purpose('Sync gallery media from the configured Discord VAULT category');

Schedule::command('gallery:sync-discord --incremental')
    ->dailyAt('08:00')
    ->timezone('America/New_York')
    ->withoutOverlapping();
