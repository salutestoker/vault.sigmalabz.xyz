import {
    type GalleryColor,
    type GalleryCreator,
    type GalleryFilters,
} from '@/types/gallery';
import { Heart, Palette, Search, Sigma } from 'lucide-react';

interface GalleryFilterBarProps {
    colors: GalleryColor[];
    creators: GalleryCreator[];
    filters: GalleryFilters;
    isAuthenticated: boolean;
    onChange: (filters: GalleryFilters) => void;
}

export default function GalleryFilterBar({
    colors,
    creators,
    filters,
    isAuthenticated,
    onChange,
}: GalleryFilterBarProps) {
    return (
        <div className="vault-gallery__filters">
            <label className="vault-gallery__field vault-gallery__field--search">
                <Search className="size-4" aria-hidden="true" />
                <span className="sr-only">Search gallery</span>
                <input
                    value={filters.search}
                    onChange={(event) =>
                        onChange({ ...filters, search: event.target.value })
                    }
                    placeholder="search by keywords"
                    type="search"
                />
            </label>

            <label className="vault-gallery__field">
                <Palette className="size-4" aria-hidden="true" />
                <span className="sr-only">Filter by color</span>
                <select
                    value={filters.color}
                    onChange={(event) =>
                        onChange({ ...filters, color: event.target.value })
                    }
                >
                    <option value="">filter by color</option>
                    {colors.map((color) => (
                        <option key={color.hex} value={color.hex}>
                            {color.hex}
                        </option>
                    ))}
                </select>
            </label>

            <label className="vault-gallery__field">
                <Sigma className="size-4" aria-hidden="true" />
                <span className="sr-only">Filter by creator</span>
                <select
                    value={filters.creator ?? ''}
                    onChange={(event) =>
                        onChange({
                            ...filters,
                            creator: event.target.value
                                ? Number(event.target.value)
                                : null,
                        })
                    }
                >
                    <option value="">filter by creator</option>
                    {creators.map((creator) => (
                        <option key={creator.id} value={creator.id}>
                            {creator.preferred_handle}
                        </option>
                    ))}
                </select>
            </label>

            <div className="vault-gallery__swatches" aria-label="Top colors">
                {colors.slice(0, 10).map((color) => (
                    <button
                        key={color.hex}
                        type="button"
                        className="vault-gallery__swatch"
                        data-active={filters.color === color.hex}
                        style={{ backgroundColor: color.hex }}
                        title={`Filter ${color.hex}`}
                        onClick={() =>
                            onChange({
                                ...filters,
                                color:
                                    filters.color === color.hex
                                        ? ''
                                        : color.hex,
                            })
                        }
                    />
                ))}
            </div>

            {isAuthenticated && (
                <button
                    type="button"
                    className="vault-gallery__favorite-filter"
                    data-active={filters.favorites}
                    onClick={() =>
                        onChange({
                            ...filters,
                            favorites: !filters.favorites,
                        })
                    }
                >
                    <Heart
                        className="size-5"
                        aria-hidden="true"
                        fill={filters.favorites ? 'currentColor' : 'none'}
                    />
                    <span className="sr-only">Favorites</span>
                </button>
            )}
        </div>
    );
}
