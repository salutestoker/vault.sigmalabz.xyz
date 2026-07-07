import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { type GalleryMedia, type PaginatedResource } from '@/types/gallery';
import { Head, useForm } from '@inertiajs/react';

interface CategoryOption {
    id: number;
    name: string;
    slug: string;
}

interface MediaProps {
    media: PaginatedResource<GalleryMedia>;
    categories: CategoryOption[];
}

function MediaForm({
    categories,
    media,
}: {
    categories: CategoryOption[];
    media: GalleryMedia;
}) {
    const { data, setData, patch, processing } = useForm({
        title: media.title,
        description: media.description ?? '',
        visibility: media.visibility,
        is_featured: false,
        gallery_category_id: media.category?.id ?? '',
    });

    return (
        <form
            className="grid gap-4 rounded-lg bg-white p-4 shadow lg:grid-cols-[8rem_1fr_10rem_auto]"
            onSubmit={(event) => {
                event.preventDefault();
                patch(route('admin.media.update', media.id), {
                    preserveScroll: true,
                });
            }}
        >
            <img
                src={media.thumbnail_url ?? ''}
                alt=""
                className="aspect-square w-full rounded object-cover"
            />
            <div className="grid gap-2">
                <input
                    value={data.title}
                    onChange={(event) => setData('title', event.target.value)}
                    className="rounded-md border-gray-300 text-sm"
                />
                <textarea
                    value={data.description}
                    onChange={(event) =>
                        setData('description', event.target.value)
                    }
                    className="min-h-20 rounded-md border-gray-300 text-sm"
                />
            </div>
            <div className="grid gap-2">
                <select
                    value={data.visibility}
                    onChange={(event) =>
                        setData('visibility', event.target.value)
                    }
                    className="rounded-md border-gray-300 text-sm"
                >
                    <option value="public">public</option>
                    <option value="hidden">hidden</option>
                </select>
                <select
                    value={data.gallery_category_id}
                    onChange={(event) =>
                        setData('gallery_category_id', event.target.value)
                    }
                    className="rounded-md border-gray-300 text-sm"
                >
                    <option value="">No category</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>
            </div>
            <button
                type="submit"
                disabled={processing}
                className="h-10 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
                Save
            </button>
        </form>
    );
}

export default function Media({ categories, media }: MediaProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Admin Media" />
            <div className="mx-auto max-w-7xl space-y-4 p-6">
                <h1 className="text-2xl font-semibold text-gray-900">Media</h1>
                {media.data.map((item) => (
                    <MediaForm
                        key={item.id}
                        categories={categories}
                        media={item}
                    />
                ))}
            </div>
        </AuthenticatedLayout>
    );
}
