<?php

namespace App\Http\Controllers\Admin;

use App\Enums\GalleryMediaVisibility;
use App\Http\Controllers\Controller;
use App\Http\Resources\GalleryMediaResource;
use App\Models\GalleryCategory;
use App\Models\GalleryMedia;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AdminGalleryMediaController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Media', [
            'media' => GalleryMediaResource::collection(
                GalleryMedia::with(['creator', 'category', 'colors', 'tags'])
                    ->withCount('favorites')
                    ->latest()
                    ->paginate(24),
            ),
            'categories' => GalleryCategory::orderBy('position')->get(['id', 'name', 'slug']),
        ]);
    }

    public function update(Request $request, GalleryMedia $media): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'visibility' => ['required', Rule::enum(GalleryMediaVisibility::class)],
            'is_featured' => ['boolean'],
            'gallery_category_id' => ['nullable', 'exists:gallery_categories,id'],
        ]);

        $media->update($validated);

        return back()->with('success', 'Media updated.');
    }
}
