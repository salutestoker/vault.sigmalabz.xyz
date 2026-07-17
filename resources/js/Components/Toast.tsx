import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DEFAULT_TOAST_DURATION = 2400;
const TOAST_EXIT_DURATION = 240;

export interface ToastNotification {
    id: number;
    isLeaving: boolean;
    message: string;
}

interface ToastProps {
    toast: ToastNotification | null;
}

export const useToast = (duration = DEFAULT_TOAST_DURATION) => {
    const [toast, setToast] = useState<ToastNotification | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const exitTimeoutRef = useRef<number | null>(null);
    const nextToastIdRef = useRef(0);

    const clearToastTimers = useCallback(() => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (exitTimeoutRef.current) {
            window.clearTimeout(exitTimeoutRef.current);
            exitTimeoutRef.current = null;
        }
    }, []);

    const dismissToast = useCallback(() => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (exitTimeoutRef.current) {
            window.clearTimeout(exitTimeoutRef.current);
            exitTimeoutRef.current = null;
        }

        setToast((current) =>
            current ? { ...current, isLeaving: true } : current,
        );

        exitTimeoutRef.current = window.setTimeout(() => {
            setToast(null);
            exitTimeoutRef.current = null;
        }, TOAST_EXIT_DURATION);
    }, []);

    const showToast = useCallback(
        (message: string) => {
            clearToastTimers();
            nextToastIdRef.current += 1;
            setToast({
                id: nextToastIdRef.current,
                isLeaving: false,
                message,
            });

            timeoutRef.current = window.setTimeout(() => {
                dismissToast();
            }, duration);
        },
        [clearToastTimers, dismissToast, duration],
    );

    useEffect(() => clearToastTimers, [clearToastTimers]);

    return {
        dismissToast,
        showToast,
        toast,
    };
};

export default function Toast({ toast }: ToastProps) {
    const portalElement =
        typeof document === 'undefined' ? null : document.body;

    if (!toast || !portalElement) {
        return null;
    }

    const toastClassName = toast.isLeaving ? 'toast toast--leaving' : 'toast';

    return createPortal(
        <div
            key={toast.id}
            className={toastClassName}
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            {toast.message}
        </div>,
        portalElement,
    );
}
