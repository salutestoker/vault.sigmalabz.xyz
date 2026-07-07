import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

interface DashboardProps {
    stats: Record<string, number>;
    recentSyncs: Array<{
        id: number;
        status: string;
        media_imported: number;
        media_failed: number;
        created_at: string;
    }>;
}

export default function Dashboard({ stats, recentSyncs }: DashboardProps) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl leading-tight font-semibold text-gray-800">
                    Admin
                </h2>
            }
        >
            <Head title="Admin" />

            <div className="mx-auto max-w-7xl space-y-6 p-6">
                <nav className="flex flex-wrap gap-3">
                    <Link
                        href={route('admin.users.index')}
                        className="admin-link"
                    >
                        Users
                    </Link>
                    <Link
                        href={route('admin.media.index')}
                        className="admin-link"
                    >
                        Media
                    </Link>
                    <Link
                        href={route('admin.creators.index')}
                        className="admin-link"
                    >
                        Creators
                    </Link>
                    <Link
                        href={route('admin.sync.index')}
                        className="admin-link"
                    >
                        Sync
                    </Link>
                </nav>

                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {Object.entries(stats).map(([label, value]) => (
                        <div
                            key={label}
                            className="rounded-lg bg-white p-5 shadow"
                        >
                            <div className="text-sm text-gray-500">{label}</div>
                            <div className="mt-2 text-3xl font-bold text-gray-900">
                                {value}
                            </div>
                        </div>
                    ))}
                </section>

                <section className="rounded-lg bg-white p-5 shadow">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Recent syncs
                    </h3>
                    <div className="mt-4 divide-y divide-gray-100">
                        {recentSyncs.map((sync) => (
                            <div
                                key={sync.id}
                                className="grid gap-2 py-3 text-sm text-gray-700 sm:grid-cols-4"
                            >
                                <span>#{sync.id}</span>
                                <span>{sync.status}</span>
                                <span>{sync.media_imported} imported</span>
                                <span>{sync.media_failed} failed</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
