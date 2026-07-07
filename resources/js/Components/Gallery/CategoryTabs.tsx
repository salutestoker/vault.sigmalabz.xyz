import { type GalleryCategory } from '@/types/gallery';

interface CategoryTabsProps {
    categories: GalleryCategory[];
    active: string;
    onChange: (category: string) => void;
}

export default function CategoryTabs({
    categories,
    active,
    onChange,
}: CategoryTabsProps) {
    return (
        <nav className="vault-gallery__tabs" aria-label="Gallery categories">
            {categories.map((category) => (
                <button
                    key={category.slug}
                    type="button"
                    className="vault-gallery__tab"
                    data-active={active === category.slug}
                    onClick={() => onChange(category.slug)}
                >
                    {category.name}
                </button>
            ))}
        </nav>
    );
}
