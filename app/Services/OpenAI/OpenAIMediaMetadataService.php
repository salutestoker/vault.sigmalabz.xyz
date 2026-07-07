<?php

namespace App\Services\OpenAI;

use App\Models\GalleryMedia;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class OpenAIMediaMetadataService
{
    /**
     * @return array<string, mixed>|null
     */
    public function analyze(GalleryMedia $media): ?array
    {
        $apiKey = config('gallery.ai.openai_api_key');

        if (! config('gallery.ai.enabled') || ! $apiKey) {
            return null;
        }

        $imageData = $this->imageData($media);

        if (! $imageData) {
            return null;
        }

        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->timeout(120)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => config('gallery.ai.openai_model'),
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You generate concise JSON metadata for a visual media gallery. Return accurate searchable visual metadata only.',
                    ],
                    [
                        'role' => 'user',
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => 'Analyze this gallery media thumbnail. Return JSON with a short title, description, search tags, visible objects/scenes, dominant visual ideas, a likely category slug from sigma,aura,burnie,vegas,videos,pro-engine, and any safety notes.',
                            ],
                            [
                                'type' => 'image_url',
                                'image_url' => [
                                    'url' => $imageData,
                                ],
                            ],
                        ],
                    ],
                ],
                'response_format' => [
                    'type' => 'json_schema',
                    'json_schema' => [
                        'name' => 'gallery_media_metadata',
                        'strict' => true,
                        'schema' => [
                            'type' => 'object',
                            'additionalProperties' => false,
                            'properties' => [
                                'title' => ['type' => 'string'],
                                'description' => ['type' => 'string'],
                                'tags' => [
                                    'type' => 'array',
                                    'items' => ['type' => 'string'],
                                ],
                                'detected_objects' => [
                                    'type' => 'array',
                                    'items' => ['type' => 'string'],
                                ],
                                'scenes' => [
                                    'type' => 'array',
                                    'items' => ['type' => 'string'],
                                ],
                                'category_slug' => [
                                    'type' => 'string',
                                    'enum' => ['sigma', 'aura', 'burnie', 'vegas', 'videos', 'pro-engine'],
                                ],
                                'dominant_keywords' => [
                                    'type' => 'array',
                                    'items' => ['type' => 'string'],
                                ],
                                'safety_notes' => ['type' => 'string'],
                            ],
                            'required' => [
                                'title',
                                'description',
                                'tags',
                                'detected_objects',
                                'scenes',
                                'category_slug',
                                'dominant_keywords',
                                'safety_notes',
                            ],
                        ],
                    ],
                ],
            ])
            ->throw()
            ->json();

        $content = data_get($response, 'choices.0.message.content');

        if (! is_string($content)) {
            throw new RuntimeException('OpenAI response did not contain metadata content.');
        }

        $decoded = json_decode($content, true);

        if (! is_array($decoded)) {
            throw new RuntimeException('OpenAI metadata response was not valid JSON.');
        }

        return $decoded;
    }

    private function imageData(GalleryMedia $media): ?string
    {
        $path = $media->thumbnail_path ?: $media->media_path;

        if (! $path) {
            return $media->thumbnail_url ?: $media->media_url;
        }

        $disk = Storage::disk(config('gallery.media_disk'));

        if (! $disk->exists($path)) {
            return $media->thumbnail_url ?: $media->media_url;
        }

        $mime = $media->mime_type;

        if ($media->thumbnail_path) {
            $mime = 'image/jpeg';
        }

        return 'data:'.($mime ?: 'image/jpeg').';base64,'.base64_encode($disk->get($path));
    }
}
