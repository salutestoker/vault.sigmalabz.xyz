<?php

use App\Enums\GalleryMediaType;
use App\Http\Controllers\Admin\AdminCreatorController;
use App\Http\Controllers\Admin\AdminDashboardController;
use App\Http\Controllers\Admin\AdminDiscordSyncController;
use App\Http\Controllers\Admin\AdminGalleryMediaController;
use App\Http\Controllers\Admin\AdminUserController;
use App\Http\Controllers\Auth\DiscordAuthController;
use App\Http\Controllers\Gallery\GalleryFavoriteController;
use App\Http\Controllers\Gallery\GalleryMediaController;
use App\Http\Controllers\Gallery\GalleryV2PageController;
use App\Http\Controllers\ProfileController;
use App\Models\GalleryMedia;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    $galleryImages = GalleryMedia::query()
        ->readyForGallery()
        ->whereHas('category', fn ($query) => $query->whereIn('slug', ['sigma', 'aura']))
        ->where('type', GalleryMediaType::Image->value)
        ->where(function ($query): void {
            $query->whereNotNull('media_path')
                ->orWhereNotNull('original_url')
                ->orWhereNotNull('thumbnail_path')
                ->orWhereNotNull('preview_url');
        })
        ->inRandomOrder()
        ->limit(25)
        ->get()
        ->map(fn (GalleryMedia $media): ?string => $media->media_url ?: $media->thumbnail_url)
        ->filter()
        ->values()
        ->all();

    return Inertia::render('Landing', [
        'galleryImages' => $galleryImages,
    ]);
})->name('home');

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::get('/auth/discord/redirect', [DiscordAuthController::class, 'redirect'])
    ->name('auth.discord.redirect');
Route::get('/auth/discord/callback', [DiscordAuthController::class, 'callback'])
    ->name('auth.discord.callback');

Route::get('/gallery', GalleryV2PageController::class)->name('gallery.index');
Route::get('/gallery/media', [GalleryMediaController::class, 'v2Index'])->name('gallery.media.index');
Route::get('/gallery/media/{media}', [GalleryMediaController::class, 'show'])->name('gallery.media.show');

Route::middleware('auth')->group(function () {
    Route::post('/gallery/media/{media}/favorite', [GalleryFavoriteController::class, 'store'])
        ->name('gallery.media.favorite.store');
    Route::delete('/gallery/media/{media}/favorite', [GalleryFavoriteController::class, 'destroy'])
        ->name('gallery.media.favorite.destroy');
});

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware(['auth', 'can:access-admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', AdminDashboardController::class)->name('dashboard');
    Route::get('/users', [AdminUserController::class, 'index'])->name('users.index');
    Route::patch('/users/{user}', [AdminUserController::class, 'update'])->name('users.update');
    Route::get('/media', [AdminGalleryMediaController::class, 'index'])->name('media.index');
    Route::patch('/media/{media}', [AdminGalleryMediaController::class, 'update'])->name('media.update');
    Route::get('/creators', [AdminCreatorController::class, 'index'])->name('creators.index');
    Route::patch('/creators/{creator}', [AdminCreatorController::class, 'update'])->name('creators.update');
    Route::get('/sync', [AdminDiscordSyncController::class, 'index'])->name('sync.index');
    Route::post('/sync', [AdminDiscordSyncController::class, 'store'])->name('sync.store');
});

require __DIR__.'/auth.php';
