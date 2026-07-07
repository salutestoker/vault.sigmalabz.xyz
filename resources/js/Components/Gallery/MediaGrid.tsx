import { type GalleryMedia } from '@/types/gallery';
import MediaCard from './MediaCard';

interface MediaGridProps {
    media: GalleryMedia[];
    onOpen: (media: GalleryMedia) => void;
}

export default function MediaGrid({ media, onOpen }: MediaGridProps) {
    return (
        <section className="vault-gallery__grid" aria-label="Gallery media">
            {media.map((item) => (
                <MediaCard key={item.id} media={item} onOpen={onOpen} />
            ))}
        </section>
    );
}
