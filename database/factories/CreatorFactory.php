<?php

namespace Database\Factories;

use App\Models\Creator;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Creator>
 */
class CreatorFactory extends Factory
{
    protected $model = Creator::class;

    public function definition(): array
    {
        return [
            'user_id' => null,
            'discord_id' => (string) fake()->unique()->numberBetween(100000, 999999999),
            'display_name' => fake()->name(),
            'twitter_handle' => fake()->optional()->userName(),
            'discord_username' => fake()->userName(),
            'avatar_url' => null,
            'is_verified' => false,
        ];
    }

    public function linkedUser(): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => User::factory(),
        ]);
    }
}
