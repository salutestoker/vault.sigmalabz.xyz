import { SIGMA_SPLINE_SCENE } from '@/Constants/spline';
import { Link } from '@inertiajs/react';
import { lazy, type PropsWithChildren, Suspense } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineButtonProps extends PropsWithChildren {
    className?: string;
    href: string;
}

export default function SplineButton({
    children,
    className = '',
    href,
}: SplineButtonProps) {
    return (
        <Link className={`spline-button ${className}`} href={href}>
            <span aria-hidden="true" className="spline-button__scene">
                <Suspense
                    fallback={<span className="spline-button__fallback" />}
                >
                    <Spline
                        className="spline-button__spline"
                        scene={SIGMA_SPLINE_SCENE}
                    />
                </Suspense>
            </span>
            {/*<span className="spline-button__overlay" />*/}
            <span className="spline-button__content">{children}</span>
        </Link>
    );
}
