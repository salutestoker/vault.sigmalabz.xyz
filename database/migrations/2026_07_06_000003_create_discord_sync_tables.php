<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discord_sync_runs', function (Blueprint $table): void {
            $table->id();
            $table->string('status')->default('pending')->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->unsignedInteger('channels_scanned')->default(0);
            $table->unsignedInteger('messages_scanned')->default(0);
            $table->unsignedInteger('media_imported')->default(0);
            $table->unsignedInteger('media_skipped')->default(0);
            $table->unsignedInteger('media_failed')->default(0);
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('discord_sync_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('discord_sync_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('gallery_media_id')->nullable()->constrained('gallery_media')->nullOnDelete();
            $table->string('source_channel_id')->nullable()->index();
            $table->string('source_message_id')->nullable()->index();
            $table->string('source_attachment_id')->nullable()->index();
            $table->string('status')->default('pending')->index();
            $table->string('action')->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discord_sync_items');
        Schema::dropIfExists('discord_sync_runs');
    }
};
