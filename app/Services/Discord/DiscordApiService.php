<?php

namespace App\Services\Discord;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class DiscordApiService
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function guildChannels(): array
    {
        $guildId = config('gallery.discord.guild_id');

        return $this->bot()
            ->get("/guilds/{$guildId}/channels")
            ->throw()
            ->json();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function channelMessages(string $channelId, ?string $before = null): array
    {
        $query = [
            'limit' => config('gallery.discord.message_page_limit'),
        ];

        if ($before) {
            $query['before'] = $before;
        }

        return $this->bot()
            ->get("/channels/{$channelId}/messages", $query)
            ->throw()
            ->json();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function userGuilds(string $accessToken): array
    {
        return $this->bearer($accessToken)
            ->get('/users/@me/guilds')
            ->throw()
            ->json();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function userConnections(string $accessToken): array
    {
        return $this->bearer($accessToken)
            ->get('/users/@me/connections')
            ->throw()
            ->json();
    }

    private function bot(): PendingRequest
    {
        $token = config('gallery.discord.bot_token');

        if (! $token) {
            throw new RuntimeException('DISCORD_BOT_TOKEN is not configured.');
        }

        return Http::baseUrl(config('gallery.discord.api_base_url'))
            ->acceptJson()
            ->withToken($token, 'Bot');
    }

    private function bearer(string $accessToken): PendingRequest
    {
        return Http::baseUrl(config('gallery.discord.api_base_url'))
            ->acceptJson()
            ->withToken($accessToken);
    }
}
