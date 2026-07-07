export interface User {
    id: number;
    name: string;
    display_name?: string | null;
    email: string;
    email_verified_at?: string;
    role?: 'admin' | 'creator' | 'standard';
    twitter_handle?: string | null;
    discord_id?: string | null;
    discord_username?: string | null;
    discord_avatar_url?: string | null;
    profile_image_url?: string | null;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User | null;
    };
    flash?: {
        success?: string;
        error?: string;
    };
};
