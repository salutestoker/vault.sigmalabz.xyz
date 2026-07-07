import { type GalleryMedia } from '@/types/gallery';
import { Link } from '@inertiajs/react';
import { ExternalLink, X } from 'lucide-react';
import { useEffect } from 'react';

interface MediaLightboxProps {
    media: GalleryMedia | null;
    onClose: () => void;
}

export default function MediaLightbox({ media, onClose }: MediaLightboxProps) {
    useEffect(() => {
        if (!media) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [media, onClose]);

    if (!media) {
        return null;
    }

    return (
        <div className="vault-gallery__lightbox" role="dialog" aria-modal>
            <button
                type="button"
                className="vault-gallery__lightbox-backdrop"
                aria-label="Close media viewer"
                onClick={onClose}
            />

            <div className="vault-gallery__lightbox-panel">
                <button
                    type="button"
                    className="vault-gallery__lightbox-close"
                    aria-label="Close"
                    onClick={onClose}
                >
                    <X className="size-6" aria-hidden="true" />
                </button>

                <div className="vault-gallery__lightbox-media">
                    {media.type === 'video' ? (
                        <video
                            src={media.media_url ?? undefined}
                            poster={media.thumbnail_url ?? undefined}
                            controls
                            autoPlay
                        />
                    ) : (
                        <img src={media.media_url ?? ''} alt={media.title} />
                    )}
                </div>

                <aside className="vault-gallery__lightbox-details">
                    <h2>{media.title}</h2>
                    {media.description && <p>{media.description}</p>}

                    {media.creator && (
                        <span className="vault-gallery__detail-chip">
                            {media.creator.preferred_handle}
                        </span>
                    )}

                    {media.category && (
                        <span className="vault-gallery__detail-chip">
                            {media.category.name}
                        </span>
                    )}

                    {media.tags && media.tags.length > 0 && (
                        <div className="vault-gallery__tag-list">
                            {media.tags.slice(0, 12).map((tag) => (
                                <span key={tag}>{tag}</span>
                            ))}
                        </div>
                    )}

                    {media.source.message_url && (
                        <Link
                            href={media.source.message_url}
                            className="vault-gallery__source-link"
                        >
                            Discord Source
                            <ExternalLink
                                className="size-4"
                                aria-hidden="true"
                            />
                        </Link>
                    )}
                </aside>
            </div>
        </div>
    );
}
