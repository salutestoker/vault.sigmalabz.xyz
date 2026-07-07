<?php

namespace Database\Factories;

use App\Models\GalleryCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GalleryCategory>
 */
class GalleryCategoryFactory extends Factory
{
    protected $model = GalleryCategory::class;

    public function definition(): array
    {
        $name = fake()->unique()->word();

        return [
            'name' => str($name)->headline()->toString(),
            'slug' => str($name)->slug()->toString(),
            'position' => fake()->numberBetween(1, 20),
            'is_active' => true,
        ];
    }
}
