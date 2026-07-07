import { type GalleryMedia } from '@/types/gallery';
import { Play } from 'lucide-react';

interface MediaCardProps {
    media: GalleryMedia;
    onOpen: (media: GalleryMedia) => void;
}

export default function MediaCard({ media, onOpen }: MediaCardProps) {
    const sourceUrl =
        media.media_url ?? media.thumbnail_url ?? media.preview_url;
    const aspectRatio =
        media.width && media.height
            ? `${media.width} / ${media.height}`
            : undefined;

    return (
        <article className="vault-gallery__media-card">
            <button
                type="button"
                className="vault-gallery__media-open"
                style={{ aspectRatio }}
                onClick={() => onOpen(media)}
            >
                {media.type === 'video' && media.media_url ? (
                    <video
                        src={media.media_url}
                        poster={media.thumbnail_url ?? undefined}
                        muted
                        playsInline
                        preload="metadata"
                    />
                ) : sourceUrl ? (
                    <img
                        src={sourceUrl}
                        alt={media.title}
                        width={media.width ?? undefined}
                        height={media.height ?? undefined}
                        loading="lazy"
                    />
                ) : (
                    <span className="vault-gallery__media-placeholder">
                        {media.title}
                    </span>
                )}

                {media.type === 'video' && (
                    <span className="vault-gallery__play">
                        <Play className="size-6" aria-hidden="true" />
                    </span>
                )}
            </button>
        </article>
    );
}
