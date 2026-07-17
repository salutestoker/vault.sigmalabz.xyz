/*
 * WebGL gallery behavior adapted from Codrops' "Infinite WebGL Images"
 * demo by Luis Henrique Bizarro. See THIRD_PARTY_NOTICES.md.
 */
import LoadingVideo from '@/Components/LoadingVideo';
import {
    Camera,
    Mesh,
    Plane,
    Program,
    Renderer,
    Texture,
    Transform,
    type OGLRenderingContext,
} from 'ogl';
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from 'react';

const vertexShader = `
#define PI 3.1415926535897932384626433832795

precision highp float;
precision highp int;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float uStrength;
uniform vec2 uViewportSizes;

varying vec2 vUv;

void main() {
  vec4 newPosition = modelViewMatrix * vec4(position, 1.0);

  newPosition.z += sin(newPosition.y / uViewportSizes.y * PI + PI / 2.0) * -uStrength;

  vUv = uv;

  gl_Position = projectionMatrix * newPosition;
}
`;

const fragmentShader = `
precision highp float;

uniform vec2 uImageSizes;
uniform vec2 uPlaneSizes;
uniform float uStrength;
uniform sampler2D tMap;

varying vec2 vUv;

void main() {
  vec2 ratio = vec2(
    min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
    min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
  );

  vec2 uv = vec2(
    vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );

  vec2 displacement = vec2(0.0, clamp(uStrength * 0.025, -0.045, 0.045));

  gl_FragColor.rgb = vec3(
    texture2D(tMap, uv + displacement).r,
    texture2D(tMap, uv).g,
    texture2D(tMap, uv - displacement).b
  );
  gl_FragColor.a = 1.0;
}
`;

const lerp = (start: number, end: number, amount: number) =>
    start + (end - start) * amount;

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const shaderStrengthMultiplier = 640;
const maxShaderStrength = 2.35;
const autoScrollSpeed = 1;
const targetFrameDuration = 1000 / 60;

const getShaderStrength = (velocity: number, screenWidth: number) =>
    clamp(
        (velocity / Math.max(screenWidth, 1)) * shaderStrengthMultiplier,
        -maxShaderStrength,
        maxShaderStrength,
    );

const getWheelDelta = (event: WheelEvent) => {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return event.deltaY * 16;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return event.deltaY * window.innerHeight;
    }

    return event.deltaY;
};

interface GalleryAction {
    href: string;
    icon?: ReactNode;
    label: string;
    variant?: 'primary' | 'secondary';
}

interface InfiniteWebGLGalleryProps {
    actions?: GalleryAction[];
    images: string[];
    subtitle?: string;
    title: string;
}

interface FigureLayout {
    height: number;
    left?: number;
    right?: number;
    top: number;
    width: number;
}

const desktopLayouts: FigureLayout[] = [
    { height: 40, top: 0, width: 70 },
    { height: 50, left: 85, top: 30, width: 40 },
    { height: 50, left: 15, top: 60, width: 60 },
    { height: 30, right: 0, top: 10, width: 50 },
    { height: 60, right: 15, top: 55, width: 40 },
    { height: 75, left: 5, top: 120, width: 57.5 },
    { height: 70, right: 0, top: 130, width: 50 },
    { height: 50, left: 85, top: 95, width: 40 },
    { height: 65, left: 75, top: 155, width: 50 },
    { height: 43, right: 0, top: 215, width: 30 },
    { height: 50, left: 70, top: 235, width: 80 },
    { height: 70, left: 0, top: 210, width: 50 },
];

const mobileLayouts: FigureLayout[] = [
    { height: 60, top: 0, width: 100 },
    { height: 110, right: 0, top: 25, width: 70 },
    { height: 80, left: 12, top: 80, width: 89 },
    { height: 60, right: 0, top: 153, width: 60 },
    { height: 110, left: 0, top: 180, width: 70 },
    { height: 135, left: 95, top: 230, width: 87.5 },
    { height: 110, left: 0, top: 310, width: 80 },
    { height: 50, right: 0, top: 385, width: 80 },
    { height: 100, left: 110, top: 450, width: 70 },
    { height: 50, left: 20, top: 440, width: 55 },
    { height: 70, right: 0, top: 570, width: 70 },
    { height: 100, left: 0, top: 515, width: 90 },
];

const desktopCycleHeight = 295;
const mobileCycleHeight = 650;
const layoutCycleSize = desktopLayouts.length;

type FigureStyle = CSSProperties & Record<`--gallery-${string}`, string>;

const toLength = (value?: number) =>
    value === undefined ? 'auto' : `calc(${value} * var(--gallery-unit))`;

const createFigureStyle = (index: number): FigureStyle => {
    const layoutIndex = index % desktopLayouts.length;
    const cycleIndex = Math.floor(index / desktopLayouts.length);
    const desktop = desktopLayouts[layoutIndex];
    const mobile = mobileLayouts[layoutIndex];

    return {
        '--gallery-height': `calc(${desktop.height} * var(--gallery-unit))`,
        '--gallery-left': toLength(desktop.left),
        '--gallery-mobile-height': `calc(${mobile.height} * var(--gallery-unit))`,
        '--gallery-mobile-left': toLength(mobile.left),
        '--gallery-mobile-right': toLength(mobile.right),
        '--gallery-mobile-top': `calc(${mobile.top + cycleIndex * mobileCycleHeight} * var(--gallery-unit))`,
        '--gallery-mobile-width': `calc(${mobile.width} * var(--gallery-unit))`,
        '--gallery-right': toLength(desktop.right),
        '--gallery-top': `calc(${desktop.top + cycleIndex * desktopCycleHeight} * var(--gallery-unit))`,
        '--gallery-width': `calc(${desktop.width} * var(--gallery-unit))`,
    };
};

const getTrackStyle = (imageCount: number): FigureStyle => {
    const getLayoutSpan = (layouts: FigureLayout[], cycleHeight: number) => {
        if (imageCount === 0) {
            return cycleHeight;
        }

        return Math.max(
            ...Array.from({ length: imageCount }, (_, index) => {
                const layout = layouts[index % layouts.length];
                const cycleIndex = Math.floor(index / layouts.length);

                return layout.top + cycleIndex * cycleHeight + layout.height;
            }),
        );
    };

    return {
        '--gallery-height': `calc(${getLayoutSpan(desktopLayouts, desktopCycleHeight)} * var(--gallery-unit))`,
        '--gallery-mobile-height': `calc(${getLayoutSpan(mobileLayouts, mobileCycleHeight)} * var(--gallery-unit))`,
    };
};

const fillLayoutCycle = (images: string[]) => {
    if (images.length === 0) {
        return images;
    }

    const targetLength =
        Math.ceil(images.length / layoutCycleSize) * layoutCycleSize;

    return Array.from(
        { length: targetLength },
        (_, index) => images[index % images.length],
    );
};

interface ScreenSize {
    height: number;
    width: number;
}

interface ViewportSize {
    height: number;
    width: number;
}

interface ScrollState {
    current: number;
    ease: number;
    last: number;
    position?: number;
    target: number;
}

interface GalleryMediaOptions {
    element: HTMLElement;
    geometry: Plane;
    gl: OGLRenderingContext;
    height: number;
    scene: Transform;
    screen: ScreenSize;
    viewport: ViewportSize;
}

class GalleryMedia {
    private bounds: DOMRect;
    private readonly element: HTMLElement;
    private extra = 0;
    private readonly geometry: Plane;
    private readonly gl: OGLRenderingContext;
    private height: number;
    private readonly image: HTMLImageElement;
    private readonly loadedImage: HTMLImageElement;
    private readonly plane: Mesh<Plane, Program>;
    private readonly scene: Transform;
    private screen: ScreenSize;
    private texture!: Texture;
    private viewport: ViewportSize;

    constructor({
        element,
        geometry,
        gl,
        height,
        scene,
        screen,
        viewport,
    }: GalleryMediaOptions) {
        const image = element.querySelector('img');

        if (!image) {
            throw new Error('Gallery figure is missing its image element.');
        }

        this.bounds = element.getBoundingClientRect();
        this.element = element;
        this.geometry = geometry;
        this.gl = gl;
        this.height = height;
        this.image = image;
        this.loadedImage = new Image();
        this.scene = scene;
        this.screen = screen;
        this.viewport = viewport;

        this.plane = this.createMesh();
        this.createBounds();
        this.onResize();
    }

    destroy() {
        this.loadedImage.onload = null;
        this.loadedImage.onerror = null;
        this.plane.setParent(null);
        this.plane.program.remove();
        this.gl.deleteTexture(this.texture.texture);
    }

    onResize(sizes?: {
        height?: number;
        screen?: ScreenSize;
        viewport?: ViewportSize;
    }) {
        this.extra = 0;

        if (sizes?.height) {
            this.height = sizes.height;
        }

        if (sizes?.screen) {
            this.screen = sizes.screen;
        }

        if (sizes?.viewport) {
            this.viewport = sizes.viewport;
            this.plane.program.uniforms.uViewportSizes.value = [
                this.viewport.width,
                this.viewport.height,
            ];
        }

        this.createBounds();
    }

    update(scroll: ScrollState, direction: 'down' | 'up') {
        this.updateScale();
        this.updateX();
        this.updateY(scroll.current);

        const planeOffset = this.plane.scale.y / 2;
        const viewportOffset = this.viewport.height / 2;
        const isBefore = this.plane.position.y + planeOffset < -viewportOffset;
        const isAfter = this.plane.position.y - planeOffset > viewportOffset;

        if (direction === 'up' && isBefore) {
            this.extra -= this.height;
        }

        if (direction === 'down' && isAfter) {
            this.extra += this.height;
        }

        this.plane.program.uniforms.uStrength.value = getShaderStrength(
            scroll.current - scroll.last,
            this.screen.width,
        );
    }

    private createBounds() {
        this.bounds = this.element.getBoundingClientRect();
        this.updateScale();
        this.updateX();
        this.updateY();
        this.plane.program.uniforms.uPlaneSizes.value = [
            this.plane.scale.x,
            this.plane.scale.y,
        ];
    }

    private createMesh() {
        this.texture = new Texture(this.gl, {
            generateMipmaps: false,
        });

        const program = new Program(this.gl, {
            fragment: fragmentShader,
            transparent: true,
            uniforms: {
                tMap: { value: this.texture },
                uImageSizes: { value: [1, 1] },
                uPlaneSizes: { value: [0, 0] },
                uStrength: { value: 0 },
                uViewportSizes: {
                    value: [this.viewport.width, this.viewport.height],
                },
            },
            vertex: vertexShader,
        });

        this.loadedImage.crossOrigin = 'anonymous';
        this.loadedImage.decoding = 'async';
        this.loadedImage.onload = () => {
            program.uniforms.uImageSizes.value = [
                this.loadedImage.naturalWidth,
                this.loadedImage.naturalHeight,
            ];
            this.texture.image = this.loadedImage;
        };
        this.loadedImage.src = this.image.currentSrc || this.image.src;

        const plane = new Mesh(this.gl, {
            geometry: this.geometry,
            program,
        });

        plane.setParent(this.scene);

        return plane;
    }

    private updateScale() {
        this.plane.scale.x =
            (this.viewport.width * this.bounds.width) / this.screen.width;
        this.plane.scale.y =
            (this.viewport.height * this.bounds.height) / this.screen.height;
    }

    private updateX(x = 0) {
        this.plane.position.x =
            -(this.viewport.width / 2) +
            this.plane.scale.x / 2 +
            ((this.bounds.left - x) / this.screen.width) * this.viewport.width;
    }

    private updateY(y = 0) {
        this.plane.position.y =
            this.viewport.height / 2 -
            this.plane.scale.y / 2 -
            ((this.bounds.top - y) / this.screen.height) *
                this.viewport.height -
            this.extra;
    }
}

interface GalleryRuntimeOptions {
    canvasContainer: HTMLElement;
    gallery: HTMLElement;
}

class GalleryRuntime {
    private readonly boundOnMouseDown = this.onTouchDown.bind(this);
    private readonly boundOnMouseMove = this.onTouchMove.bind(this);
    private readonly boundOnMouseUp = this.onTouchUp.bind(this);
    private readonly boundOnResize = this.onResize.bind(this);
    private readonly boundOnTouchEnd = this.onTouchUp.bind(this);
    private readonly boundOnTouchMove = this.onTouchMove.bind(this);
    private readonly boundOnTouchStart = this.onTouchDown.bind(this);
    private readonly boundOnWheel = this.onWheel.bind(this);
    private readonly camera: Camera;
    private direction: 'down' | 'up' = 'down';
    private readonly gallery: HTMLElement;
    private galleryBounds: DOMRect;
    private galleryHeight = 0;
    private readonly geometry: Plane;
    private readonly gl: OGLRenderingContext;
    private isDown = false;
    private medias: GalleryMedia[] = [];
    private readonly renderer: Renderer;
    private requestId = 0;
    private readonly scene: Transform;
    private screen: ScreenSize = {
        height: window.innerHeight,
        width: window.innerWidth,
    };
    private readonly scroll: ScrollState = {
        current: 0,
        ease: 0.05,
        last: 0,
        target: 0,
    };
    private speed = autoScrollSpeed;
    private start = 0;
    private lastFrameTime = 0;
    private viewport: ViewportSize = {
        height: 0,
        width: 0,
    };

    constructor({ canvasContainer, gallery }: GalleryRuntimeOptions) {
        this.gallery = gallery;
        this.galleryBounds = gallery.getBoundingClientRect();
        this.renderer = new Renderer({
            alpha: true,
            antialias: true,
            dpr: Math.min(window.devicePixelRatio || 1, 2),
        });
        this.gl = this.renderer.gl;
        this.gl.canvas.setAttribute('aria-hidden', 'true');
        this.gl.canvas.classList.add('infinite-gallery__webgl-canvas');
        canvasContainer.appendChild(this.gl.canvas);

        this.camera = new Camera(this.gl);
        this.camera.fov = 45;
        this.camera.position.z = 5;
        this.scene = new Transform();
        this.geometry = new Plane(this.gl, {
            heightSegments: 10,
            widthSegments: 10,
        });

        this.onResize();
        this.createMedias();
        this.addEventListeners();
        this.update();
    }

    destroy() {
        window.cancelAnimationFrame(this.requestId);
        this.removeEventListeners();
        this.medias.forEach((media) => media.destroy());
        this.geometry.remove();
        this.gl.canvas.remove();
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }

    private addEventListeners() {
        window.addEventListener('resize', this.boundOnResize);
        window.addEventListener('wheel', this.boundOnWheel, { passive: true });
        window.addEventListener('mousedown', this.boundOnMouseDown);
        window.addEventListener('mousemove', this.boundOnMouseMove);
        window.addEventListener('mouseup', this.boundOnMouseUp);
        window.addEventListener('touchstart', this.boundOnTouchStart, {
            passive: true,
        });
        window.addEventListener('touchmove', this.boundOnTouchMove, {
            passive: true,
        });
        window.addEventListener('touchend', this.boundOnTouchEnd);
    }

    private createMedias() {
        const mediaElements = this.gallery.querySelectorAll<HTMLElement>(
            '.infinite-gallery__figure',
        );

        this.medias = Array.from(mediaElements).map(
            (element) =>
                new GalleryMedia({
                    element,
                    geometry: this.geometry,
                    gl: this.gl,
                    height: this.galleryHeight,
                    scene: this.scene,
                    screen: this.screen,
                    viewport: this.viewport,
                }),
        );
    }

    private onResize() {
        this.screen = {
            height: window.innerHeight,
            width: window.innerWidth,
        };

        this.renderer.setSize(this.screen.width, this.screen.height);
        this.camera.perspective({
            aspect: this.gl.canvas.width / this.gl.canvas.height,
        });

        const fov = this.camera.fov * (Math.PI / 180);
        const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
        const width = height * this.camera.aspect;

        this.viewport = {
            height,
            width,
        };

        this.galleryBounds = this.gallery.getBoundingClientRect();
        this.galleryHeight =
            (this.viewport.height * this.galleryBounds.height) /
            this.screen.height;

        this.medias.forEach((media) =>
            media.onResize({
                height: this.galleryHeight,
                screen: this.screen,
                viewport: this.viewport,
            }),
        );
    }

    private onTouchDown(event: MouseEvent | TouchEvent) {
        this.isDown = true;
        this.scroll.position = this.scroll.current;
        this.start =
            'touches' in event ? event.touches[0].clientY : event.clientY;
    }

    private onTouchMove(event: MouseEvent | TouchEvent) {
        if (!this.isDown) {
            return;
        }

        const y = 'touches' in event ? event.touches[0].clientY : event.clientY;
        const distance = (this.start - y) * 2;

        this.scroll.target = (this.scroll.position ?? 0) + distance;
    }

    private onTouchUp() {
        this.isDown = false;
    }

    private onWheel(event: WheelEvent) {
        this.scroll.target += getWheelDelta(event) * 0.5;
    }

    private removeEventListeners() {
        window.removeEventListener('resize', this.boundOnResize);
        window.removeEventListener('wheel', this.boundOnWheel);
        window.removeEventListener('mousedown', this.boundOnMouseDown);
        window.removeEventListener('mousemove', this.boundOnMouseMove);
        window.removeEventListener('mouseup', this.boundOnMouseUp);
        window.removeEventListener('touchstart', this.boundOnTouchStart);
        window.removeEventListener('touchmove', this.boundOnTouchMove);
        window.removeEventListener('touchend', this.boundOnTouchEnd);
    }

    private update = (time = performance.now()) => {
        const frameDelta =
            this.lastFrameTime > 0
                ? clamp(
                      (time - this.lastFrameTime) / targetFrameDuration,
                      0.25,
                      2,
                  )
                : 1;

        this.lastFrameTime = time;
        this.scroll.target += this.speed * frameDelta;
        this.scroll.current = lerp(
            this.scroll.current,
            this.scroll.target,
            this.scroll.ease,
        );

        if (this.scroll.current > this.scroll.last) {
            this.direction = 'down';
            this.speed = autoScrollSpeed;
        } else if (this.scroll.current < this.scroll.last) {
            this.direction = 'up';
            this.speed = -autoScrollSpeed;
        }

        this.medias.forEach((media) =>
            media.update(this.scroll, this.direction),
        );

        this.renderer.render({
            camera: this.camera,
            scene: this.scene,
        });

        this.scroll.last = this.scroll.current;
        this.requestId = window.requestAnimationFrame(this.update);
    };
}

const preloadImage = (src: string) =>
    new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = src;
    });

export default function InfiniteWebGLGallery({
    images,
    subtitle,
    title,
}: InfiniteWebGLGalleryProps) {
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const galleryRef = useRef<HTMLDivElement>(null);
    const imageSetKey = useMemo(() => images.join('\n'), [images]);
    const [loadedImageSetKey, setLoadedImageSetKey] = useState('');
    const [failedWebglImageSetKey, setFailedWebglImageSetKey] = useState('');
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const imagesLoaded =
        images.length === 0 || loadedImageSetKey === imageSetKey;
    const webglFallback = failedWebglImageSetKey === imageSetKey;
    const isLandingReady =
        imagesLoaded || prefersReducedMotion || webglFallback;
    const renderedImages = useMemo(() => fillLayoutCycle(images), [images]);

    const figureStyles = useMemo(
        () => renderedImages.map((_, index) => createFigureStyle(index)),
        [renderedImages],
    );
    const trackStyle = useMemo(
        () => getTrackStyle(renderedImages.length),
        [renderedImages.length],
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        );
        const syncPreference = () =>
            setPrefersReducedMotion(mediaQuery.matches);

        syncPreference();
        mediaQuery.addEventListener('change', syncPreference);

        return () => mediaQuery.removeEventListener('change', syncPreference);
    }, []);

    useEffect(() => {
        let cancelled = false;

        if (images.length === 0) {
            return;
        }

        void Promise.all(images.map((image) => preloadImage(image))).then(
            () => {
                if (!cancelled) {
                    setLoadedImageSetKey(imageSetKey);
                }
            },
        );

        return () => {
            cancelled = true;
        };
    }, [imageSetKey, images]);

    useEffect(() => {
        if (
            prefersReducedMotion ||
            images.length === 0 ||
            !canvasContainerRef.current ||
            !galleryRef.current
        ) {
            return;
        }

        try {
            const runtime = new GalleryRuntime({
                canvasContainer: canvasContainerRef.current,
                gallery: galleryRef.current,
            });

            return () => runtime.destroy();
        } catch (error) {
            console.error('Unable to initialize WebGL gallery.', error);
            const fallbackTimer = window.setTimeout(() => {
                setFailedWebglImageSetKey(imageSetKey);
            }, 0);

            return () => window.clearTimeout(fallbackTimer);
        }
    }, [imageSetKey, images, prefersReducedMotion]);

    const className = [
        'infinite-gallery',
        isLandingReady ? '' : 'is-loading',
        imagesLoaded ? 'is-loaded' : '',
        prefersReducedMotion ? 'is-reduced-motion' : '',
        webglFallback ? 'is-webgl-fallback' : '',
        images.length === 0 ? 'is-empty' : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <main className={className}>
            <div
                className="infinite-gallery__canvas"
                ref={canvasContainerRef}
            />

            <section
                className="infinite-gallery__stage"
                aria-label={subtitle ? `${title} ${subtitle}` : title}
            >
                <div className="fixed h-screen w-screen bg-black opacity-85"></div>
                <div className="infinite-gallery__header fixed flex h-screen w-screen flex-col items-center justify-center">
                    <div
                        className="infinite-gallery__enter-link-wrap"
                        // href={route('gallery.index')}
                    >
                        <img
                            className="mx-auto mb-3 max-w-[100px]"
                            src="/images/sigma-labz-logo.png"
                            alt=""
                        />
                        <img
                            className="mx-auto w-[800px] max-w-full"
                            src="/images/sigma-vault-logo.png"
                            alt=""
                        />
                        {/*<span className="infinite-gallery__enter-link uppercase">*/}
                        {/*    Enter Here*/}
                        {/*</span>*/}
                    </div>
                </div>

                <div
                    className="infinite-gallery__track"
                    ref={galleryRef}
                    style={trackStyle}
                >
                    {renderedImages.map((image, index) => (
                        <figure
                            className="infinite-gallery__figure"
                            key={`${image}-${index}`}
                            style={figureStyles[index]}
                        >
                            <img
                                alt=""
                                className="infinite-gallery__image"
                                draggable={false}
                                src={image}
                            />
                        </figure>
                    ))}
                </div>
            </section>

            <section
                className="infinite-gallery__fallback"
                aria-label="Gallery images"
            >
                {images.length > 0 ? (
                    images.map((image) => (
                        <img
                            alt=""
                            className="infinite-gallery__fallback-image"
                            draggable={false}
                            key={image}
                            src={image}
                        />
                    ))
                ) : (
                    <p className="infinite-gallery__fallback-message">
                        Add images to /public/images/tmp to populate this
                        gallery.
                    </p>
                )}
            </section>

            <div
                aria-hidden={isLandingReady}
                aria-live={isLandingReady ? 'off' : 'polite'}
                className="infinite-gallery__loading"
                role="status"
            >
                <LoadingVideo className="infinite-gallery__loading-icon" />
                {!isLandingReady ? (
                    <span className="sr-only">Loading landing gallery</span>
                ) : null}
            </div>
        </main>
    );
}
