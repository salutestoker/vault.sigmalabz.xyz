import InfiniteWebGLGallery from '@/Components/InfiniteWebGLGallery';
import { type User } from '@/types';
import { Head } from '@inertiajs/react';
import { Gauge, LogIn, UserPlus } from 'lucide-react';

interface LandingProps {
    auth: {
        user: User | null;
    };
    galleryImages: string[];
}

export default function Landing({ auth, galleryImages }: LandingProps) {
    const actions = auth.user
        ? [
              {
                  href: route('dashboard'),
                  icon: <Gauge className="size-4" aria-hidden="true" />,
                  label: 'Dashboard',
                  variant: 'primary' as const,
              },
          ]
        : [
              {
                  href: route('login'),
                  icon: <LogIn className="size-4" aria-hidden="true" />,
                  label: 'Log in',
              },
              {
                  href: route('register'),
                  icon: <UserPlus className="size-4" aria-hidden="true" />,
                  label: 'Register',
                  variant: 'primary' as const,
              },
          ];

    return (
        <>
            <Head title="SIGMA Meme Gallery" />
            <InfiniteWebGLGallery
                actions={actions}
                images={galleryImages}
                subtitle="Meme Gallery"
                title="SIGMA"
            />
        </>
    );
}
