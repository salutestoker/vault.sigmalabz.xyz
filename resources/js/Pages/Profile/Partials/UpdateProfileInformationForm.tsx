import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    className = '',
}: {
    mustVerifyEmail: boolean;
    status?: string;
    className?: string;
}) {
    const user = usePage().props.auth.user!;

    const { data, setData, post, errors, processing, recentlySuccessful } =
        useForm({
            name: user.name,
            display_name: user.display_name ?? '',
            email: user.email,
            twitter_handle: user.twitter_handle ?? '',
            profile_image: null as File | null,
            _method: 'patch',
        });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('profile.update'), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900">
                    Profile Information
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                    Update your account profile, creator handle, and Discord
                    gallery identity.
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-6">
                {(user.profile_image_url || user.discord_avatar_url) && (
                    <img
                        src={
                            user.profile_image_url ??
                            user.discord_avatar_url ??
                            ''
                        }
                        alt=""
                        className="size-16 rounded-full object-cover"
                    />
                )}

                <div>
                    <InputLabel htmlFor="name" value="Name" />

                    <TextInput
                        id="name"
                        className="mt-1 block w-full"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                        isFocused
                        autoComplete="name"
                    />

                    <InputError className="mt-2" message={errors.name} />
                </div>

                <div>
                    <InputLabel htmlFor="display_name" value="Display name" />

                    <TextInput
                        id="display_name"
                        className="mt-1 block w-full"
                        value={data.display_name}
                        onChange={(e) =>
                            setData('display_name', e.target.value)
                        }
                        autoComplete="nickname"
                    />

                    <InputError
                        className="mt-2"
                        message={errors.display_name}
                    />
                </div>

                <div>
                    <InputLabel htmlFor="email" value="Email" />

                    <TextInput
                        id="email"
                        type="email"
                        className="mt-1 block w-full"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                        autoComplete="username"
                    />

                    <InputError className="mt-2" message={errors.email} />
                </div>

                <div>
                    <InputLabel
                        htmlFor="twitter_handle"
                        value="Twitter/X handle"
                    />

                    <TextInput
                        id="twitter_handle"
                        className="mt-1 block w-full"
                        value={data.twitter_handle}
                        onChange={(e) =>
                            setData(
                                'twitter_handle',
                                e.target.value.replace(/^@/, ''),
                            )
                        }
                        placeholder="sigma"
                    />

                    <InputError
                        className="mt-2"
                        message={errors.twitter_handle}
                    />
                </div>

                <div>
                    <InputLabel htmlFor="profile_image" value="Profile image" />

                    <input
                        id="profile_image"
                        type="file"
                        accept="image/*"
                        className="mt-1 block w-full text-sm text-gray-700"
                        onChange={(e) =>
                            setData(
                                'profile_image',
                                e.target.files?.[0] ?? null,
                            )
                        }
                    />

                    <InputError
                        className="mt-2"
                        message={errors.profile_image}
                    />
                </div>

                <div className="rounded-md border border-gray-200 p-4 text-sm text-gray-700">
                    <div className="font-medium text-gray-900">
                        Discord account
                    </div>
                    <p className="mt-1">
                        {user.discord_username
                            ? `Connected as ${user.discord_username}`
                            : 'No Discord account connected yet.'}
                    </p>
                    <Link
                        href={route('auth.discord.redirect')}
                        className="mt-3 inline-flex rounded-md bg-[#5865f2] px-3 py-2 text-xs font-semibold text-white"
                    >
                        {user.discord_username
                            ? 'Refresh Discord link'
                            : 'Connect Discord'}
                    </Link>
                </div>

                {mustVerifyEmail && user.email_verified_at === null && (
                    <div>
                        <p className="mt-2 text-sm text-gray-800">
                            Your email address is unverified.
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
                            >
                                Click here to re-send the verification email.
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <div className="mt-2 text-sm font-medium text-green-600">
                                A new verification link has been sent to your
                                email address.
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <PrimaryButton disabled={processing}>Save</PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-gray-600">Saved.</p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
