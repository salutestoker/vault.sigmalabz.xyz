<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SyncDiscordVaultMedia;
use App\Models\DiscordSyncRun;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class AdminDiscordSyncController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Sync', [
            'syncRuns' => DiscordSyncRun::withCount('items')
                ->latest()
                ->paginate(20),
        ]);
    }

    public function store(): RedirectResponse
    {
        $syncRun = DiscordSyncRun::create([
            'status' => 'queued',
        ]);

        SyncDiscordVaultMedia::dispatch($syncRun)->afterCommit();

        return back()->with('success', 'Discord sync queued.');
    }
}
