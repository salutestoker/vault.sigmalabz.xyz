import Toast, { useToast } from '@/Components/Toast';
import {
    canAttemptNativeFileShare,
    copyMediaToClipboard,
    shareMediaFile,
} from '@/lib/galleryClipboard';
import { type GalleryMedia } from '@/types/gallery';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';

interface MediaLightboxProps {
    media: GalleryMedia | null;
    items?: GalleryMedia[];
    selectedIndex?: number | null;
    onSelectIndex?: (index: number) => void;
    onClose: () => void;
    onStatus?: (message: string) => void;
}

const LIGHTBOX_STATUS_DURATION = 2400;
const LIGHTBOX_EXIT_DURATION = 180;
const SIGMA_VAULT_SHARE_URL = 'https://vault.sigmalabz.xyz';
const SIGMA_VAULT_X_HANDLE = '@SigmaOnXRPL';

type LightboxMediaStyle = CSSProperties & {
    '--lightbox-media-aspect-ratio'?: string;
    '--lightbox-media-height'?: string;
    '--lightbox-media-width'?: string;
};

const mediaDisplayUrl = (media: GalleryMedia): string | null =>
    media.media_url ?? media.thumbnail_url ?? media.preview_url ?? null;

const mediaDimensionsStyle = (media: GalleryMedia): LightboxMediaStyle => {
    const style: LightboxMediaStyle = {};
    const hasMeasuredSize =
        Boolean(media.width && media.width > 0) &&
        Boolean(media.height && media.height > 0);

    style['--lightbox-media-aspect-ratio'] = hasMeasuredSize
        ? `${media.width} / ${media.height}`
        : '1 / 1';

    if (media.width && media.width > 0) {
        style['--lightbox-media-width'] = `${media.width}px`;
    }

    if (media.height && media.height > 0) {
        style['--lightbox-media-height'] = `${media.height}px`;
    }

    return style;
};

const xHandle = (handle?: string | null): string | null => {
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

    return normalized || null;
};

const xProfileUrl = (handle?: string | null): string | null => {
    const normalized = xHandle(handle);

    return normalized ? `https://x.com/${normalized}` : null;
};

const xCreatorCredit = (media: GalleryMedia): string | null => {
    const creatorHandle = xHandle(media.creator?.twitter_handle);

    if (creatorHandle) {
        return `created by @${creatorHandle}`;
    }

    const creatorName = media.creator?.display_name?.trim();

    return creatorName ? `created by ${creatorName}` : null;
};

const xPostText = (media: GalleryMedia): string => {
    return ['Straight from the SIGMA VAULT', xCreatorCredit(media)]
        .filter(Boolean)
        .join(' - ')
        .concat(` | ${SIGMA_VAULT_X_HANDLE} ${SIGMA_VAULT_SHARE_URL}`);
};

const xIntentUrl = (media: GalleryMedia): string => {
    const url = new URL('https://x.com/intent/tweet');

    url.searchParams.set('text', xPostText(media));

    return url.toString();
};

const isShareAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === 'AbortError';

export default function MediaLightbox({
    media,
    items = [],
    selectedIndex = null,
    onClose,
    onSelectIndex,
    onStatus,
}: MediaLightboxProps) {
    const [isCopying, setIsCopying] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [mediaReadyKey, setMediaReadyKey] = useState<string | null>(null);
    const [exitingMedia, setExitingMedia] = useState<GalleryMedia | null>(null);
    const { showToast: showLocalToast, toast: localToast } = useToast(
        LIGHTBOX_STATUS_DURATION,
    );
    const collection = items.length > 0 ? items : media ? [media] : [];
    const fallbackIndex =
        media && collection.length > 0
            ? collection.findIndex((item) => item.id === media.id)
            : -1;
    const currentActiveIndex =
        selectedIndex !== null && selectedIndex >= 0
            ? selectedIndex
            : fallbackIndex >= 0
              ? fallbackIndex
              : media
                ? 0
                : -1;
    const currentActiveMedia =
        currentActiveIndex >= 0
            ? (collection[currentActiveIndex] ?? null)
            : media;
    const activeMedia = currentActiveMedia ?? exitingMedia;
    const isClosing = !currentActiveMedia && Boolean(exitingMedia);
    const canNavigate =
        Boolean(currentActiveMedia) &&
        collection.length > 1 &&
        currentActiveIndex >= 0 &&
        Boolean(onSelectIndex);
    const creatorName = activeMedia?.creator?.display_name;
    const creatorProfileUrl = xProfileUrl(activeMedia?.creator?.twitter_handle);
    const activeMediaUrl = activeMedia ? mediaDisplayUrl(activeMedia) : null;
    const activeMediaKey = activeMedia
        ? [
              activeMedia.id,
              activeMedia.type,
              activeMedia.media_url ?? '',
              activeMedia.thumbnail_url ?? '',
              activeMedia.preview_url ?? '',
          ].join(':')
        : null;
    const isMediaReady =
        Boolean(activeMediaKey) &&
        (!activeMediaUrl || mediaReadyKey === activeMediaKey);
    const lightboxClassName = [
        'vault-gallery__lightbox',
        isClosing ? 'is-closing' : null,
        creatorName ? 'has-credit' : null,
    ]
        .filter(Boolean)
        .join(' ');

    const showStatus = useCallback(
        (message: string) => {
            if (onStatus) {
                onStatus(message);
                return;
            }

            showLocalToast(message);
        },
        [onStatus, showLocalToast],
    );

    const handleRequestClose = useCallback(() => {
        if (currentActiveMedia) {
            setExitingMedia(currentActiveMedia);
        }

        onClose();
    }, [currentActiveMedia, onClose]);

    const selectOffset = useCallback(
        (offset: number) => {
            if (!canNavigate || !onSelectIndex) {
                return;
            }

            const nextIndex =
                (currentActiveIndex + offset + collection.length) %
                collection.length;

            onSelectIndex(nextIndex);
        },
        [currentActiveIndex, canNavigate, collection.length, onSelectIndex],
    );

    const handleCopy = useCallback(async () => {
        if (!activeMedia || isCopying) {
            return;
        }

        setIsCopying(true);

        try {
            const result = await copyMediaToClipboard(activeMedia);
            showStatus(
                result.kind === 'link'
                    ? `${activeMedia.type} link copied to clipboard.`
                    : `${activeMedia.type} copied to clipboard.`,
            );
        } catch (error) {
            console.error('Unable to copy gallery media.', error);
            showStatus(`Unable to copy ${activeMedia.type}.`);
        } finally {
            setIsCopying(false);
        }
    }, [activeMedia, isCopying, showStatus]);

    const handlePost = useCallback(async () => {
        if (!activeMedia || isPosting) {
            return;
        }

        setIsPosting(true);

        try {
            if (canAttemptNativeFileShare()) {
                try {
                    const result = await shareMediaFile(
                        activeMedia,
                        xPostText(activeMedia),
                    );

                    if (result.kind === 'shared') {
                        showStatus('Share sheet opened with media.');
                        return;
                    }
                } catch (error) {
                    if (isShareAbortError(error)) {
                        return;
                    }

                    console.error(
                        'Unable to share gallery media directly.',
                        error,
                    );
                }
            }

            const popup = window.open(xIntentUrl(activeMedia), '_blank');

            if (!popup) {
                showStatus('Unable to open X.');
                return;
            }

            popup.opener = null;

            try {
                const result = await copyMediaToClipboard(activeMedia);

                showStatus(
                    result.kind === 'link'
                        ? 'X opened. Video link copied; attach the video in X.'
                        : 'X opened. Media copied; paste it into the composer.',
                );
            } catch (error) {
                console.error(
                    'Unable to copy gallery media before posting.',
                    error,
                );
                showStatus('X opened. Attach the media before posting.');
            }
        } finally {
            setIsPosting(false);
        }
    }, [activeMedia, isPosting, showStatus]);

    useEffect(() => {
        if (!isClosing) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setIsCopying(false);
            setIsPosting(false);
            setExitingMedia(null);
        }, LIGHTBOX_EXIT_DURATION);

        return () => window.clearTimeout(timeout);
    }, [isClosing]);

    useEffect(() => {
        if (!currentActiveMedia) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleRequestClose();
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
    }, [currentActiveMedia, handleRequestClose, selectOffset]);

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

    const handleMediaReady = useCallback(() => {
        setMediaReadyKey(activeMediaKey);
    }, [activeMediaKey]);

    if (!activeMedia) {
        return null;
    }

    return (
        <div
            className={lightboxClassName}
            role="dialog"
            aria-label="Media viewer"
            aria-modal
        >
            <button
                type="button"
                className="vault-gallery__lightbox-backdrop"
                aria-label="Close media viewer"
                onClick={handleRequestClose}
            />

            <button
                type="button"
                className="vault-gallery__lightbox-close"
                aria-label="Close media viewer"
                onClick={handleRequestClose}
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
                <div className="vault-gallery__lightbox-actions">
                    <button
                        type="button"
                        className="vault-gallery__lightbox-action"
                        disabled={isPosting}
                        onClick={() => void handlePost()}
                    >
                        <span>{isPosting ? 'Sharing' : 'Share'}</span>
                        <img src="/images/icon-share.png" alt="" aria-hidden />
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
                    <div
                        key={activeMediaKey}
                        className="vault-gallery__lightbox-media"
                        aria-busy={!isMediaReady}
                        data-ready={isMediaReady ? 'true' : 'false'}
                        style={mediaDimensionsStyle(activeMedia)}
                    >
                        {activeMedia.type === 'video' &&
                        activeMedia.media_url ? (
                            <video
                                src={activeMedia.media_url}
                                poster={activeMedia.thumbnail_url ?? undefined}
                                width={activeMedia.width ?? undefined}
                                height={activeMedia.height ?? undefined}
                                controls
                                autoPlay
                                onError={handleMediaReady}
                                onLoadedData={handleMediaReady}
                                playsInline
                            />
                        ) : activeMediaUrl ? (
                            <img
                                src={activeMediaUrl}
                                alt={activeMedia.title}
                                width={activeMedia.width ?? undefined}
                                height={activeMedia.height ?? undefined}
                                onError={handleMediaReady}
                                onLoad={handleMediaReady}
                            />
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

                <Toast toast={localToast} />
            </section>
        </div>
    );
}
