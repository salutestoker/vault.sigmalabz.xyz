import { type GalleryMedia } from '@/types/gallery';
import { Easing, Tween, update as updateTweens } from '@tweenjs/tween.js';
import {
    type CSSProperties,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import * as THREE from 'three';

interface OrbitGallerySceneProps {
    media: GalleryMedia[];
    isLoading: boolean;
    hasMore: boolean;
    onOpen: (media: GalleryMedia) => void;
    onLoadMore: () => void;
    fallback: ReactNode;
}

interface Viewport {
    width: number;
    height: number;
    dpr: number;
}

interface OrbitUniforms {
    uMap: THREE.IUniform<THREE.Texture>;
    uMediaSizes: THREE.IUniform<THREE.Vector2>;
    uOpacity: THREE.IUniform<number>;
    uPlaneSizes: THREE.IUniform<THREE.Vector2>;
    uStrength: THREE.IUniform<number>;
    uViewportSizes: THREE.IUniform<THREE.Vector2>;
    uHover: THREE.IUniform<number>;
}

interface OrbitItem {
    media: GalleryMedia;
    mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
    uniforms: OrbitUniforms;
    rect: DOMRect;
    extra: THREE.Vector2;
    texture: THREE.Texture;
    textures: THREE.Texture[];
    video?: HTMLVideoElement;
    rotationTarget: number;
}

interface ScrollState {
    current: THREE.Vector2;
    target: THREE.Vector2;
    last: THREE.Vector2;
    momentum: THREE.Vector2;
    pointerStart: THREE.Vector2;
    pointerLast: THREE.Vector2;
    dragDistance: number;
    isDragging: boolean;
    strength: number;
    strengthTarget: number;
}

const MIN_ORBIT_ITEMS = 6;
const AUTO_SCROLL_SPEED = 0.32;
const CAMERA_Z = 800;
const DRAG_THRESHOLD = 10;
const MAX_DEVICE_PIXEL_RATIO = 2;
const LOAD_MORE_DELAY = 140;
const WHEEL_SCROLL_MULTIPLIER = 0.34;
const WHEEL_MOMENTUM_MULTIPLIER = 0.07;

const vertexShader = `
uniform float uStrength;
uniform vec2 uViewportSizes;
varying vec2 vUv;

void main() {
    vec3 transformed = position;
    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vec2 normalized = worldPosition.xy / max(uViewportSizes * 0.5, vec2(1.0));
    float distanceFromCenter = clamp(length(normalized), 0.0, 1.8);
    float wave = sin((normalized.x + normalized.y) * 1.57079632679);

    transformed.z += wave * uStrength * 18.0;
    transformed.z -= smoothstep(0.0, 1.45, distanceFromCenter) * uStrength * 42.0;

    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D uMap;
uniform vec2 uMediaSizes;
uniform float uOpacity;
uniform vec2 uPlaneSizes;
uniform float uHover;
varying vec2 vUv;

vec2 coverUv(vec2 uv, vec2 planeSize, vec2 mediaSize) {
    vec2 safePlane = max(planeSize, vec2(1.0));
    vec2 safeMedia = max(mediaSize, vec2(1.0));
    float planeRatio = safePlane.x / safePlane.y;
    float mediaRatio = safeMedia.x / safeMedia.y;
    vec2 ratio = vec2(1.0);

    if (planeRatio > mediaRatio) {
        ratio.y = mediaRatio / planeRatio;
    } else {
        ratio.x = planeRatio / mediaRatio;
    }

    return (uv - 0.5) * ratio + 0.5;
}

void main() {
    vec2 uv = coverUv(vUv, uPlaneSizes, uMediaSizes);
    vec4 image = texture2D(uMap, uv);
    float gray = dot(image.rgb, vec3(0.299, 0.587, 0.114));
    float reveal = smoothstep(0.0, 1.0, uHover);
    vec3 muted = vec3(gray) * 0.52;
    vec3 color = mix(muted, image.rgb * 1.05, reveal);

    gl_FragColor = vec4(color, image.a * uOpacity);
}
`;

function useReducedMotion(): boolean {
    const [reducedMotion, setReducedMotion] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    useEffect(() => {
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

function useOrbitColumns(): number {
    const [columns, setColumns] = useState(7);

    useEffect(() => {
        const updateColumns = () => {
            if (window.innerWidth < 760) {
                setColumns(3);
                return;
            }

            if (window.innerWidth < 1180) {
                setColumns(5);
                return;
            }

            setColumns(7);
        };

        updateColumns();
        window.addEventListener('resize', updateColumns);

        return () => window.removeEventListener('resize', updateColumns);
    }, []);

    return columns;
}

function mediaAspectRatio(media: GalleryMedia): number {
    if (media.width && media.height && media.width > 0 && media.height > 0) {
        return media.width / media.height;
    }

    return media.type === 'video' ? 16 / 9 : 1;
}

function mediaSourceUrl(media: GalleryMedia): string | null {
    return media.media_url ?? media.preview_url ?? media.thumbnail_url ?? null;
}

function mediaPosterUrl(media: GalleryMedia): string | null {
    return media.thumbnail_url ?? media.preview_url ?? media.media_url ?? null;
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

function createPlaceholderTexture(): THREE.DataTexture {
    const texture = new THREE.DataTexture(
        new Uint8Array([14, 14, 14, 255]),
        1,
        1,
        THREE.RGBAFormat,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    return texture;
}

function createMaterial(texture: THREE.Texture): {
    material: THREE.ShaderMaterial;
    uniforms: OrbitUniforms;
} {
    const uniforms: OrbitUniforms = {
        uMap: { value: texture },
        uMediaSizes: { value: new THREE.Vector2(1, 1) },
        uOpacity: { value: 0 },
        uPlaneSizes: { value: new THREE.Vector2(1, 1) },
        uStrength: { value: 0 },
        uViewportSizes: { value: new THREE.Vector2(1, 1) },
        uHover: { value: 0 },
    };

    return {
        material: new THREE.ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            fragmentShader,
            transparent: true,
            uniforms:
                uniforms as unknown as THREE.ShaderMaterialParameters['uniforms'],
            vertexShader,
        }),
        uniforms,
    };
}

function prepareTexture(texture: THREE.Texture): THREE.Texture {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    return texture;
}

function getTextureImageSize(texture: THREE.Texture): THREE.Vector2 {
    const image = texture.image as
        | HTMLImageElement
        | HTMLCanvasElement
        | ImageBitmap
        | undefined;

    if (image && 'naturalWidth' in image && image.naturalWidth > 0) {
        return new THREE.Vector2(image.naturalWidth, image.naturalHeight);
    }

    if (image && 'width' in image && image.width > 0) {
        return new THREE.Vector2(image.width, image.height);
    }

    return new THREE.Vector2(1, 1);
}

function setItemTexture(
    item: OrbitItem,
    texture: THREE.Texture,
    size: THREE.Vector2,
): void {
    item.texture = texture;
    item.textures.push(texture);
    item.uniforms.uMap.value = texture;
    item.uniforms.uMediaSizes.value.copy(size);
}

function loadImageTexture(
    item: OrbitItem,
    urls: string[],
    isDisposed: () => boolean,
): void {
    const [url, ...rest] = urls.filter(Boolean);

    if (!url || isDisposed()) {
        return;
    }

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
        url,
        (texture) => {
            if (isDisposed()) {
                texture.dispose();
                return;
            }

            const preparedTexture = prepareTexture(texture);
            setItemTexture(item, preparedTexture, getTextureImageSize(texture));
        },
        undefined,
        () => loadImageTexture(item, rest, isDisposed),
    );
}

function loadVideoTexture(item: OrbitItem, isDisposed: () => boolean): void {
    const videoUrl = item.media.media_url;
    const fallbackUrls = [
        item.media.thumbnail_url,
        item.media.preview_url,
        item.media.media_url,
    ].filter((url): url is string => Boolean(url));

    if (!videoUrl) {
        loadImageTexture(item, fallbackUrls, isDisposed);
        return;
    }

    const video = document.createElement('video');
    let settled = false;
    let timeoutId = window.setTimeout(() => {
        if (!settled) {
            failToImage();
        }
    }, 4500);

    const cleanupVideo = () => {
        window.clearTimeout(timeoutId);
        video.pause();
        video.removeAttribute('src');
        video.load();
    };

    const failToImage = () => {
        if (settled || isDisposed()) {
            return;
        }

        settled = true;
        cleanupVideo();
        item.video = undefined;
        loadImageTexture(item, fallbackUrls, isDisposed);
    };

    const attachTexture = async () => {
        if (settled || isDisposed()) {
            return;
        }

        try {
            await video.play();

            if (isDisposed()) {
                cleanupVideo();
                return;
            }

            settled = true;
            window.clearTimeout(timeoutId);

            const texture = prepareTexture(new THREE.VideoTexture(video));
            setItemTexture(
                item,
                texture,
                new THREE.Vector2(
                    video.videoWidth || item.media.width || 1,
                    video.videoHeight || item.media.height || 1,
                ),
            );
            item.video = video;
        } catch {
            failToImage();
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
    video.addEventListener('error', failToImage, { once: true });
    video.load();
    item.video = video;
}

function randomRotation(): number {
    return (Math.random() - 0.5) * 0.07;
}

export default function OrbitGalleryScene({
    media,
    isLoading,
    hasMore,
    onLoadMore,
    onOpen,
    fallback,
}: OrbitGallerySceneProps) {
    const reducedMotion = useReducedMotion();
    const columns = useOrbitColumns();
    const [hasWebGLError, setHasWebGLError] = useState(false);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const measureRef = useRef<HTMLDivElement | null>(null);
    const fallbackSentinelRef = useRef<HTMLDivElement | null>(null);
    const onOpenRef = useRef(onOpen);
    const onLoadMoreRef = useRef(onLoadMore);
    const shouldFallback =
        reducedMotion || hasWebGLError || media.length < MIN_ORBIT_ITEMS;
    const measureStyle = useMemo(
        () =>
            ({
                '--orbit-columns': columns,
            }) as CSSProperties,
        [columns],
    );

    useEffect(() => {
        onOpenRef.current = onOpen;
    }, [onOpen]);

    useEffect(() => {
        onLoadMoreRef.current = onLoadMore;
    }, [onLoadMore]);

    useEffect(() => {
        if (shouldFallback || isLoading || !hasMore || media.length === 0) {
            return;
        }

        const timeout = window.setTimeout(() => {
            onLoadMoreRef.current();
        }, LOAD_MORE_DELAY);

        return () => window.clearTimeout(timeout);
    }, [hasMore, isLoading, media.length, shouldFallback]);

    useEffect(() => {
        if (!shouldFallback || !hasMore || isLoading) {
            return;
        }

        const sentinel = fallbackSentinelRef.current;

        if (!sentinel) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;

            if (entry.isIntersecting) {
                onLoadMoreRef.current();
            }
        });

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, [hasMore, isLoading, shouldFallback]);

    const pickMedia = useCallback(
        (
            clientX: number,
            clientY: number,
            container: HTMLDivElement,
            camera: THREE.PerspectiveCamera,
            raycaster: THREE.Raycaster,
            pointer: THREE.Vector2,
            items: OrbitItem[],
        ) => {
            const bounds = container.getBoundingClientRect();
            pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);

            const intersections = raycaster.intersectObjects(
                items.map((item) => item.mesh),
                false,
            );

            const intersection = intersections[0];

            if (!intersection) {
                return;
            }

            const matchedItem = items.find(
                (item) => item.mesh === intersection.object,
            );

            if (matchedItem) {
                onOpenRef.current(matchedItem.media);
            }
        },
        [],
    );

    useEffect(() => {
        if (shouldFallback) {
            return;
        }

        const container = stageRef.current;
        const measurementRoot = measureRef.current;

        if (!container || !measurementRoot) {
            return;
        }

        let isDisposed = false;
        let frameId = 0;
        let initializationFrame = 0;
        let renderer: THREE.WebGLRenderer | null = null;
        let hoveredItem: OrbitItem | null = null;
        let wrapperBounds = {
            width: window.innerWidth,
            height: window.innerHeight,
        };
        let activePointerId: number | null = null;

        const isEffectDisposed = () => isDisposed;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const geometry = new THREE.PlaneGeometry(1, 1, 32, 32);
        const scroll: ScrollState = {
            current: new THREE.Vector2(),
            target: new THREE.Vector2(),
            last: new THREE.Vector2(),
            momentum: new THREE.Vector2(),
            pointerStart: new THREE.Vector2(),
            pointerLast: new THREE.Vector2(),
            dragDistance: 0,
            isDragging: false,
            strength: 0,
            strengthTarget: 0,
        };
        const viewport: Viewport = {
            width: window.innerWidth,
            height: window.innerHeight,
            dpr: Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO),
        };
        const items: OrbitItem[] = [];
        const tweens: Tween<{ opacity: number }>[] = [];

        const updateViewport = () => {
            viewport.width = window.innerWidth;
            viewport.height = window.innerHeight;
            viewport.dpr = Math.min(
                window.devicePixelRatio || 1,
                MAX_DEVICE_PIXEL_RATIO,
            );

            camera.aspect = viewport.width / viewport.height;
            camera.fov =
                2 * Math.atan(viewport.height / 2 / CAMERA_Z) * (180 / Math.PI);
            camera.position.z = CAMERA_Z;
            camera.updateProjectionMatrix();

            renderer?.setPixelRatio(viewport.dpr);
            renderer?.setSize(viewport.width, viewport.height);
        };

        const refreshMeasurements = () => {
            const figures = Array.from(
                measurementRoot.querySelectorAll<HTMLElement>(
                    '[data-orbit-measure]',
                ),
            );
            const wrapperRect = measurementRoot.getBoundingClientRect();
            wrapperBounds = {
                width: Math.max(wrapperRect.width, viewport.width),
                height: Math.max(
                    viewport.height * 1.35,
                    Math.min(wrapperRect.height, viewport.height * 2.15),
                ),
            };

            items.forEach((item, index) => {
                const figure = figures[index];
                const rect = figure?.getBoundingClientRect();

                if (!rect) {
                    return;
                }

                item.rect = rect;
                item.mesh.scale.set(rect.width, rect.height, 1);
                item.uniforms.uPlaneSizes.value.set(rect.width, rect.height);
                item.uniforms.uViewportSizes.value.set(
                    viewport.width,
                    viewport.height,
                );
            });
        };

        const updatePointer = (clientX: number, clientY: number) => {
            const bounds = container.getBoundingClientRect();
            pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
        };

        const updateHover = (clientX: number, clientY: number) => {
            if (scroll.isDragging) {
                hoveredItem = null;
                return;
            }

            updatePointer(clientX, clientY);
            raycaster.setFromCamera(pointer, camera);

            const intersections = raycaster.intersectObjects(
                items.map((item) => item.mesh),
                false,
            );
            const mesh = intersections[0]?.object;

            hoveredItem = items.find((item) => item.mesh === mesh) ?? null;
        };

        const wrapItem = (item: OrbitItem) => {
            const margin = Math.max(item.rect.width, item.rect.height) * 1.35;
            const horizontalLimit = viewport.width / 2 + margin;
            const verticalLimit = viewport.height / 2 + margin;
            let changed = false;
            let guard = 0;

            while (item.mesh.position.x < -horizontalLimit && guard < 12) {
                item.extra.x += wrapperBounds.width;
                changed = true;
                guard += 1;
            }

            while (item.mesh.position.x > horizontalLimit && guard < 24) {
                item.extra.x -= wrapperBounds.width;
                changed = true;
                guard += 1;
            }

            while (item.mesh.position.y < -verticalLimit && guard < 36) {
                item.extra.y += wrapperBounds.height;
                changed = true;
                guard += 1;
            }

            while (item.mesh.position.y > verticalLimit && guard < 48) {
                item.extra.y -= wrapperBounds.height;
                changed = true;
                guard += 1;
            }

            if (changed) {
                item.rotationTarget = randomRotation();
            }
        };

        const updateItems = () => {
            items.forEach((item) => {
                const baseX =
                    item.rect.left - viewport.width / 2 + item.rect.width / 2;
                const baseY =
                    -item.rect.top + viewport.height / 2 - item.rect.height / 2;

                item.mesh.position.x = baseX - scroll.current.x + item.extra.x;
                item.mesh.position.y = baseY + scroll.current.y + item.extra.y;
                wrapItem(item);
                item.mesh.position.x = baseX - scroll.current.x + item.extra.x;
                item.mesh.position.y = baseY + scroll.current.y + item.extra.y;
                item.mesh.rotation.z +=
                    (item.rotationTarget - item.mesh.rotation.z) * 0.045;
                item.uniforms.uStrength.value = scroll.strength;
                item.uniforms.uHover.value +=
                    ((hoveredItem === item ? 1 : 0) -
                        item.uniforms.uHover.value) *
                    0.12;
            });
        };

        const tick = (time: number) => {
            if (isDisposed || !renderer) {
                return;
            }

            if (!scroll.isDragging) {
                scroll.target.y += AUTO_SCROLL_SPEED;
                scroll.target.add(scroll.momentum);
                scroll.momentum.multiplyScalar(0.92);

                if (scroll.momentum.lengthSq() < 0.01) {
                    scroll.momentum.set(0, 0);
                }
            }

            scroll.current.lerp(scroll.target, 0.08);

            const movementX = scroll.current.x - scroll.last.x;
            const movementY = scroll.current.y - scroll.last.y;
            const movement = Math.hypot(movementX, movementY);
            scroll.strengthTarget = Math.min(movement * 0.012, 1);
            scroll.strength += (scroll.strengthTarget - scroll.strength) * 0.08;

            updateTweens(time);
            updateItems();
            renderer.render(scene, camera);
            scroll.last.copy(scroll.current);

            frameId = window.requestAnimationFrame(tick);
        };

        const handleResize = () => {
            updateViewport();
            refreshMeasurements();
        };

        const handleWheel = (event: WheelEvent) => {
            if (isInteractiveTarget(event.target)) {
                return;
            }

            event.preventDefault();

            const delta = normalizeWheelDelta(event);
            scroll.target.x += delta.x * WHEEL_SCROLL_MULTIPLIER;
            scroll.target.y += delta.y * WHEEL_SCROLL_MULTIPLIER;
            scroll.momentum.set(
                delta.x * WHEEL_MOMENTUM_MULTIPLIER,
                delta.y * WHEEL_MOMENTUM_MULTIPLIER,
            );
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (isInteractiveTarget(event.target)) {
                return;
            }

            event.preventDefault();
            activePointerId = event.pointerId;
            scroll.isDragging = true;
            scroll.dragDistance = 0;
            scroll.momentum.set(0, 0);
            scroll.pointerStart.set(event.clientX, event.clientY);
            scroll.pointerLast.copy(scroll.pointerStart);
            hoveredItem = null;
            container.classList.add('is-panning');
            container.setPointerCapture(event.pointerId);
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (
                activePointerId !== null &&
                event.pointerId !== activePointerId
            ) {
                return;
            }

            if (!scroll.isDragging) {
                return;
            }

            event.preventDefault();

            const dx = event.clientX - scroll.pointerLast.x;
            const dy = event.clientY - scroll.pointerLast.y;

            scroll.dragDistance += Math.hypot(dx, dy);
            scroll.target.x -= dx * 1.18;
            scroll.target.y -= dy * 1.18;
            scroll.momentum.set(-dx * 1.7, -dy * 1.7);
            scroll.pointerLast.set(event.clientX, event.clientY);
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (!scroll.isDragging) {
                return;
            }

            if (
                activePointerId !== null &&
                event.pointerId !== activePointerId
            ) {
                return;
            }

            scroll.isDragging = false;
            activePointerId = null;
            container.classList.remove('is-panning');

            try {
                container.releasePointerCapture(event.pointerId);
            } catch {
                // Pointer capture can already be released when the browser cancels.
            }

            if (scroll.dragDistance <= DRAG_THRESHOLD) {
                pickMedia(
                    event.clientX,
                    event.clientY,
                    container,
                    camera,
                    raycaster,
                    pointer,
                    items,
                );
            }
        };

        const handlePointerCancel = (event: PointerEvent) => {
            if (
                activePointerId !== null &&
                event.pointerId !== activePointerId
            ) {
                return;
            }

            scroll.isDragging = false;
            activePointerId = null;
            container.classList.remove('is-panning');
        };

        const handlePointerHover = (event: PointerEvent) => {
            if (!scroll.isDragging) {
                updateHover(event.clientX, event.clientY);
            }
        };

        const handleClick = (event: MouseEvent) => {
            if (
                isInteractiveTarget(event.target) ||
                scroll.dragDistance > DRAG_THRESHOLD
            ) {
                return;
            }

            pickMedia(
                event.clientX,
                event.clientY,
                container,
                camera,
                raycaster,
                pointer,
                items,
            );
        };

        const initialize = () => {
            if (isDisposed) {
                return;
            }

            try {
                renderer = new THREE.WebGLRenderer({
                    alpha: true,
                    antialias: true,
                    powerPreference: 'high-performance',
                });
            } catch {
                setHasWebGLError(true);
                return;
            }

            setHasWebGLError(false);
            renderer.setClearColor(0x000000, 0);
            container.textContent = '';
            container.appendChild(renderer.domElement);
            updateViewport();

            media.forEach((itemMedia, index) => {
                const placeholderTexture = createPlaceholderTexture();
                const { material, uniforms } =
                    createMaterial(placeholderTexture);
                const mesh = new THREE.Mesh(geometry, material);
                const item: OrbitItem = {
                    media: itemMedia,
                    mesh,
                    uniforms,
                    rect: new DOMRect(0, 0, 1, 1),
                    extra: new THREE.Vector2(),
                    texture: placeholderTexture,
                    textures: [placeholderTexture],
                    rotationTarget: randomRotation(),
                };

                mesh.renderOrder = index;
                mesh.rotation.z = item.rotationTarget;
                scene.add(mesh);
                items.push(item);

                const opacityTween = new Tween({ opacity: 0 }, true)
                    .to({ opacity: 1 }, 650)
                    .delay(index * 18)
                    .easing(Easing.Cubic.Out)
                    .onUpdate(({ opacity }) => {
                        uniforms.uOpacity.value = opacity;
                    })
                    .start();
                tweens.push(opacityTween);

                if (itemMedia.type === 'video') {
                    loadVideoTexture(item, isEffectDisposed);
                } else {
                    const sourceUrl = mediaSourceUrl(itemMedia);

                    if (sourceUrl) {
                        loadImageTexture(item, [sourceUrl], isEffectDisposed);
                    }
                }
            });

            refreshMeasurements();
            updateItems();

            window.addEventListener('resize', handleResize);
            window.addEventListener('wheel', handleWheel, { passive: false });
            window.addEventListener('pointermove', handlePointerMove, {
                passive: false,
            });
            window.addEventListener('pointerup', handlePointerUp);
            window.addEventListener('pointercancel', handlePointerCancel);
            container.addEventListener('pointerdown', handlePointerDown);
            container.addEventListener('pointermove', handlePointerHover);
            container.addEventListener('click', handleClick);

            frameId = window.requestAnimationFrame(tick);
        };

        initializationFrame = window.requestAnimationFrame(() => {
            initializationFrame = window.requestAnimationFrame(initialize);
        });

        return () => {
            isDisposed = true;
            window.cancelAnimationFrame(initializationFrame);
            window.cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerCancel);
            container.removeEventListener('pointerdown', handlePointerDown);
            container.removeEventListener('pointermove', handlePointerHover);
            container.removeEventListener('click', handleClick);
            container.classList.remove('is-panning');
            tweens.forEach((tween) => tween.stop());

            items.forEach((item) => {
                item.video?.pause();
                item.video?.removeAttribute('src');
                item.video?.load();
                item.textures.forEach((texture) => texture.dispose());
                item.mesh.material.dispose();
                scene.remove(item.mesh);
            });

            geometry.dispose();
            renderer?.dispose();
            renderer?.domElement.remove();
        };
    }, [media, pickMedia, shouldFallback]);

    if (shouldFallback) {
        return (
            <section className="vault-gallery__orbit-fallback">
                {fallback}

                {isLoading && media.length > 0 && (
                    <div className="vault-gallery__loading">Loading</div>
                )}

                <div
                    ref={fallbackSentinelRef}
                    className="vault-gallery__sentinel"
                    aria-hidden="true"
                />
            </section>
        );
    }

    return (
        <section
            className="vault-gallery__orbit-stage"
            aria-label="Interactive gallery"
        >
            <div
                ref={stageRef}
                className="vault-gallery__orbit-canvas"
                aria-hidden="true"
            />

            <div
                ref={measureRef}
                className="vault-gallery__orbit-measure"
                style={measureStyle}
                aria-hidden="true"
            >
                {media.map((item, index) => (
                    <figure
                        key={item.id}
                        className="vault-gallery__orbit-measure-card"
                        data-orbit-measure
                        data-orbit-index={index}
                        style={{
                            aspectRatio: mediaAspectRatio(item),
                        }}
                    >
                        {mediaPosterUrl(item) && <span>{item.title}</span>}
                    </figure>
                ))}
            </div>

            {isLoading && media.length > 0 && (
                <div className="vault-gallery__orbit-loading">Loading</div>
            )}
        </section>
    );
}
