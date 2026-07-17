<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Creator;
use App\Models\DiscordSyncRun;
use App\Models\GalleryMedia;
use App\Models\User;
use Inertia\Inertia;
use Inertia\Response;

class AdminDashboardController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'users' => User::count(),
                'creators' => Creator::count(),
                'media' => GalleryMedia::count(),
                'visibleMedia' => GalleryMedia::readyForGallery()->storedForGallery()->count(),
                'failedSyncs' => DiscordSyncRun::where('status', 'failed')->count(),
            ],
            'recentSyncs' => DiscordSyncRun::latest()->limit(8)->get(),
        ]);
    }
}
