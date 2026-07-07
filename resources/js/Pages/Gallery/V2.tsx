import CategoryTabs from '@/Components/Gallery/CategoryTabs';
import GalleryEmptyState from '@/Components/Gallery/GalleryEmptyState';
import GalleryHeader from '@/Components/Gallery/GalleryHeader';
import GallerySkeleton from '@/Components/Gallery/GallerySkeleton';
import GalleryV2Scene, {
    type GalleryV2SceneHandle,
} from '@/Components/Gallery/GalleryV2Scene';
import MediaGrid from '@/Components/Gallery/MediaGrid';
import { type PageProps } from '@/types';
import {
    type GalleryCategory,
    type GalleryFilters,
    type GalleryMedia,
    type PaginatedResource,
} from '@/types/gallery';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const GALLERY_V2_PAGE_SIZE = 100;
const CLIPBOARD_TOAST_DURATION = 2400;
const DEFAULT_CATEGORY = 'all';
const CATEGORY_QUERY_PARAM = 'category';

const mediaSignature = (media: GalleryMedia[]) =>
    media
        .map(
            (item) =>
                `${item.id}:${item.type}:${item.media_url ?? ''}:${item.preview_url ?? ''}:${item.thumbnail_url ?? ''}`,
        )
        .join('|');

type ClipboardItemConstructor = {
    new (items: Record<string, Blob>): ClipboardItem;
    supports?: (type: string) => boolean;
};

const canvasToPngBlob = async (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }

            reject(new Error('Unable to prepare image clipboard data.'));
        }, 'image/png');
    });

const imageBlobToPng = async (blob: Blob): Promise<Blob> => {
    const objectUrl = URL.createObjectURL(blob);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = () =>
                reject(new Error('Unable to load image clipboard data.'));
            element.src = objectUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('Unable to prepare image clipboard data.');
        }

        context.drawImage(image, 0, 0);

        return await canvasToPngBlob(canvas);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

const fetchMediaClipboardBlob = async (media: GalleryMedia): Promise<Blob> => {
    const response = await fetch(route('gallery.media.clipboard', media.id), {
        headers: {
            Accept: media.type === 'image' ? 'image/*' : 'video/*',
        },
    });

    if (!response.ok) {
        throw new Error('Unable to fetch media clipboard data.');
    }

    return await response.blob();
};

const copyBlobToClipboard = async (blob: Blob, mimeType: string) => {
    const clipboard = window.navigator.clipboard;
    const ClipboardItemClass = window.ClipboardItem as
        | ClipboardItemConstructor
        | undefined;

    if (!clipboard?.write || !ClipboardItemClass) {
        throw new Error(
            'This browser does not support media clipboard writes.',
        );
    }

    if (ClipboardItemClass.supports && !ClipboardItemClass.supports(mimeType)) {
        throw new Error(`This browser cannot copy ${mimeType} media.`);
    }

    await clipboard.write([new ClipboardItemClass({ [mimeType]: blob })]);
};

const copyMediaToClipboard = async (media: GalleryMedia) => {
    const blob = await fetchMediaClipboardBlob(media);

    if (media.type === 'image') {
        await copyBlobToClipboard(await imageBlobToPng(blob), 'image/png');
        return;
    }

    const mimeType = blob.type || media.mime_type || 'video/mp4';

    await copyBlobToClipboard(blob, mimeType);
};

const categoryExists = (categories: GalleryCategory[], category: string) =>
    categories.some((item) => item.slug === category);

const categoryFromCurrentUrl = (
    categories: GalleryCategory[],
    fallback = DEFAULT_CATEGORY,
) => {
    if (typeof window === 'undefined') {
        return fallback;
    }

    const params = new URLSearchParams(window.location.search);
    const category = params.get(CATEGORY_QUERY_PARAM) || DEFAULT_CATEGORY;

    return categoryExists(categories, category) ? category : fallback;
};

const galleryUrlForCategory = (category: string) => {
    const url = new URL(window.location.href);

    if (category === DEFAULT_CATEGORY) {
        url.searchParams.delete(CATEGORY_QUERY_PARAM);
    } else {
        url.searchParams.set(CATEGORY_QUERY_PARAM, category);
    }

    return `${url.pathname}${url.search}${url.hash}`;
};

const writeCategoryToUrl = (category: string, replace = false) => {
    if (typeof window === 'undefined') {
        return;
    }

    const nextUrl = galleryUrlForCategory(category);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl === currentUrl) {
        return;
    }

    if (replace) {
        window.history.replaceState(
            window.history.state,
            document.title,
            nextUrl,
        );
        return;
    }

    window.history.pushState(window.history.state, document.title, nextUrl);
};

interface GalleryV2Props extends PageProps {
    initialMedia: PaginatedResource<GalleryMedia>;
    filters: GalleryFilters;
    categories: GalleryCategory[];
}

export default function GalleryV2({
    auth,
    categories,
    filters: initialFilters,
    initialMedia,
}: GalleryV2Props) {
    const [filters, setFilters] = useState<GalleryFilters>({
        ...initialFilters,
        category: initialFilters.category || 'all',
    });
    const [media, setMedia] = useState(initialMedia.data);
    const [isLoading, setIsLoading] = useState(false);
    const [clipboardToast, setClipboardToast] = useState<string | null>(null);
    const didMountRef = useRef(false);
    const fetchRequestRef = useRef(0);
    const filterRevisionRef = useRef(0);
    const mediaSignatureRef = useRef(mediaSignature(initialMedia.data));
    const sceneRef = useRef<GalleryV2SceneHandle | null>(null);
    const clipboardToastTimeoutRef = useRef<number | null>(null);

    const serializedFilters = useMemo(() => JSON.stringify(filters), [filters]);

    const updateFilters = useCallback(
        (
            nextFilters:
                | GalleryFilters
                | ((current: GalleryFilters) => GalleryFilters),
        ) => {
            setFilters((current) => {
                const next =
                    typeof nextFilters === 'function'
                        ? nextFilters(current)
                        : nextFilters;

                if (next === current) {
                    return current;
                }

                filterRevisionRef.current += 1;

                return next;
            });
        },
        [],
    );

    const fetchMedia = useCallback(async () => {
        const requestId = fetchRequestRef.current + 1;
        const requestRevision = filterRevisionRef.current;
        fetchRequestRef.current = requestId;
        setIsLoading(true);
        const transitionOut =
            sceneRef.current?.transitionOut() ?? Promise.resolve();

        try {
            const [response] = await Promise.all([
                axios.get<PaginatedResource<GalleryMedia>>(
                    route('gallery.media.index'),
                    {
                        params: {
                            ...filters,
                            creator: filters.creator || undefined,
                            color: filters.color || undefined,
                            search: filters.search || undefined,
                            favorites: filters.favorites ? 1 : undefined,
                            per_page: GALLERY_V2_PAGE_SIZE,
                            page: 1,
                        },
                    },
                ),
                transitionOut,
            ]);

            if (
                fetchRequestRef.current !== requestId ||
                filterRevisionRef.current !== requestRevision
            ) {
                return;
            }

            const nextMedia = response.data.data.slice(0, GALLERY_V2_PAGE_SIZE);
            const nextMediaSignature = mediaSignature(nextMedia);
            const isSameScene =
                nextMediaSignature === mediaSignatureRef.current;

            mediaSignatureRef.current = nextMediaSignature;
            setMedia(nextMedia);

            if (isSameScene) {
                void sceneRef.current?.transitionIn();
            }
        } catch (error) {
            if (
                fetchRequestRef.current === requestId &&
                filterRevisionRef.current === requestRevision
            ) {
                void sceneRef.current?.transitionIn();
                console.error('Unable to load gallery media.', error);
            }
        } finally {
            if (
                fetchRequestRef.current === requestId &&
                filterRevisionRef.current === requestRevision
            ) {
                setIsLoading(false);
            }
        }
    }, [filters]);

    const showClipboardToast = useCallback((message: string) => {
        if (clipboardToastTimeoutRef.current) {
            window.clearTimeout(clipboardToastTimeoutRef.current);
        }

        setClipboardToast(message);
        clipboardToastTimeoutRef.current = window.setTimeout(() => {
            setClipboardToast(null);
            clipboardToastTimeoutRef.current = null;
        }, CLIPBOARD_TOAST_DURATION);
    }, []);

    const handleMediaClick = useCallback(
        async (media: GalleryMedia) => {
            try {
                await copyMediaToClipboard(media);
                showClipboardToast(`${media.type} copied to clipboard.`);
            } catch (error) {
                console.error('Unable to copy gallery media.', error);
                showClipboardToast(`Unable to copy ${media.type}.`);
            }
        },
        [showClipboardToast],
    );

    const handleCategoryChange = useCallback(
        (category: string) => {
            writeCategoryToUrl(category);

            updateFilters((current) =>
                current.category === category
                    ? current
                    : { ...current, category },
            );
        },
        [updateFilters],
    );

    useEffect(() => {
        writeCategoryToUrl(filters.category, true);
    }, [filters.category]);

    useEffect(() => {
        const handlePopState = () => {
            const category = categoryFromCurrentUrl(
                categories,
                DEFAULT_CATEGORY,
            );

            updateFilters((current) =>
                current.category === category
                    ? current
                    : { ...current, category },
            );
        };

        window.addEventListener('popstate', handlePopState);

        return () => window.removeEventListener('popstate', handlePopState);
    }, [categories, updateFilters]);

    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }

        const timeout = window.setTimeout(() => {
            void fetchMedia();
        }, 240);

        return () => window.clearTimeout(timeout);
    }, [serializedFilters, fetchMedia]);

    useEffect(() => {
        return () => {
            if (clipboardToastTimeoutRef.current) {
                window.clearTimeout(clipboardToastTimeoutRef.current);
            }
        };
    }, []);

    return (
        <main className="vault-gallery vault-gallery--v2">
            <Head title="Gallery" />

            <GalleryHeader user={auth.user} />

            <div className="vault-gallery__shell">
                <CategoryTabs
                    categories={categories}
                    active={filters.category}
                    onChange={handleCategoryChange}
                />

                {isLoading && media.length === 0 ? (
                    <GallerySkeleton />
                ) : media.length > 0 ? (
                    <GalleryV2Scene
                        ref={sceneRef}
                        media={media}
                        isLoading={isLoading}
                        onOpen={handleMediaClick}
                        fallback={
                            <MediaGrid
                                media={media}
                                onOpen={handleMediaClick}
                            />
                        }
                    />
                ) : (
                    <GalleryEmptyState />
                )}
            </div>

            {clipboardToast && (
                <div
                    className="vault-gallery__clipboard-toast"
                    role="status"
                    aria-live="polite"
                >
                    {clipboardToast}
                </div>
            )}
        </main>
    );
}
