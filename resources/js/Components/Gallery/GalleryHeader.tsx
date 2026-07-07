import { type User } from '@/types';
import { Link } from '@inertiajs/react';
import { Gauge } from 'lucide-react';

interface GalleryHeaderProps {
    user: User | null;
}

export default function GalleryHeader({ user }: GalleryHeaderProps) {
    return (
        <header className="vault-gallery__header">
            <Link href={route('home')} className="vault-gallery__logo-link">
                <img
                    src="/images/sigma-vault-logo.png"
                    alt="$SIGMA VAULT"
                    className="vault-gallery__logo"
                />
            </Link>

            <div className="vault-gallery__actions">
                {user?.role === 'admin' && (
                    <Link
                        href={route('admin.dashboard')}
                        className="vault-gallery__top-action"
                    >
                        <Gauge className="size-4" aria-hidden="true" />
                        Admin
                    </Link>
                )}
                {/*
                {user ? (
                    <Link
                        href={route('profile.edit')}
                        className="vault-gallery__top-action"
                    >
                        {user.display_name || user.name}
                    </Link>
                ) : (
                    <Link
                        href={route('auth.discord.redirect')}
                        className="vault-gallery__top-action"
                    >
                        <LogIn className="size-4" aria-hidden="true" />
                        Discord Login
                    </Link>
                )}
                */}
            </div>
        </header>
    );
}
