import CategoryTabs from '@/Components/Gallery/CategoryTabs';
import GalleryEmptyState from '@/Components/Gallery/GalleryEmptyState';
import GalleryFilterBar from '@/Components/Gallery/GalleryFilterBar';
import GalleryHeader from '@/Components/Gallery/GalleryHeader';
import GallerySkeleton from '@/Components/Gallery/GallerySkeleton';
import MediaGrid from '@/Components/Gallery/MediaGrid';
import MediaLightbox from '@/Components/Gallery/MediaLightbox';
import OrbitGalleryScene from '@/Components/Gallery/OrbitGalleryScene';
import { type PageProps } from '@/types';
import {
    type GalleryCategory,
    type GalleryColor,
    type GalleryCreator,
    type GalleryFilters,
    type GalleryMedia,
    type PaginatedResource,
} from '@/types/gallery';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const ORBIT_PAGE_SIZE = 48;
const ORBIT_MAX_MEDIA = 96;

interface GalleryIndexProps extends PageProps {
    initialMedia: PaginatedResource<GalleryMedia>;
    filters: GalleryFilters;
    categories: GalleryCategory[];
    creators: {
        data: GalleryCreator[];
    };
    colors: GalleryColor[];
}

export default function GalleryIndex({
    auth,
    categories,
    colors,
    creators,
    filters: initialFilters,
    initialMedia,
}: GalleryIndexProps) {
    const [filters, setFilters] = useState<GalleryFilters>({
        ...initialFilters,
        category: initialFilters.category || 'all',
    });
    const [media, setMedia] = useState(initialMedia.data);
    const [meta, setMeta] = useState(initialMedia.meta);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(
        null,
    );
    const didMountRef = useRef(false);

    const serializedFilters = useMemo(() => JSON.stringify(filters), [filters]);
    const selectedMedia =
        selectedMediaIndex === null
            ? null
            : (media[selectedMediaIndex] ?? null);

    const fetchMedia = useCallback(
        async (page = 1, append = false) => {
            setIsLoading(true);

            if (!append) {
                setMedia([]);
            }

            try {
                const response = await axios.get<
                    PaginatedResource<GalleryMedia>
                >(route('gallery.media.index'), {
                    params: {
                        ...filters,
                        creator: filters.creator || undefined,
                        color: filters.color || undefined,
                        search: filters.search || undefined,
                        favorites: filters.favorites ? 1 : undefined,
                        per_page: ORBIT_PAGE_SIZE,
                        page,
                    },
                });

                setMedia((current) =>
                    append
                        ? [...current, ...response.data.data].slice(
                              0,
                              ORBIT_MAX_MEDIA,
                          )
                        : response.data.data.slice(0, ORBIT_MAX_MEDIA),
                );
                setMeta(response.data.meta);
            } finally {
                setIsLoading(false);
            }
        },
        [filters],
    );

    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }

        const timeout = window.setTimeout(() => {
            void fetchMedia(1, false);
        }, 240);

        return () => window.clearTimeout(timeout);
    }, [serializedFilters, fetchMedia]);

    const hasMore =
        meta.current_page < meta.last_page && media.length < ORBIT_MAX_MEDIA;

    const loadMore = useCallback(() => {
        if (isLoading || !hasMore) {
            return;
        }

        void fetchMedia(meta.current_page + 1, true);
    }, [fetchMedia, hasMore, isLoading, meta.current_page]);

    const openMedia = useCallback(
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

    const handleFiltersChange = useCallback(
        (
            nextFilters:
                | GalleryFilters
                | ((current: GalleryFilters) => GalleryFilters),
        ) => {
            setSelectedMediaIndex(null);
            setFilters(nextFilters);
        },
        [],
    );

    return (
        <main className="vault-gallery">
            <Head title="Gallery" />

            <GalleryHeader user={auth.user} />

            <div className="vault-gallery__shell">
                <CategoryTabs
                    categories={categories}
                    active={filters.category}
                    onChange={(category) =>
                        handleFiltersChange((current) => ({
                            ...current,
                            category,
                        }))
                    }
                />

                <GalleryFilterBar
                    colors={colors}
                    creators={creators.data}
                    filters={filters}
                    isAuthenticated={Boolean(auth.user)}
                    onChange={handleFiltersChange}
                />

                {isLoading && media.length === 0 ? (
                    <GallerySkeleton />
                ) : media.length > 0 ? (
                    <OrbitGalleryScene
                        media={media}
                        isLoading={isLoading}
                        hasMore={hasMore}
                        onOpen={openMedia}
                        onLoadMore={loadMore}
                        fallback={
                            <MediaGrid media={media} onOpen={openMedia} />
                        }
                    />
                ) : (
                    <GalleryEmptyState />
                )}
            </div>

            <MediaLightbox
                media={selectedMedia}
                items={media}
                selectedIndex={selectedMediaIndex}
                onSelectIndex={setSelectedMediaIndex}
                onClose={() => setSelectedMediaIndex(null)}
            />
        </main>
    );
}
