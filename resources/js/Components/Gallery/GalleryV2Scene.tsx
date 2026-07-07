import { type GalleryMedia } from '@/types/gallery';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
    forwardRef,
    type ReactNode,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import * as THREE from 'three';

gsap.registerPlugin(useGSAP);

interface GalleryV2SceneProps {
    media: GalleryMedia[];
    isLoading: boolean;
    onOpen: (media: GalleryMedia) => void;
    fallback: ReactNode;
}

export interface GalleryV2SceneHandle {
    transitionIn: () => Promise<void>;
    transitionOut: () => Promise<void>;
}

interface Viewport {
    width: number;
    height: number;
    dpr: number;
}

interface QualitySettings {
    antialias: boolean;
    dpr: number;
    segments: number;
}

interface V2Plane {
    media: GalleryMedia;
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    row: number;
    column: number;
    baseX: number;
    baseY: number;
    baseWidth: number;
    baseHeight: number;
    hover: number;
    hoverTarget: number;
    textures: THREE.Texture[];
    video?: HTMLVideoElement;
}

interface PanState {
    current: THREE.Vector2;
    target: THREE.Vector2;
    last: THREE.Vector2;
    momentum: THREE.Vector2;
    velocity: THREE.Vector2;
    pointerStart: THREE.Vector2;
    pointerLast: THREE.Vector2;
    dragDistance: number;
    isDragging: boolean;
}

interface Layout {
    stepX: number;
    stepY: number;
    totalX: number;
    totalY: number;
}

const GRID_COLUMNS = 10;
const GRID_ROWS = 10;
const PLANE_COUNT = GRID_COLUMNS * GRID_ROWS;
const MIN_V2_ITEMS = 3;
const CAMERA_FOV = 45;
const INITIAL_CAMERA_Z = 5.8;
const MIN_CAMERA_Z = 2.9;
const MAX_CAMERA_Z = 5.8;
const LEGACY_CAMERA_Z_STORAGE_KEY = 'vault.gallery.v2.cameraZ';
const CAMERA_Z_STORAGE_KEY = 'vault.gallery.v2.cameraZ.v2';
const CAMERA_Z_STORAGE_PRECISION = 3;
const DRAG_THRESHOLD = 10;
const AUTO_SCROLL_SPEED = 0.0012;
const POINTER_DISTORTION = 1.05;
const WHEEL_DISTORTION = 0.72;
const IMAGE_TEXTURE_TIMEOUT = 3500;
const TRANSITION_IN_DURATION = 0.42;
const TRANSITION_OUT_DURATION = 0.28;
const TRANSITION_STAGGER_AMOUNT = 0.3;

function clampCameraZ(value: number): number {
    return THREE.MathUtils.clamp(value, MIN_CAMERA_Z, MAX_CAMERA_Z);
}

function readStoredCameraZ(): number {
    if (typeof window === 'undefined') {
        return INITIAL_CAMERA_Z;
    }

    try {
        const stored =
            window.localStorage.getItem(CAMERA_Z_STORAGE_KEY) ??
            window.localStorage.getItem(LEGACY_CAMERA_Z_STORAGE_KEY);
        const parsed = stored ? Number.parseFloat(stored) : Number.NaN;

        if (!Number.isFinite(parsed)) {
            window.localStorage.removeItem(LEGACY_CAMERA_Z_STORAGE_KEY);
            return INITIAL_CAMERA_Z;
        }

        const clamped = clampCameraZ(parsed);

        window.localStorage.setItem(
            CAMERA_Z_STORAGE_KEY,
            clamped.toFixed(CAMERA_Z_STORAGE_PRECISION),
        );
        window.localStorage.removeItem(LEGACY_CAMERA_Z_STORAGE_KEY);

        return clamped;
    } catch {
        return INITIAL_CAMERA_Z;
    }
}

function storeCameraZ(value: number): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            CAMERA_Z_STORAGE_KEY,
            clampCameraZ(value).toFixed(CAMERA_Z_STORAGE_PRECISION),
        );
        window.localStorage.removeItem(LEGACY_CAMERA_Z_STORAGE_KEY);
    } catch {
        // Browsers can block localStorage; the in-memory ref still preserves this session.
    }
}

function useReducedMotion(): boolean {
    const [reducedMotion, setReducedMotion] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        );
        const handleChange = (event: MediaQueryListEvent) =>
            setReducedMotion(event.matches);

        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return reducedMotion;
}

function mediaAspectRatio(media: GalleryMedia): number {
    if (media.width && media.height && media.width > 0 && media.height > 0) {
        return media.width / media.height;
    }

    return media.type === 'video' ? 16 / 9 : 1;
}

function imageTextureUrls(media: GalleryMedia): string[] {
    return [media.media_url, media.preview_url, media.thumbnail_url].filter(
        (url): url is string => Boolean(url),
    );
}

function posterTextureUrls(media: GalleryMedia): string[] {
    return [media.thumbnail_url, media.preview_url, media.media_url].filter(
        (url): url is string => Boolean(url),
    );
}

function clampAspectRatio(aspectRatio: number): number {
    return THREE.MathUtils.clamp(aspectRatio, 0.55, 1.95);
}

function normalizeWheelDelta(event: WheelEvent): { x: number; y: number } {
    const lineHeight = 16;
    const pageHeight = window.innerHeight || 800;
    let x = event.deltaX;
    let y = event.deltaY;

    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        x *= lineHeight;
        y *= lineHeight;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        x *= pageHeight;
        y *= pageHeight;
    }

    return { x, y };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
        return false;
    }

    return Boolean(
        target.closest(
            'a, button, input, textarea, select, [role="dialog"], .vault-gallery__header, .vault-gallery__tabs, .vault-gallery__filters, .vault-gallery__lightbox',
        ),
    );
}

function qualityForViewport(): QualitySettings {
    const width = window.innerWidth;
    const dprLimit = width < 760 ? 1.35 : width < 1180 ? 1.6 : 2;

    return {
        antialias: width >= 760,
        dpr: Math.min(window.devicePixelRatio || 1, dprLimit),
        segments: width < 760 ? 6 : 10,
    };
}

function getViewSizeAtCameraZ(
    camera: THREE.PerspectiveCamera,
    cameraZ: number,
): THREE.Vector2 {
    const height =
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * cameraZ;

    return new THREE.Vector2(height * camera.aspect, height);
}

function getViewSize(camera: THREE.PerspectiveCamera): THREE.Vector2 {
    return getViewSizeAtCameraZ(camera, camera.position.z);
}

function wrapToCenter(value: number, size: number): number {
    return THREE.MathUtils.euclideanModulo(value + size / 2, size) - size / 2;
}

function hexToRgba(hex?: string | null): Uint8Array {
    const fallback = new Uint8Array([82, 82, 88, 255]);
    const value = hex?.replace('#', '');

    if (!value || value.length !== 6) {
        return fallback;
    }

    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);

    if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
        return fallback;
    }

    return new Uint8Array([red, green, blue, 255]);
}

function createPlaceholderTexture(media: GalleryMedia): THREE.DataTexture {
    const texture = new THREE.DataTexture(
        hexToRgba(media.dominant_color),
        1,
        1,
        THREE.RGBAFormat,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    return texture;
}

function prepareTexture(texture: THREE.Texture): THREE.Texture {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    return texture;
}

function createMaterial(texture: THREE.Texture): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.46, 0.46, 0.48),
        depthTest: false,
        depthWrite: false,
        map: texture,
        side: THREE.DoubleSide,
        toneMapped: false,
        transparent: true,
    });
}

function setPlaneTexture(plane: V2Plane, texture: THREE.Texture): void {
    plane.textures.push(texture);
    plane.mesh.material.map = texture;
    plane.mesh.material.needsUpdate = true;
}

function loadImageTexture(
    plane: V2Plane,
    urls: string[],
    isDisposed: () => boolean,
    onComplete: (loaded: boolean) => void,
): void {
    const [url, ...rest] = urls;

    if (!url || isDisposed()) {
        onComplete(false);
        return;
    }

    const loader = new THREE.TextureLoader();
    let settled = false;
    const timeoutId = window.setTimeout(() => {
        if (settled) {
            return;
        }

        settled = true;
        loadImageTexture(plane, rest, isDisposed, onComplete);
    }, IMAGE_TEXTURE_TIMEOUT);

    const failToNextUrl = () => {
        if (settled) {
            return;
        }

        settled = true;
        window.clearTimeout(timeoutId);
        loadImageTexture(plane, rest, isDisposed, onComplete);
    };

    loader.setCrossOrigin('anonymous');
    loader.load(
        url,
        (texture) => {
            if (settled) {
                texture.dispose();
                return;
            }

            settled = true;
            window.clearTimeout(timeoutId);

            if (isDisposed()) {
                texture.dispose();
                onComplete(false);
                return;
            }

            const preparedTexture = prepareTexture(texture);
            setPlaneTexture(plane, preparedTexture);
            onComplete(true);
        },
        undefined,
        failToNextUrl,
    );
}

function loadVideoTexture(
    plane: V2Plane,
    isDisposed: () => boolean,
    onComplete: (loaded: boolean) => void,
): void {
    const videoUrl = plane.media.media_url;

    if (!videoUrl) {
        loadImageTexture(
            plane,
            posterTextureUrls(plane.media),
            isDisposed,
            onComplete,
        );
        return;
    }

    const video = document.createElement('video');
    let settled = false;
    let timeoutId = window.setTimeout(() => {
        if (!settled) {
            failToPoster();
        }
    }, 4500);

    const cleanupVideo = () => {
        window.clearTimeout(timeoutId);
        video.pause();
        video.removeAttribute('src');
        video.load();
    };

    const failToPoster = () => {
        if (settled || isDisposed()) {
            return;
        }

        settled = true;
        cleanupVideo();
        plane.video = undefined;
        loadImageTexture(
            plane,
            posterTextureUrls(plane.media),
            isDisposed,
            onComplete,
        );
    };

    const attachTexture = async () => {
        if (settled || isDisposed()) {
            return;
        }

        try {
            await video.play();

            if (isDisposed()) {
                cleanupVideo();
                onComplete(false);
                return;
            }

            settled = true;
            window.clearTimeout(timeoutId);

            const texture = prepareTexture(new THREE.VideoTexture(video));
            setPlaneTexture(plane, texture);
            plane.video = video;
            onComplete(true);
        } catch {
            failToPoster();
        }
    };

    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUrl;
    video.addEventListener('canplay', () => void attachTexture(), {
        once: true,
    });
    video.addEventListener('error', failToPoster, { once: true });
    video.load();
    plane.video = video;
}

const GalleryV2Scene = forwardRef<GalleryV2SceneHandle, GalleryV2SceneProps>(
    function GalleryV2Scene({ media, isLoading, onOpen, fallback }, ref) {
        const reducedMotion = useReducedMotion();
        const [hasWebGLError, setHasWebGLError] = useState(false);
        const [loadedMediaSignature, setLoadedMediaSignature] = useState<
            string | null
        >(null);
        const stageRef = useRef<HTMLDivElement | null>(null);
        const onOpenRef = useRef(onOpen);
        const mediaRef = useRef(media);
        const planesRef = useRef<V2Plane[]>([]);
        const transitionTweenRef = useRef<gsap.core.Tween | null>(null);
        const transitionResolveRef = useRef<(() => void) | null>(null);
        const isTransitioningRef = useRef(false);
        const isTransitionedOutRef = useRef(false);
        const cameraZRef = useRef(readStoredCameraZ());
        const autoScrollDirectionRef = useRef(new THREE.Vector2(0, 1));

        const mediaSignature = useMemo(
            () =>
                media
                    .map(
                        (item) =>
                            `${item.id}:${item.type}:${item.media_url ?? ''}:${item.preview_url ?? ''}:${item.thumbnail_url ?? ''}`,
                    )
                    .join('|'),
            [media],
        );
        const shouldFallback =
            reducedMotion || hasWebGLError || media.length < MIN_V2_ITEMS;
        const isPreparingScene =
            !shouldFallback && loadedMediaSignature !== mediaSignature;

        const stopTransition = useCallback(() => {
            transitionTweenRef.current?.kill();
            transitionTweenRef.current = null;
            transitionResolveRef.current?.();
            transitionResolveRef.current = null;
            isTransitioningRef.current = false;
        }, []);

        const runPlaneFade = useCallback(
            (
                opacity: number,
                duration: number,
                ease: string,
            ): Promise<void> => {
                stopTransition();

                const materials = planesRef.current.map(
                    (plane) => plane.mesh.material,
                );

                if (reducedMotion || materials.length === 0) {
                    materials.forEach((material) => {
                        material.opacity = opacity;
                        material.needsUpdate = true;
                    });
                    isTransitionedOutRef.current = opacity === 0;

                    return Promise.resolve();
                }

                if (
                    materials.every(
                        (material) =>
                            Math.abs(material.opacity - opacity) < 0.01,
                    )
                ) {
                    isTransitionedOutRef.current = opacity === 0;

                    return Promise.resolve();
                }

                isTransitioningRef.current = true;

                if (opacity > 0) {
                    isTransitionedOutRef.current = false;
                }

                return new Promise((resolve) => {
                    transitionResolveRef.current = resolve;
                    transitionTweenRef.current = gsap.to(materials, {
                        duration,
                        ease,
                        opacity,
                        overwrite: true,
                        stagger: {
                            amount: TRANSITION_STAGGER_AMOUNT,
                            from: 'start',
                        },
                        onUpdate: () => {
                            materials.forEach((material) => {
                                material.needsUpdate = true;
                            });
                        },
                        onComplete: () => {
                            transitionTweenRef.current = null;
                            transitionResolveRef.current = null;
                            isTransitioningRef.current = false;
                            isTransitionedOutRef.current = opacity === 0;
                            resolve();
                        },
                    });
                });
            },
            [reducedMotion, stopTransition],
        );

        const { contextSafe } = useGSAP(
            () => {
                return () => stopTransition();
            },
            { scope: stageRef },
        );

        useImperativeHandle(
            ref,
            () => ({
                transitionIn: contextSafe(() =>
                    runPlaneFade(1, TRANSITION_IN_DURATION, 'power2.out'),
                ),
                transitionOut: contextSafe(() =>
                    runPlaneFade(0, TRANSITION_OUT_DURATION, 'power2.inOut'),
                ),
            }),
            [contextSafe, runPlaneFade],
        );

        useEffect(() => {
            onOpenRef.current = onOpen;
        }, [onOpen]);

        useEffect(() => {
            mediaRef.current = media;
        }, [media]);

        const pickMedia = useCallback(
            (
                clientX: number,
                clientY: number,
                container: HTMLDivElement,
                camera: THREE.PerspectiveCamera,
                raycaster: THREE.Raycaster,
                pointer: THREE.Vector2,
                planes: V2Plane[],
            ): GalleryMedia | null => {
                const bounds = container.getBoundingClientRect();
                pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
                pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
                raycaster.setFromCamera(pointer, camera);

                const intersections = raycaster.intersectObjects(
                    planes.map((plane) => plane.mesh),
                    false,
                );
                const intersection = intersections[0];

                if (!intersection) {
                    return null;
                }

                return (
                    planes.find((plane) => plane.mesh === intersection.object)
                        ?.media ?? null
                );
            },
            [],
        );

        useEffect(() => {
            const sourceMedia = mediaRef.current;
            const sceneMedia = Array.from(
                { length: PLANE_COUNT },
                (_, index) => sourceMedia[index % sourceMedia.length],
            ).filter((item): item is GalleryMedia => Boolean(item));

            if (shouldFallback || sceneMedia.length === 0) {
                setLoadedMediaSignature(mediaSignature);
                return;
            }

            const container = stageRef.current;

            if (!container) {
                return;
            }

            let renderer: THREE.WebGLRenderer;

            try {
                renderer = new THREE.WebGLRenderer({
                    alpha: true,
                    antialias: qualityForViewport().antialias,
                    powerPreference: 'high-performance',
                });
            } catch {
                window.setTimeout(() => setHasWebGLError(true), 0);
                return;
            }

            let isDisposed = false;
            let frameId = 0;
            let activePointerId: number | null = null;
            let hoveredPlane: V2Plane | null = null;
            let lastFrameTime = performance.now() - 16.666;
            let textureAttempts = 0;
            let textureSuccesses = 0;
            let distortion = 0;
            let distortionTarget = 0;
            let zoomTarget = clampCameraZ(cameraZRef.current);
            cameraZRef.current = zoomTarget;
            storeCameraZ(zoomTarget);
            let didRevealScene = false;
            const dragAutoScrollVector = new THREE.Vector2();
            const isEffectDisposed = () => isDisposed;
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(
                CAMERA_FOV,
                window.innerWidth / window.innerHeight,
                0.1,
                100,
            );
            const raycaster = new THREE.Raycaster();
            const pointer = new THREE.Vector2();
            const root = new THREE.Group();
            const quality = qualityForViewport();
            const geometry = new THREE.PlaneGeometry(
                1,
                1,
                quality.segments,
                quality.segments,
            );
            const viewport: Viewport = {
                width: window.innerWidth,
                height: window.innerHeight,
                dpr: quality.dpr,
            };
            const layout: Layout = {
                stepX: 1,
                stepY: 1,
                totalX: GRID_COLUMNS,
                totalY: GRID_ROWS,
            };
            const pan: PanState = {
                current: new THREE.Vector2(),
                target: new THREE.Vector2(),
                last: new THREE.Vector2(),
                momentum: new THREE.Vector2(),
                velocity: new THREE.Vector2(),
                pointerStart: new THREE.Vector2(),
                pointerLast: new THREE.Vector2(),
                dragDistance: 0,
                isDragging: false,
            };
            const planes: V2Plane[] = sceneMedia.map((item, index) => {
                const placeholder = createPlaceholderTexture(item);
                const material = createMaterial(placeholder);

                material.opacity = 0;
                material.needsUpdate = true;

                const mesh = new THREE.Mesh(geometry, material);
                const row = Math.floor(index / GRID_COLUMNS);
                const column = index % GRID_COLUMNS;
                const plane: V2Plane = {
                    media: item,
                    mesh,
                    row,
                    column,
                    baseX: 0,
                    baseY: 0,
                    baseWidth: 1,
                    baseHeight: 1,
                    hover: 0,
                    hoverTarget: 0,
                    textures: [placeholder],
                };

                mesh.userData.mediaId = item.id;
                root.add(mesh);

                return plane;
            });
            planesRef.current = planes;
            isTransitionedOutRef.current = true;

            const markTextureResult = (loaded: boolean) => {
                textureAttempts += 1;

                if (loaded) {
                    textureSuccesses += 1;
                }

                if (
                    textureAttempts < planes.length ||
                    isDisposed ||
                    didRevealScene
                ) {
                    return;
                }

                didRevealScene = true;
                setLoadedMediaSignature(mediaSignature);

                if (textureSuccesses === 0) {
                    setHasWebGLError(true);
                    return;
                }

                void runPlaneFade(1, TRANSITION_IN_DURATION, 'power2.out');
            };

            const resize = () => {
                const nextQuality = qualityForViewport();
                viewport.width = window.innerWidth;
                viewport.height = window.innerHeight;
                viewport.dpr = nextQuality.dpr;

                camera.aspect = viewport.width / viewport.height;
                camera.position.z = THREE.MathUtils.clamp(
                    camera.position.z || zoomTarget,
                    MIN_CAMERA_Z,
                    MAX_CAMERA_Z,
                );
                camera.updateProjectionMatrix();

                renderer.setPixelRatio(viewport.dpr);
                renderer.setSize(viewport.width, viewport.height);

                const view = getViewSizeAtCameraZ(camera, INITIAL_CAMERA_Z);
                const columnsInView =
                    viewport.width < 760
                        ? 2.65
                        : viewport.width < 1180
                          ? 4.15
                          : 5.35;
                layout.stepX = view.x / columnsInView;
                layout.stepY =
                    layout.stepX * (viewport.width < 760 ? 0.86 : 0.74);
                layout.totalX = layout.stepX * GRID_COLUMNS;
                layout.totalY = layout.stepY * GRID_ROWS;

                planes.forEach((plane) => {
                    const aspectRatio = clampAspectRatio(
                        mediaAspectRatio(plane.media),
                    );
                    const maxWidth = layout.stepX * 0.86;
                    const maxHeight = layout.stepY * 0.78;
                    let planeWidth = maxWidth;
                    let planeHeight = planeWidth / aspectRatio;

                    if (planeHeight > maxHeight) {
                        planeHeight = maxHeight;
                        planeWidth = planeHeight * aspectRatio;
                    }

                    plane.baseX =
                        (plane.column - (GRID_COLUMNS - 1) / 2) * layout.stepX +
                        (plane.row % 2) * layout.stepX * 0.16;
                    plane.baseY =
                        ((GRID_ROWS - 1) / 2 - plane.row) * layout.stepY;
                    plane.baseWidth = planeWidth;
                    plane.baseHeight = planeHeight;
                    plane.mesh.scale.set(planeWidth, planeHeight, 1);
                });
            };

            const updateHover = (clientX: number, clientY: number) => {
                if (pan.isDragging) {
                    return;
                }

                const media = pickMedia(
                    clientX,
                    clientY,
                    container,
                    camera,
                    raycaster,
                    pointer,
                    planes,
                );

                hoveredPlane =
                    media === null
                        ? null
                        : (planes.find(
                              (plane) => plane.media.id === media.id,
                          ) ?? null);
                planes.forEach((plane) => {
                    plane.hoverTarget = plane === hoveredPlane ? 1 : 0;
                });
            };

            const worldDeltaFromPointer = (deltaX: number, deltaY: number) => {
                const view = getViewSize(camera);
                const bounds = container.getBoundingClientRect();

                return new THREE.Vector2(
                    (deltaX / Math.max(bounds.width, 1)) * view.x,
                    (-deltaY / Math.max(bounds.height, 1)) * view.y,
                );
            };

            const handlePointerDown = (event: PointerEvent) => {
                if (
                    event.button !== 0 ||
                    isTransitioningRef.current ||
                    isTransitionedOutRef.current ||
                    isInteractiveTarget(event.target)
                ) {
                    return;
                }

                activePointerId = event.pointerId;
                pan.isDragging = true;
                pan.dragDistance = 0;
                pan.pointerStart.set(event.clientX, event.clientY);
                pan.pointerLast.copy(pan.pointerStart);
                pan.momentum.set(0, 0);
                dragAutoScrollVector.set(0, 0);
                distortionTarget = POINTER_DISTORTION;
                hoveredPlane = null;
                planes.forEach((plane) => {
                    plane.hoverTarget = 0;
                });
                container.classList.add('is-panning');

                try {
                    container.setPointerCapture(event.pointerId);
                } catch {
                    // Pointer capture can fail on older browsers; window handlers still cover dragging.
                }
            };

            const handlePointerMove = (event: PointerEvent) => {
                if (!pan.isDragging || event.pointerId !== activePointerId) {
                    return;
                }

                const deltaX = event.clientX - pan.pointerLast.x;
                const deltaY = event.clientY - pan.pointerLast.y;
                const worldDelta = worldDeltaFromPointer(deltaX, deltaY);

                pan.target.add(worldDelta);
                pan.momentum.copy(worldDelta).multiplyScalar(0.92);
                dragAutoScrollVector.add(worldDelta);
                pan.dragDistance = Math.max(
                    pan.dragDistance,
                    pan.pointerStart.distanceTo(
                        new THREE.Vector2(event.clientX, event.clientY),
                    ),
                );
                pan.pointerLast.set(event.clientX, event.clientY);
                distortionTarget = POINTER_DISTORTION;
                event.preventDefault();
            };

            const handlePointerUp = (event: PointerEvent) => {
                if (!pan.isDragging || event.pointerId !== activePointerId) {
                    return;
                }

                pan.isDragging = false;
                activePointerId = null;
                container.classList.remove('is-panning');

                try {
                    container.releasePointerCapture(event.pointerId);
                } catch {
                    // The browser may already have released capture.
                }

                if (
                    pan.dragDistance > DRAG_THRESHOLD &&
                    dragAutoScrollVector.lengthSq() > 0.0001
                ) {
                    autoScrollDirectionRef.current.copy(
                        dragAutoScrollVector.normalize(),
                    );
                }

                if (pan.dragDistance <= DRAG_THRESHOLD) {
                    const selected = pickMedia(
                        event.clientX,
                        event.clientY,
                        container,
                        camera,
                        raycaster,
                        pointer,
                        planes,
                    );

                    if (selected) {
                        onOpenRef.current(selected);
                    }
                }
            };

            const handleHoverMove = (event: PointerEvent) => {
                if (
                    pan.isDragging ||
                    isTransitioningRef.current ||
                    isTransitionedOutRef.current ||
                    isInteractiveTarget(event.target)
                ) {
                    return;
                }

                updateHover(event.clientX, event.clientY);
            };

            const handlePointerLeave = () => {
                if (pan.isDragging) {
                    return;
                }

                hoveredPlane = null;
                planes.forEach((plane) => {
                    plane.hoverTarget = 0;
                });
            };

            const handleWheel = (event: WheelEvent) => {
                if (
                    isTransitioningRef.current ||
                    isTransitionedOutRef.current ||
                    isInteractiveTarget(event.target)
                ) {
                    return;
                }

                event.preventDefault();

                const wheel = normalizeWheelDelta(event);
                const nextZoomTarget = clampCameraZ(
                    zoomTarget + wheel.y * 0.006,
                );

                if (Math.abs(nextZoomTarget - zoomTarget) > 0.0001) {
                    zoomTarget = nextZoomTarget;
                    cameraZRef.current = nextZoomTarget;
                    storeCameraZ(nextZoomTarget);
                }

                pan.target.x += -wheel.x * 0.002;
                distortionTarget = Math.max(distortionTarget, WHEEL_DISTORTION);
            };

            const animate = (time: number) => {
                if (isDisposed) {
                    return;
                }

                const delta =
                    Math.min((time - lastFrameTime) / 16.666, 2.4) || 1;
                const panEase = 1 - Math.pow(0.86, delta);
                const zoomEase = 1 - Math.pow(0.88, delta);
                const distortionEase = 1 - Math.pow(0.84, delta);

                lastFrameTime = time;

                if (!pan.isDragging) {
                    if (!isTransitionedOutRef.current) {
                        const autoScrollDirection =
                            autoScrollDirectionRef.current;

                        pan.target.x +=
                            autoScrollDirection.x *
                            layout.stepX *
                            AUTO_SCROLL_SPEED *
                            delta;
                        pan.target.y +=
                            autoScrollDirection.y *
                            layout.stepY *
                            AUTO_SCROLL_SPEED *
                            delta;
                    }

                    pan.target.add(pan.momentum.clone().multiplyScalar(delta));
                    pan.momentum.multiplyScalar(Math.pow(0.9, delta));

                    if (pan.momentum.lengthSq() < 0.000001) {
                        pan.momentum.set(0, 0);
                    }

                    distortionTarget *= Math.pow(0.9, delta);
                }

                pan.current.lerp(pan.target, panEase);
                camera.position.z +=
                    (zoomTarget - camera.position.z) * zoomEase;
                camera.updateProjectionMatrix();
                distortion += (distortionTarget - distortion) * distortionEase;
                pan.velocity.copy(pan.current).sub(pan.last);
                pan.last.copy(pan.current);

                planes.forEach((plane) => {
                    const x = wrapToCenter(
                        plane.baseX + pan.current.x,
                        layout.totalX,
                    );
                    const y = wrapToCenter(
                        plane.baseY + pan.current.y,
                        layout.totalY,
                    );
                    const velocityStretch = Math.min(
                        pan.velocity.length() * 0.18,
                        0.16,
                    );
                    const tint = 0.46 + plane.hover * 0.54;

                    plane.mesh.position.set(x, y, 0);
                    plane.mesh.rotation.z =
                        pan.velocity.x * 0.12 +
                        (plane.column - plane.row) * 0.0015 * distortion;
                    plane.mesh.scale.set(
                        plane.baseWidth * (1 + velocityStretch),
                        plane.baseHeight *
                            (1 + Math.min(distortion * 0.035, 0.06)),
                        1,
                    );
                    plane.hover +=
                        (plane.hoverTarget - plane.hover) * 0.14 * delta;
                    plane.mesh.material.color.setRGB(tint, tint, tint);
                });

                renderer.render(scene, camera);
                frameId = window.requestAnimationFrame(animate);
            };

            renderer.setClearColor(0x000000, 0);
            renderer.domElement.className = 'vault-gallery-v2__canvas';
            container.appendChild(renderer.domElement);
            scene.add(root);
            camera.position.z = zoomTarget;
            resize();

            planes.forEach((plane) => {
                if (plane.media.type === 'video') {
                    loadVideoTexture(
                        plane,
                        isEffectDisposed,
                        markTextureResult,
                    );
                    return;
                }

                loadImageTexture(
                    plane,
                    imageTextureUrls(plane.media),
                    isEffectDisposed,
                    markTextureResult,
                );
            });

            container.addEventListener('pointerdown', handlePointerDown);
            container.addEventListener('pointermove', handleHoverMove);
            container.addEventListener('pointerleave', handlePointerLeave);
            container.addEventListener('wheel', handleWheel, {
                passive: false,
            });
            window.addEventListener('pointermove', handlePointerMove, {
                passive: false,
            });
            window.addEventListener('pointerup', handlePointerUp);
            window.addEventListener('resize', resize);
            animate(performance.now());

            return () => {
                isDisposed = true;
                window.cancelAnimationFrame(frameId);
                stopTransition();
                container.removeEventListener('pointerdown', handlePointerDown);
                container.removeEventListener('pointermove', handleHoverMove);
                container.removeEventListener(
                    'pointerleave',
                    handlePointerLeave,
                );
                container.removeEventListener('wheel', handleWheel);
                window.removeEventListener('pointermove', handlePointerMove);
                window.removeEventListener('pointerup', handlePointerUp);
                window.removeEventListener('resize', resize);
                container.classList.remove('is-panning');

                planes.forEach((plane) => {
                    plane.video?.pause();
                    plane.video?.removeAttribute('src');
                    plane.video?.load();
                    plane.textures.forEach((texture) => texture.dispose());
                    plane.mesh.material.dispose();
                    root.remove(plane.mesh);
                });
                planesRef.current = [];
                geometry.dispose();
                renderer.renderLists.dispose();
                renderer.dispose();
                renderer.domElement.remove();
            };
        }, [
            mediaSignature,
            pickMedia,
            runPlaneFade,
            shouldFallback,
            stopTransition,
        ]);

        if (shouldFallback) {
            return <div className="vault-gallery-v2__fallback">{fallback}</div>;
        }

        return (
            <>
                <section
                    ref={stageRef}
                    aria-label="Infinite media plane gallery"
                    className="vault-gallery-v2__stage"
                />

                {isLoading || isPreparingScene ? (
                    <div
                        className="vault-gallery-v2__loading"
                        role="status"
                        aria-live="polite"
                    >
                        <span
                            className="vault-gallery-v2__loading-icon"
                            aria-hidden="true"
                        />
                        <span className="sr-only">Loading media</span>
                    </div>
                ) : null}
            </>
        );
    },
);

export default GalleryV2Scene;
