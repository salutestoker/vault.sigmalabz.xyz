import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DEFAULT_TOAST_DURATION = 2400;

export interface ToastNotification {
    id: number;
    message: string;
}

interface ToastProps {
    toast: ToastNotification | null;
}

export const useToast = (duration = DEFAULT_TOAST_DURATION) => {
    const [toast, setToast] = useState<ToastNotification | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const nextToastIdRef = useRef(0);

    const clearToastTimers = useCallback(() => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const dismissToast = useCallback(() => {
        clearToastTimers();
        setToast(null);
    }, [clearToastTimers]);

    const showToast = useCallback(
        (message: string) => {
            clearToastTimers();
            nextToastIdRef.current += 1;
            setToast({
                id: nextToastIdRef.current,
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

    if (!portalElement) {
        return null;
    }

    return createPortal(
        toast ? (
            <div
                key={toast.id}
                className="toast"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {toast.message}
            </div>
        ) : null,
        portalElement,
    );
}
