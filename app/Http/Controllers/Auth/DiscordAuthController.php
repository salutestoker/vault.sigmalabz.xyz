<?php

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ConnectedAccount;
use App\Models\Creator;
use App\Models\User;
use App\Services\Discord\DiscordApiService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Throwable;

class DiscordAuthController extends Controller
{
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('discord')
            ->scopes(['identify', 'email', 'guilds', 'connections'])
            ->redirect();
    }

    public function callback(DiscordApiService $discord): RedirectResponse
    {
        $discordUser = Socialite::driver('discord')->user();
        $user = $this->syncUser($discordUser, $discord);

        Auth::login($user, true);

        return redirect()->intended(route('gallery.index', absolute: false));
    }

    private function syncUser(SocialiteUser $discordUser, DiscordApiService $discord): User
    {
        $discordId = (string) $discordUser->getId();
        $raw = $discordUser->getRaw();
        $guildVerified = $this->belongsToConfiguredGuild($discordUser, $discord);
        $twitterHandle = $this->twitterHandle($discordUser, $discord);

        return DB::transaction(function () use ($discordUser, $discordId, $raw, $guildVerified, $twitterHandle): User {
            $user = Auth::user()
                ?: ConnectedAccount::where('provider', 'discord')
                    ->where('provider_id', $discordId)
                    ->first()
                    ?->user
                ?: User::where('discord_id', $discordId)->first()
                ?: User::where('email', $discordUser->getEmail() ?: $this->fallbackEmail($discordId))->first();

            $role = $user?->role ?? UserRole::Standard;

            if ($guildVerified && $role !== UserRole::Admin) {
                $role = UserRole::Creator;
            }

            $attributes = [
                'name' => $user?->name ?: ($discordUser->getName() ?: $discordUser->getNickname() ?: 'Discord User'),
                'display_name' => $user?->display_name ?: ($raw['global_name'] ?? $discordUser->getName()),
                'email' => $user?->email ?: ($discordUser->getEmail() ?: $this->fallbackEmail($discordId)),
                'role' => $role,
                'twitter_handle' => $user?->twitter_handle ?: $twitterHandle,
                'discord_id' => $discordId,
                'discord_username' => $discordUser->getNickname() ?: ($raw['username'] ?? null),
                'discord_avatar_url' => $discordUser->getAvatar(),
                'discord_guild_verified_at' => $guildVerified ? now() : $user?->discord_guild_verified_at,
            ];

            if ($user) {
                $user->update($attributes);
            } else {
                $user = User::create([
                    ...$attributes,
                    'password' => Str::password(48),
                ]);
            }

            $user->connectedAccounts()->updateOrCreate(
                [
                    'provider' => 'discord',
                    'provider_id' => $discordId,
                ],
                [
                    'username' => $raw['username'] ?? $discordUser->getNickname(),
                    'nickname' => $discordUser->getNickname(),
                    'email' => $discordUser->getEmail(),
                    'avatar_url' => $discordUser->getAvatar(),
                    'access_token' => $discordUser->token,
                    'refresh_token' => $discordUser->refreshToken,
                    'expires_at' => $discordUser->expiresIn ? now()->addSeconds((int) $discordUser->expiresIn) : null,
                    'scopes' => $discordUser->approvedScopes ?? null,
                    'raw_data' => $raw,
                ],
            );

            Creator::updateOrCreate(
                ['discord_id' => $discordId],
                [
                    'user_id' => $user->id,
                    'display_name' => $user->display_name ?: $user->name,
                    'twitter_handle' => $user->twitter_handle,
                    'discord_username' => $user->discord_username,
                    'avatar_url' => $user->discord_avatar_url,
                    'is_verified' => $guildVerified,
                ],
            );

            return $user->fresh();
        });
    }

    private function fallbackEmail(string $discordId): string
    {
        return "discord-{$discordId}@users.noreply.vault.sigmalabz.xyz";
    }

    private function belongsToConfiguredGuild(SocialiteUser $discordUser, DiscordApiService $discord): bool
    {
        try {
            return collect($discord->userGuilds($discordUser->token))
                ->contains(fn (array $guild) => (string) ($guild['id'] ?? '') === (string) config('gallery.discord.guild_id'));
        } catch (Throwable) {
            return false;
        }
    }

    private function twitterHandle(SocialiteUser $discordUser, DiscordApiService $discord): ?string
    {
        try {
            $connection = collect($discord->userConnections($discordUser->token))
                ->first(fn (array $connection) => in_array($connection['type'] ?? '', ['twitter', 'x'], true));
        } catch (Throwable) {
            return null;
        }

        if (! $connection) {
            return null;
        }

        return ltrim((string) ($connection['name'] ?? $connection['id'] ?? ''), '@') ?: null;
    }
}
