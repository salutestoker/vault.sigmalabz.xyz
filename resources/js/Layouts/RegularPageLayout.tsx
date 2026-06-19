import { SIGMA_SPLINE_SCENE } from '@/Constants/spline';
import { lazy, type PropsWithChildren, Suspense } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

export default function RegularPageLayout({ children }: PropsWithChildren) {
    return (
        <div className="relative min-h-screen bg-black text-white">
            <div
                aria-hidden="true"
                className="animate-hue-filter-loop fixed inset-0 z-0 h-screen w-screen overflow-hidden opacity-10"
            >
                <Suspense fallback={<div className="h-full w-full bg-black" />}>
                    <Spline
                        className="h-full w-full"
                        scene={SIGMA_SPLINE_SCENE}
                    />
                </Suspense>
            </div>

            <a
                className="fixed top-5 left-1/2 w-[150px] -translate-x-1/2 invert"
                href="/"
            >
                <img src="/images/sigma-labz-logo.png" alt="SIGMA LABZ" />{' '}
            </a>

            <div className="relative z-10 min-h-screen">{children}</div>
        </div>
    );
}
