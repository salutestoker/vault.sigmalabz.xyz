<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    $supportedExtensions = ['avif', 'gif', 'jpg', 'jpeg', 'png', 'webp'];

    $galleryImages = collect(glob(public_path('images/tmp/*')) ?: [])
        ->filter(fn (string $path) => is_file($path))
        ->filter(fn (string $path) => in_array(
            strtolower(pathinfo($path, PATHINFO_EXTENSION)),
            $supportedExtensions,
            true,
        ))
        ->sortBy(fn (string $path) => basename($path))
        ->values()
        ->map(fn (string $path) => '/images/tmp/'.basename($path))
        ->shuffle()
        ->values()
        ->all();

    return Inertia::render('Landing', [
        'galleryImages' => $galleryImages,
    ]);
})->name('home');

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
