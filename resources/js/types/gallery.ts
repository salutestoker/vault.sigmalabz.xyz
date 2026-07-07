export interface GalleryCategory {
    id?: number;
    slug: string;
    name: string;
}

export interface GalleryCreator {
    id: number;
    display_name: string;
    twitter_handle?: string | null;
    discord_username?: string | null;
    preferred_handle: string;
    profile_image_url?: string | null;
    is_verified?: boolean;
    media_count?: number;
}

export interface GalleryColor {
    hex: string;
    count?: number;
    name?: string | null;
    percentage?: number;
}

export interface GalleryMedia {
    id: number;
    type: 'image' | 'video';
    status: string;
    visibility: string;
    title: string;
    description?: string | null;
    media_url?: string | null;
    thumbnail_url?: string | null;
    preview_url?: string | null;
    mime_type?: string | null;
    width?: number | null;
    height?: number | null;
    duration_seconds?: string | number | null;
    dominant_color?: string | null;
    favorites_count: number;
    is_favorited: boolean;
    source: {
        provider: string;
        channel_name?: string | null;
        message_url?: string | null;
        created_at?: string | null;
    };
    category?: GalleryCategory | null;
    creator?: GalleryCreator | null;
    tags?: string[];
    colors?: GalleryColor[];
}

export interface PaginationMeta {
    current_page: number;
    from?: number | null;
    last_page: number;
    path: string;
    per_page: number;
    to?: number | null;
    total: number;
}

export interface PaginatedResource<T> {
    data: T[];
    meta: PaginationMeta;
    links?: Record<string, string | null>;
}

export interface GalleryFilters {
    search: string;
    category: string;
    creator: number | null;
    color: string;
    favorites: boolean;
}
