<?php

namespace Tests\Feature\Gallery;

use App\Models\GalleryCategory;
use App\Models\GalleryMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class GalleryAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_gallery_page_is_visible_to_guests(): void
    {
        $this->get('/gallery')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Gallery/V2'));
    }

    public function test_gallery_v2_page_route_is_not_registered(): void
    {
        $this->get('/gallery-v2')->assertNotFound();
    }

    public function test_homepage_uses_twenty_five_random_visible_database_images(): void
    {
        $sigma = GalleryCategory::factory()->create([
            'name' => 'SIGMA',
            'slug' => 'sigma',
        ]);
        $aura = GalleryCategory::factory()->create([
            'name' => 'AURA',
            'slug' => 'aura',
        ]);
        $vegas = GalleryCategory::factory()->create([
            'name' => 'VEGAS',
            'slug' => 'vegas',
        ]);

        $visibleUrls = collect(range(1, 30))
            ->map(function (int $index) use ($aura, $sigma): string {
                $url = "https://cdn.example.test/gallery/visible-{$index}.jpg";

                GalleryMedia::factory()->create([
                    'gallery_category_id' => $index % 2 === 0 ? $sigma->id : $aura->id,
                    'original_url' => $url,
                    'preview_url' => $url,
                    'media_path' => null,
                    'thumbnail_path' => null,
                ]);

                return $url;
            });

        GalleryMedia::factory()->hidden()->create([
            'gallery_category_id' => $sigma->id,
            'original_url' => 'https://cdn.example.test/gallery/hidden.jpg',
            'preview_url' => 'https://cdn.example.test/gallery/hidden.jpg',
        ]);

        GalleryMedia::factory()->video()->create([
            'gallery_category_id' => $aura->id,
            'original_url' => 'https://cdn.example.test/gallery/video.mp4',
            'preview_url' => 'https://cdn.example.test/gallery/video.jpg',
        ]);

        GalleryMedia::factory()->create([
            'gallery_category_id' => $vegas->id,
            'original_url' => 'https://cdn.example.test/gallery/vegas.jpg',
            'preview_url' => 'https://cdn.example.test/gallery/vegas.jpg',
        ]);

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Landing')
                ->where('galleryImages', fn ($images): bool => $images->count() === 25
                    && $images->unique()->count() === 25
                    && $images->every(fn (string $url): bool => $visibleUrls->contains($url))));
    }

    public function test_gallery_media_endpoint_only_returns_visible_media(): void
    {
        GalleryMedia::factory()->create(['title' => 'Visible helmet']);
        GalleryMedia::factory()->hidden()->create(['title' => 'Hidden helmet']);

        $response = $this->getJson('/gallery/media');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Visible helmet');
    }

    public function test_gallery_media_endpoint_allows_hundred_items(): void
    {
        GalleryMedia::factory()->count(105)->create();

        $response = $this->getJson('/gallery/media?per_page=100');

        $response->assertOk()
            ->assertJsonCount(100, 'data')
            ->assertJsonPath('meta.per_page', 100);
    }

    public function test_gallery_v2_media_route_is_not_registered(): void
    {
        $this->getJson('/gallery-v2/media?per_page=100')->assertNotFound();
    }

    public function test_gallery_search_uses_generated_metadata(): void
    {
        GalleryMedia::factory()->create([
            'title' => 'Poster',
            'ai_search_text' => 'alien purple helmet spaceship',
        ]);
        GalleryMedia::factory()->create([
            'title' => 'Car',
            'ai_search_text' => 'vehicle desert',
        ]);

        $response = $this->getJson('/gallery/media?search=spaceship');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Poster');
    }

    public function test_logged_in_user_can_favorite_media(): void
    {
        $user = User::factory()->create();
        $media = GalleryMedia::factory()->create();

        $this->actingAs($user)
            ->postJson("/gallery/media/{$media->id}/favorite")
            ->assertOk()
            ->assertJsonPath('is_favorited', true);

        $this->assertDatabaseHas('gallery_favorites', [
            'user_id' => $user->id,
            'gallery_media_id' => $media->id,
        ]);
    }

    public function test_guest_cannot_favorite_media(): void
    {
        $media = GalleryMedia::factory()->create();

        $this->postJson("/gallery/media/{$media->id}/favorite")
            ->assertRedirect('/login');
    }
}
