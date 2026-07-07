<?php

use App\Enums\UserRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('role')->default(UserRole::Standard->value)->after('password')->index();
            $table->string('display_name')->nullable()->after('name');
            $table->string('twitter_handle')->nullable()->after('display_name')->index();
            $table->string('discord_id')->nullable()->after('twitter_handle')->unique();
            $table->string('discord_username')->nullable()->after('discord_id')->index();
            $table->string('discord_avatar_url')->nullable()->after('discord_username');
            $table->string('profile_image_path')->nullable()->after('discord_avatar_url');
            $table->timestamp('discord_guild_verified_at')->nullable()->after('profile_image_path');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['discord_id']);
            $table->dropIndex(['role']);
            $table->dropIndex(['twitter_handle']);
            $table->dropIndex(['discord_username']);
            $table->dropColumn([
                'role',
                'display_name',
                'twitter_handle',
                'discord_id',
                'discord_username',
                'discord_avatar_url',
                'profile_image_path',
                'discord_guild_verified_at',
            ]);
        });
    }
};
