<?php

use App\Enums\GalleryMediaStatus;
use App\Enums\GalleryMediaType;
use App\Enums\GalleryMediaVisibility;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('connected_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider');
            $table->string('provider_id');
            $table->string('username')->nullable();
            $table->string('nickname')->nullable();
            $table->string('email')->nullable();
            $table->string('avatar_url')->nullable();
            $table->text('access_token')->nullable();
            $table->text('refresh_token')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->json('scopes')->nullable();
            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_id']);
            $table->unique(['user_id', 'provider']);
        });

        Schema::create('creators', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('discord_id')->nullable()->unique();
            $table->string('display_name');
            $table->string('twitter_handle')->nullable()->index();
            $table->string('discord_username')->nullable()->index();
            $table->string('avatar_url')->nullable();
            $table->string('profile_image_path')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('gallery_categories', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('gallery_media', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('creator_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('gallery_category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type')->default(GalleryMediaType::Image->value)->index();
            $table->string('status')->default(GalleryMediaStatus::Pending->value)->index();
            $table->string('visibility')->default(GalleryMediaVisibility::Public->value)->index();
            $table->string('source_provider')->default('discord')->index();
            $table->string('source_guild_id')->nullable()->index();
            $table->string('source_channel_id')->nullable()->index();
            $table->string('source_channel_name')->nullable();
            $table->string('source_message_id')->nullable()->index();
            $table->string('source_attachment_id')->nullable();
            $table->string('source_author_id')->nullable()->index();
            $table->string('source_author_username')->nullable();
            $table->text('source_message_url')->nullable();
            $table->text('original_url')->nullable();
            $table->string('media_path')->nullable();
            $table->string('thumbnail_path')->nullable();
            $table->text('preview_url')->nullable();
            $table->string('mime_type')->nullable();
            $table->string('filename')->nullable();
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->string('ai_title')->nullable();
            $table->text('ai_description')->nullable();
            $table->longText('ai_search_text')->nullable();
            $table->json('ai_metadata')->nullable();
            $table->string('dominant_color', 7)->nullable()->index();
            $table->json('color_palette')->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->decimal('duration_seconds', 10, 3)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->boolean('is_featured')->default(false)->index();
            $table->timestamp('copied_at')->nullable();
            $table->timestamp('indexed_at')->nullable();
            $table->timestamp('source_created_at')->nullable()->index();
            $table->timestamps();

            $table->unique(['source_provider', 'source_attachment_id']);
            $table->fullText(['title', 'description', 'ai_search_text'], 'gallery_media_search_fulltext');
        });

        Schema::create('gallery_media_tags', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('gallery_media_id')->constrained('gallery_media')->cascadeOnDelete();
            $table->string('tag')->index();
            $table->decimal('confidence', 5, 4)->nullable();
            $table->string('source')->default('ai')->index();
            $table->timestamps();

            $table->unique(['gallery_media_id', 'tag']);
        });

        Schema::create('gallery_media_colors', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('gallery_media_id')->constrained('gallery_media')->cascadeOnDelete();
            $table->string('hex', 7)->index();
            $table->string('name')->nullable();
            $table->decimal('percentage', 5, 4)->default(0);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('source')->default('local')->index();
            $table->timestamps();

            $table->unique(['gallery_media_id', 'hex']);
        });

        Schema::create('gallery_favorites', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('gallery_media_id')->constrained('gallery_media')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'gallery_media_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gallery_favorites');
        Schema::dropIfExists('gallery_media_colors');
        Schema::dropIfExists('gallery_media_tags');
        Schema::dropIfExists('gallery_media');
        Schema::dropIfExists('gallery_categories');
        Schema::dropIfExists('creators');
        Schema::dropIfExists('connected_accounts');
    }
};
