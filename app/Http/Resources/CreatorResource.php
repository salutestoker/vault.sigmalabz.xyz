<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CreatorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'display_name' => $this->display_name,
            'twitter_handle' => $this->twitter_handle,
            'discord_username' => $this->discord_username,
            'preferred_handle' => $this->preferred_handle,
            'profile_image_url' => $this->profile_image_url,
            'is_verified' => $this->is_verified,
            'media_count' => $this->when(isset($this->media_count), $this->media_count),
        ];
    }
}
