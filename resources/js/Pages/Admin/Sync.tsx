import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';

interface SyncRun {
    id: number;
    status: string;
    channels_scanned: number;
    messages_scanned: number;
    media_imported: number;
    media_skipped: number;
    media_failed: number;
    error_message?: string | null;
    items_count: number;
    created_at: string;
}

interface SyncProps {
    syncRuns: {
        data: SyncRun[];
    };
}

export default function Sync({ syncRuns }: SyncProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Discord Sync" />
            <div className="mx-auto max-w-7xl space-y-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-2xl font-semibold text-gray-900">
                        Discord Sync
                    </h1>
                    <button
                        type="button"
                        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                        onClick={() => router.post(route('admin.sync.store'))}
                    >
                        Queue Sync
                    </button>
                </div>

                <div className="overflow-hidden rounded-lg bg-white shadow">
                    {syncRuns.data.map((sync) => (
                        <div
                            key={sync.id}
                            className="grid gap-2 border-b border-gray-100 p-4 text-sm text-gray-700 md:grid-cols-6"
                        >
                            <span>#{sync.id}</span>
                            <span>{sync.status}</span>
                            <span>{sync.channels_scanned} channels</span>
                            <span>{sync.messages_scanned} messages</span>
                            <span>{sync.media_imported} imported</span>
                            <span>{sync.media_failed} failed</span>
                            {sync.error_message && (
                                <p className="text-red-600 md:col-span-6">
                                    {sync.error_message}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
