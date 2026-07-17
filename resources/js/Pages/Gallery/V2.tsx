import CategoryTabs from '@/Components/Gallery/CategoryTabs';
import GalleryEmptyState from '@/Components/Gallery/GalleryEmptyState';
import GalleryHeader from '@/Components/Gallery/GalleryHeader';
import GallerySkeleton from '@/Components/Gallery/GallerySkeleton';
import GalleryV2Scene, {
    type GalleryV2SceneHandle,
} from '@/Components/Gallery/GalleryV2Scene';
import MediaGrid from '@/Components/Gallery/MediaGrid';
import MediaLightbox from '@/Components/Gallery/MediaLightbox';
import Toast, { useToast } from '@/Components/Toast';
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
const DEFAULT_CATEGORY = 'all';
const CATEGORY_QUERY_PARAM = 'category';

const mediaSignature = (media: GalleryMedia[]) =>
    media
        .map(
            (item) =>
                `${item.id}:${item.type}:${item.media_url ?? ''}:${item.preview_url ?? ''}:${item.thumbnail_url ?? ''}`,
        )
        .join('|');

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
    const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(
        null,
    );
    const { showToast: showClipboardToast, toast: clipboardToast } = useToast();
    const didMountRef = useRef(false);
    const fetchRequestRef = useRef(0);
    const filterRevisionRef = useRef(0);
    const mediaSignatureRef = useRef(mediaSignature(initialMedia.data));
    const sceneRef = useRef<GalleryV2SceneHandle | null>(null);

    const serializedFilters = useMemo(() => JSON.stringify(filters), [filters]);
    const selectedMedia =
        selectedMediaIndex === null
            ? null
            : (media[selectedMediaIndex] ?? null);

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

    const handleMediaClick = useCallback(
        (selectedMedia: GalleryMedia) => {
            const nextIndex = media.findIndex(
                (item) => item.id === selectedMedia.id,
            );

            if (nextIndex >= 0) {
                setSelectedMediaIndex(nextIndex);
            }
        },
        [media],
    );

    const handleCategoryChange = useCallback(
        (category: string) => {
            writeCategoryToUrl(category);
            setSelectedMediaIndex(null);

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

            setSelectedMediaIndex(null);
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

            <Toast toast={clipboardToast} />

            <MediaLightbox
                media={selectedMedia}
                items={media}
                selectedIndex={selectedMediaIndex}
                onSelectIndex={setSelectedMediaIndex}
                onClose={() => setSelectedMediaIndex(null)}
                onStatus={showClipboardToast}
            />
        </main>
    );
}
