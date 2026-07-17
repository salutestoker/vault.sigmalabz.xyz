import { copyMediaToClipboard } from '@/lib/galleryClipboard';
import { type GalleryMedia } from '@/types/gallery';
import { useCallback, useEffect, useRef, useState } from 'react';

interface MediaLightboxProps {
    media: GalleryMedia | null;
    items?: GalleryMedia[];
    selectedIndex?: number | null;
    onSelectIndex?: (index: number) => void;
    onClose: () => void;
    onStatus?: (message: string) => void;
}

const LIGHTBOX_STATUS_DURATION = 2400;

const mediaDisplayUrl = (media: GalleryMedia): string | null =>
    media.media_url ?? media.thumbnail_url ?? media.preview_url ?? null;

const xProfileUrl = (handle?: string | null): string | null => {
    if (!handle) {
        return null;
    }

    let normalized = handle.trim().replace(/^@+/, '');
    const profileMatch = normalized.match(
        /(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i,
    );

    if (profileMatch?.[1]) {
        normalized = profileMatch[1];
    }

    normalized = normalized.replace(/[^A-Za-z0-9_]/g, '');

    return normalized ? `https://x.com/${normalized}` : null;
};

const publicAssetUrl = (media: GalleryMedia): string => {
    const assetPath = route('gallery.media.asset', media.id);

    return new URL(assetPath, window.location.origin).toString();
};

const xIntentUrl = (media: GalleryMedia): string => {
    const url = new URL('https://x.com/intent/tweet');
    const creatorName = media.creator?.display_name;
    const text = [
        media.title,
        creatorName ? `created by ${creatorName}` : null,
        '$SIGMA VAULT',
    ]
        .filter(Boolean)
        .join(' - ');

    url.searchParams.set('text', text);
    url.searchParams.set('url', publicAssetUrl(media));

    return url.toString();
};

export default function MediaLightbox({
    media,
    items = [],
    selectedIndex = null,
    onClose,
    onSelectIndex,
    onStatus,
}: MediaLightboxProps) {
    const [isCopying, setIsCopying] = useState(false);
    const [localStatus, setLocalStatus] = useState<string | null>(null);
    const localStatusTimeoutRef = useRef<number | null>(null);
    const collection = items.length > 0 ? items : media ? [media] : [];
    const fallbackIndex =
        media && collection.length > 0
            ? collection.findIndex((item) => item.id === media.id)
            : -1;
    const activeIndex =
        selectedIndex !== null && selectedIndex >= 0
            ? selectedIndex
            : fallbackIndex >= 0
              ? fallbackIndex
              : media
                ? 0
                : -1;
    const activeMedia = activeIndex >= 0 ? collection[activeIndex] : media;
    const canNavigate =
        collection.length > 1 && activeIndex >= 0 && Boolean(onSelectIndex);
    const creatorName = activeMedia?.creator?.display_name;
    const creatorProfileUrl = xProfileUrl(activeMedia?.creator?.twitter_handle);
    const activeMediaUrl = activeMedia ? mediaDisplayUrl(activeMedia) : null;

    const showStatus = useCallback(
        (message: string) => {
            if (onStatus) {
                onStatus(message);
                return;
            }

            if (localStatusTimeoutRef.current) {
                window.clearTimeout(localStatusTimeoutRef.current);
            }

            setLocalStatus(message);
            localStatusTimeoutRef.current = window.setTimeout(() => {
                setLocalStatus(null);
                localStatusTimeoutRef.current = null;
            }, LIGHTBOX_STATUS_DURATION);
        },
        [onStatus],
    );

    const selectOffset = useCallback(
        (offset: number) => {
            if (!canNavigate || !onSelectIndex) {
                return;
            }

            const nextIndex =
                (activeIndex + offset + collection.length) % collection.length;

            onSelectIndex(nextIndex);
        },
        [activeIndex, canNavigate, collection.length, onSelectIndex],
    );

    const handleCopy = useCallback(async () => {
        if (!activeMedia || isCopying) {
            return;
        }

        setIsCopying(true);

        try {
            await copyMediaToClipboard(activeMedia);
            showStatus(`${activeMedia.type} copied to clipboard.`);
        } catch (error) {
            console.error('Unable to copy gallery media.', error);
            showStatus(`Unable to copy ${activeMedia.type}.`);
        } finally {
            setIsCopying(false);
        }
    }, [activeMedia, isCopying, showStatus]);

    const handlePost = useCallback(() => {
        if (!activeMedia) {
            return;
        }

        const popup = window.open(xIntentUrl(activeMedia), '_blank');

        if (!popup) {
            showStatus('Unable to open X.');
            return;
        }

        popup.opener = null;
    }, [activeMedia, showStatus]);

    useEffect(() => {
        if (!activeMedia) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                selectOffset(-1);
                return;
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                selectOffset(1);
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeMedia, onClose, selectOffset]);

    useEffect(() => {
        if (!activeMedia) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [activeMedia]);

    useEffect(() => {
        return () => {
            if (localStatusTimeoutRef.current) {
                window.clearTimeout(localStatusTimeoutRef.current);
            }
        };
    }, []);

    if (!activeMedia) {
        return null;
    }

    return (
        <div
            className="vault-gallery__lightbox"
            role="dialog"
            aria-label="Media viewer"
            aria-modal
        >
            <button
                type="button"
                className="vault-gallery__lightbox-backdrop"
                aria-label="Close media viewer"
                onClick={onClose}
            />

            <button
                type="button"
                className="vault-gallery__lightbox-close"
                aria-label="Close media viewer"
                onClick={onClose}
            >
                <img src="/images/icon-close.png" alt="" aria-hidden="true" />
            </button>

            {canNavigate && (
                <button
                    type="button"
                    className="vault-gallery__lightbox-nav vault-gallery__lightbox-nav--previous"
                    aria-label="Previous media"
                    onClick={() => selectOffset(-1)}
                >
                    <img
                        src="/images/icon-chevron-left.png"
                        alt=""
                        aria-hidden="true"
                    />
                </button>
            )}

            {canNavigate && (
                <button
                    type="button"
                    className="vault-gallery__lightbox-nav vault-gallery__lightbox-nav--next"
                    aria-label="Next media"
                    onClick={() => selectOffset(1)}
                >
                    <img
                        src="/images/icon-chevron-right.png"
                        alt=""
                        aria-hidden="true"
                    />
                </button>
            )}

            <section className="vault-gallery__lightbox-stage">
                <img
                    src="/images/sigma-vault-logo.png"
                    alt="$SIGMA VAULT"
                    className="vault-gallery__lightbox-logo"
                />

                <div className="vault-gallery__lightbox-actions">
                    <button
                        type="button"
                        className="vault-gallery__lightbox-action"
                        onClick={handlePost}
                    >
                        <span>Post</span>
                        <img src="/images/icon-x.png" alt="" aria-hidden />
                    </button>

                    <button
                        type="button"
                        className="vault-gallery__lightbox-action"
                        disabled={isCopying}
                        onClick={() => void handleCopy()}
                    >
                        <span>{isCopying ? 'Copying' : 'Copy'}</span>
                        <img src="/images/icon-copy.png" alt="" aria-hidden />
                    </button>
                </div>

                <figure className="vault-gallery__lightbox-figure">
                    <div className="vault-gallery__lightbox-media">
                        {activeMedia.type === 'video' &&
                        activeMedia.media_url ? (
                            <video
                                key={activeMedia.id}
                                src={activeMedia.media_url}
                                poster={activeMedia.thumbnail_url ?? undefined}
                                controls
                                autoPlay
                                playsInline
                            />
                        ) : activeMediaUrl ? (
                            <img src={activeMediaUrl} alt={activeMedia.title} />
                        ) : (
                            <span className="vault-gallery__lightbox-placeholder">
                                {activeMedia.title}
                            </span>
                        )}
                    </div>

                    {creatorName && (
                        <figcaption className="vault-gallery__lightbox-credit">
                            <span>created by:</span>
                            {creatorProfileUrl ? (
                                <a
                                    href={creatorProfileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {creatorName}
                                </a>
                            ) : (
                                <strong>{creatorName}</strong>
                            )}
                        </figcaption>
                    )}
                </figure>

                {localStatus && (
                    <div
                        className="vault-gallery__lightbox-status"
                        role="status"
                        aria-live="polite"
                    >
                        {localStatus}
                    </div>
                )}
            </section>
        </div>
    );
}
