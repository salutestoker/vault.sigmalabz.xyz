<?php

return [
    'media_disk' => env('GALLERY_MEDIA_DISK', 'public'),
    'max_media_bytes' => (int) env('DISCORD_MAX_MEDIA_BYTES', 50 * 1024 * 1024),

    'discord' => [
        'api_base_url' => env('DISCORD_API_BASE_URL', 'https://discord.com/api/v10'),
        'guild_id' => env('DISCORD_GUILD_ID', '1513206529132593174'),
        'bot_token' => env('DISCORD_BOT_TOKEN'),
        'vault_category_id' => env('DISCORD_VAULT_CATEGORY_ID'),
        'vault_category_name' => env('DISCORD_VAULT_CATEGORY_NAME', 'VAULT'),
        'message_page_limit' => (int) env('DISCORD_MESSAGE_PAGE_LIMIT', 100),
    ],

    'ai' => [
        'enabled' => filter_var(env('AI_INDEXING_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
        'openai_api_key' => env('OPENAI_API_KEY'),
        'openai_model' => env('OPENAI_VISION_MODEL', 'gpt-5.5'),
    ],

    'categories' => [
        ['name' => 'All', 'slug' => 'all'],
        ['name' => 'SIGMA', 'slug' => 'sigma'],
        ['name' => 'AURA', 'slug' => 'aura'],
        ['name' => 'BURNIE', 'slug' => 'burnie'],
        ['name' => 'VEGAS', 'slug' => 'vegas'],
        ['name' => 'VIDEOS', 'slug' => 'videos'],
        ['name' => 'PRO ENGINE', 'slug' => 'pro-engine'],
    ],
];
