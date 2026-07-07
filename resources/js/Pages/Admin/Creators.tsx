import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { type GalleryCreator } from '@/types/gallery';
import { Head, useForm } from '@inertiajs/react';

interface CreatorsProps {
    creators: {
        data: GalleryCreator[];
    };
}

function CreatorForm({ creator }: { creator: GalleryCreator }) {
    const { data, setData, patch, processing } = useForm({
        display_name: creator.display_name,
        twitter_handle: creator.twitter_handle ?? '',
        is_verified: Boolean(creator.is_verified),
    });

    return (
        <form
            className="grid gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-[1fr_1fr_auto_auto]"
            onSubmit={(event) => {
                event.preventDefault();
                patch(route('admin.creators.update', creator.id), {
                    preserveScroll: true,
                });
            }}
        >
            <input
                value={data.display_name}
                onChange={(event) =>
                    setData('display_name', event.target.value)
                }
                className="rounded-md border-gray-300 text-sm"
            />
            <input
                value={data.twitter_handle}
                onChange={(event) =>
                    setData('twitter_handle', event.target.value)
                }
                className="rounded-md border-gray-300 text-sm"
                placeholder="Twitter/X"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                    type="checkbox"
                    checked={data.is_verified}
                    onChange={(event) =>
                        setData('is_verified', event.target.checked)
                    }
                />
                Verified
            </label>
            <button
                type="submit"
                disabled={processing}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
                Save
            </button>
        </form>
    );
}

export default function Creators({ creators }: CreatorsProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Admin Creators" />
            <div className="mx-auto max-w-7xl space-y-4 p-6">
                <h1 className="text-2xl font-semibold text-gray-900">
                    Creators
                </h1>
                {creators.data.map((creator) => (
                    <CreatorForm key={creator.id} creator={creator} />
                ))}
            </div>
        </AuthenticatedLayout>
    );
}
