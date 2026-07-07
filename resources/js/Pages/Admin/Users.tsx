import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';

interface AdminUser {
    id: number;
    name: string;
    email: string;
    role: string;
    twitter_handle?: string | null;
    discord_username?: string | null;
}

interface UsersProps {
    users: {
        data: AdminUser[];
    };
    roles: string[];
}

function UserRoleForm({ roles, user }: { roles: string[]; user: AdminUser }) {
    const { data, setData, patch, processing } = useForm({
        role: user.role,
        display_name: user.name,
        twitter_handle: user.twitter_handle ?? '',
    });

    return (
        <form
            className="grid gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-[1fr_1fr_10rem_auto]"
            onSubmit={(event) => {
                event.preventDefault();
                patch(route('admin.users.update', user.id), {
                    preserveScroll: true,
                });
            }}
        >
            <div>
                <div className="font-semibold text-gray-900">{user.name}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
                {user.discord_username && (
                    <div className="text-sm text-gray-500">
                        {user.discord_username}
                    </div>
                )}
            </div>
            <input
                value={data.twitter_handle}
                onChange={(event) =>
                    setData('twitter_handle', event.target.value)
                }
                className="rounded-md border-gray-300 text-sm"
                placeholder="Twitter/X"
            />
            <select
                value={data.role}
                onChange={(event) => setData('role', event.target.value)}
                className="rounded-md border-gray-300 text-sm"
            >
                {roles.map((role) => (
                    <option key={role} value={role}>
                        {role}
                    </option>
                ))}
            </select>
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

export default function Users({ roles, users }: UsersProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Admin Users" />
            <div className="mx-auto max-w-7xl space-y-4 p-6">
                <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
                {users.data.map((user) => (
                    <UserRoleForm key={user.id} roles={roles} user={user} />
                ))}
            </div>
        </AuthenticatedLayout>
    );
}
