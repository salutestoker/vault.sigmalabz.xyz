<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CreatorResource;
use App\Models\Creator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminCreatorController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Creators', [
            'creators' => CreatorResource::collection(
                Creator::withCount('media')
                    ->orderBy('display_name')
                    ->paginate(25),
            ),
        ]);
    }

    public function update(Request $request, Creator $creator): RedirectResponse
    {
        $validated = $request->validate([
            'display_name' => ['required', 'string', 'max:255'],
            'twitter_handle' => ['nullable', 'string', 'max:255'],
            'is_verified' => ['boolean'],
        ]);

        $creator->update($validated);

        return back()->with('success', 'Creator updated.');
    }
}
