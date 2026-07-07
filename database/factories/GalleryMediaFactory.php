<?php

namespace Database\Factories;

use App\Enums\GalleryMediaStatus;
use App\Enums\GalleryMediaType;
use App\Enums\GalleryMediaVisibility;
use App\Models\Creator;
use App\Models\GalleryCategory;
use App\Models\GalleryMedia;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GalleryMedia>
 */
class GalleryMediaFactory extends Factory
{
    protected $model = GalleryMedia::class;

    public function definition(): array
    {
        return [
            'creator_id' => Creator::factory(),
            'gallery_category_id' => GalleryCategory::factory(),
            'type' => GalleryMediaType::Image,
            'status' => GalleryMediaStatus::Ready,
            'visibility' => GalleryMediaVisibility::Public,
            'source_provider' => 'discord',
            'source_guild_id' => '1513206529132593174',
            'source_channel_id' => (string) fake()->numberBetween(1000, 9999),
            'source_channel_name' => 'sigma',
            'source_message_id' => (string) fake()->unique()->numberBetween(100000, 999999999),
            'source_attachment_id' => (string) fake()->unique()->numberBetween(100000, 999999999),
            'source_author_id' => (string) fake()->numberBetween(100000, 999999999),
            'original_url' => '/images/tmp/image-1201.jpg',
            'thumbnail_path' => null,
            'preview_url' => '/images/tmp/image-1201.jpg',
            'mime_type' => 'image/jpeg',
            'filename' => fake()->slug().'.jpg',
            'title' => fake()->words(3, true),
            'description' => fake()->sentence(),
            'ai_search_text' => fake()->sentence().' helmet purple poster',
            'dominant_color' => '#a02080',
            'is_featured' => false,
            'copied_at' => now(),
            'indexed_at' => now(),
            'source_created_at' => now(),
        ];
    }

    public function hidden(): static
    {
        return $this->state(fn (array $attributes) => [
            'visibility' => GalleryMediaVisibility::Hidden,
        ]);
    }

    public function video(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => GalleryMediaType::Video,
            'mime_type' => 'video/mp4',
            'filename' => fake()->slug().'.mp4',
        ]);
    }
}
