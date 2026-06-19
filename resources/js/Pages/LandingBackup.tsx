import SplineButton from '@/Components/SplineButton';
import RegularPageLayout from '@/Layouts/RegularPageLayout';
import { type User } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Gauge, LogIn, UserPlus } from 'lucide-react';
import {
    type CSSProperties,
    type PointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

interface GalleryItem {
    src: string;
    title: string;
    label: string;
    alt: string;
}

const galleryItems: GalleryItem[] = [
    {
        src: 'https://pbs.twimg.com/media/HJbM7YJXcAQ7Vgk?format=jpg&name=medium',
        title: 'SIGMA',
        alt: '',
        label: '',
    },
    {
        src: 'https://pbs.twimg.com/media/HJlr-24WUAIl2IM?format=jpg&name=medium',
        title: 'AURA',
        label: '',
        alt: '',
    },
    {
        src: 'https://pbs.twimg.com/media/HKJjTgEW0AAi_kG?format=jpg&name=medium',
        title: 'COMMUNITY',
        label: '',
        alt: '',
    },
    {
        src: 'https://media.discordapp.net/attachments/1431239622255448235/1487627383153365014/Screenshot_20260328_204654_Gallery111.jpg?ex=6a26c636&is=6a2574b6&hm=2f98638d9bcddbcdeb49200ee5650b178761910bf9e86350ac6eb8f7b6faf547&=&format=webp&width=1280&height=1507',
        title: 'Videos',
        label: '',
        alt: '',
    },
    {
        src: 'https://pbs.twimg.com/media/HKEUUlVW8AAVTMp?format=jpg&name=medium',
        title: 'BURNIE',
        label: '',
        alt: '',
    },
];

const buildTransform = (tilt: number, rotation: number) =>
    `rotateX(${tilt.toFixed(2)}deg) rotateY(${rotation.toFixed(2)}deg)`;

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

const initialRotation = 0;
const initialTilt = -5;

interface LandingProps {
    auth: {
        user: User | null;
    };
}

export default function Landing({ auth }: LandingProps) {
    const rotationRef = useRef(initialRotation);
    const tiltRef = useRef(initialTilt);
    const dragRef = useRef({
        active: false,
        pointerId: null as number | null,
        x: 0,
    });
    const [galleryState, setGalleryState] = useState(() => ({
        rotation: initialRotation,
        transform: buildTransform(initialTilt, initialRotation),
    }));
    const [isDragging, setIsDragging] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    const tileAngle = 360 / galleryItems.length;

    const syncTransform = useCallback(() => {
        setGalleryState({
            rotation: rotationRef.current,
            transform: buildTransform(tiltRef.current, rotationRef.current),
        });
    }, []);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const syncPreference = () => setPrefersReducedMotion(media.matches);

        syncPreference();
        media.addEventListener('change', syncPreference);

        return () => media.removeEventListener('change', syncPreference);
    }, []);

    useEffect(() => {
        if (prefersReducedMotion) {
            return;
        }

        let animationFrame = 0;
        let previousTimestamp = performance.now();

        const animate = (timestamp: number) => {
            const delta = timestamp - previousTimestamp;
            previousTimestamp = timestamp;

            if (!dragRef.current.active) {
                rotationRef.current -= delta * 0.012;
                syncTransform();
            }

            animationFrame = window.requestAnimationFrame(animate);
        };

        animationFrame = window.requestAnimationFrame(animate);

        return () => window.cancelAnimationFrame(animationFrame);
    }, [prefersReducedMotion, syncTransform]);

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        dragRef.current = {
            active: true,
            pointerId: event.pointerId,
            x: event.clientX,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current.active) {
            return;
        }

        const deltaX = event.clientX - dragRef.current.x;

        rotationRef.current += deltaX * 0.3;
        dragRef.current.x = event.clientX;

        syncTransform();
    };

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (dragRef.current.pointerId === event.pointerId) {
            dragRef.current.active = false;
            dragRef.current.pointerId = null;
            setIsDragging(false);
        }
    };

    return (
        <RegularPageLayout>
            <Head title="SIGMA Meme Gallery" />

            <main className="landing-page">
                <header className="relative z-20 mx-auto hidden w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
                    <Link
                        href={route('home')}
                        className="inline-flex items-center gap-3 text-sm font-semibold text-white"
                    >
                        <span className="flex size-8 items-center justify-center border border-white/20 bg-white/10 text-xs">
                            SG
                        </span>
                        <span>SIGMA Meme Gallery</span>
                    </Link>

                    <nav className="flex items-center gap-2">
                        {auth.user ? (
                            <Link
                                href={route('dashboard')}
                                className="inline-flex items-center gap-2 border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                            >
                                <Gauge className="size-4" />
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={route('login')}
                                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white/80 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                                >
                                    <LogIn className="size-4" />
                                    Log in
                                </Link>
                                <Link
                                    href={route('register')}
                                    className="inline-flex items-center gap-2 border border-emerald-300/40 bg-emerald-300 px-3 py-2 text-sm font-semibold text-black transition hover:bg-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                >
                                    <UserPlus className="size-4" />
                                    Register
                                </Link>
                            </>
                        )}
                    </nav>
                </header>

                <section className="landing-stage mx-auto w-full max-w-7xl px-5 sm:mt-10 sm:px-8">
                    <div className="relative z-10 hidden max-w-2xl pt-12 sm:pt-20">
                        <p className="mb-4 text-sm font-semibold text-emerald-200 uppercase">
                            Discord-born visual archive
                        </p>
                        <h1 className="max-w-xl text-5xl leading-none font-black text-white sm:text-7xl">
                            SIGMA Meme Gallery
                        </h1>
                        <p className="mt-5 max-w-lg text-base leading-7 text-white/72 sm:text-lg">
                            A kinetic front door for the image stream that will
                            become the full gallery experience.
                        </p>
                        <Link
                            href={
                                auth.user
                                    ? route('dashboard')
                                    : route('register')
                            }
                            className="mt-8 inline-flex items-center gap-2 border border-white/15 bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                        >
                            Enter the gallery
                            <ArrowRight className="size-4" />
                        </Link>
                    </div>

                    <div
                        id="drag-container"
                        className={isDragging ? 'is-dragging' : undefined}
                        aria-label="Spinning preview gallery"
                        onPointerCancel={handlePointerUp}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        role="img"
                        tabIndex={0}
                    >
                        <div
                            id="spin-container"
                            style={{ transform: galleryState.transform }}
                        >
                            {galleryItems.map((item, index) => {
                                const tileRotation = normalizeAngle(
                                    galleryState.rotation + index * tileAngle,
                                );
                                const isBackFacing =
                                    tileRotation > 75 && tileRotation < 285;
                                const figureClassName = `tile__figure${isBackFacing ? ' is-back-facing' : ''}`;

                                return (
                                    <figure
                                        className={figureClassName}
                                        key={item.src}
                                        style={
                                            {
                                                '--tile-image': `url("${item.src}")`,
                                                transform: `rotateY(${index * tileAngle}deg) translateZ(var(--gallery-radius))`,
                                            } as CSSProperties
                                        }
                                    >
                                        <div className="tile__face tile__face--front">
                                            <img
                                                className="tile__image"
                                                src={item.src}
                                                alt={item.alt}
                                                draggable={false}
                                            />
                                            <figcaption className="tile__content__wrap">
                                                <div className="tile__content">
                                                    <span className="tile__description uppercase">
                                                        {item.title}
                                                    </span>
                                                    <span className="tile__date">
                                                        {item.label}
                                                    </span>
                                                </div>
                                            </figcaption>
                                        </div>
                                        <div
                                            aria-hidden="true"
                                            className="tile__face tile__face--back"
                                        >
                                            <img
                                                className="tile__image"
                                                src={item.src}
                                                alt={item.alt}
                                                draggable={false}
                                            />
                                            <figcaption className="tile__content__wrap">
                                                <div className="tile__content">
                                                    <span className="tile__description">
                                                        {item.title}
                                                    </span>
                                                    <span className="tile__date">
                                                        {item.label}
                                                    </span>
                                                </div>
                                            </figcaption>
                                        </div>
                                    </figure>
                                );
                            })}
                        </div>
                        <div id="ground" />
                    </div>

                    <div className="landing-carousel-cta mt-50">
                        <SplineButton
                            href={
                                auth.user
                                    ? route('dashboard')
                                    : route('register')
                            }
                        >
                            Enter the gallery
                            <ArrowRight className="size-4" />
                        </SplineButton>
                    </div>
                </section>
            </main>
        </RegularPageLayout>
    );
}
