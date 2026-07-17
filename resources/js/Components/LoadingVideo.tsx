const LOADING_VIDEO_SRC = '/images/loader/loader-1.mp4';

interface LoadingVideoProps {
    className?: string;
    label?: string;
}

export default function LoadingVideo({
    className = '',
    label,
}: LoadingVideoProps) {
    const classNames = ['loading-video', className].filter(Boolean).join(' ');

    return (
        <>
            <video
                aria-hidden="true"
                autoPlay
                className={classNames}
                loop
                muted
                playsInline
                preload="auto"
            >
                <source src={LOADING_VIDEO_SRC} type="video/mp4" />
            </video>
            {label ? <span className="sr-only">{label}</span> : null}
        </>
    );
}
