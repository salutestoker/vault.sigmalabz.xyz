import { type GalleryMedia } from '@/types/gallery';

export type GalleryClipboardResult = {
    kind: 'media' | 'link';
};

export type GalleryNativeShareResult = {
    kind: 'shared' | 'unsupported';
};

type ClipboardItemConstructor = {
    new (items: Record<string, Blob>): ClipboardItem;
    supports?: (type: string) => boolean;
};

type FileShareData = {
    files?: File[];
    text?: string;
    title?: string;
    url?: string;
};

type FileShareNavigator = Navigator & {
    canShare?: (data: FileShareData) => boolean;
    share?: (data: FileShareData) => Promise<void>;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
};

const canvasToPngBlob = async (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }

            reject(new Error('Unable to prepare image clipboard data.'));
        }, 'image/png');
    });

const imageBlobToPng = async (blob: Blob): Promise<Blob> => {
    const objectUrl = URL.createObjectURL(blob);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = () =>
                reject(new Error('Unable to load image clipboard data.'));
            element.src = objectUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('Unable to prepare image clipboard data.');
        }

        context.drawImage(image, 0, 0);

        return await canvasToPngBlob(canvas);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

const fetchMediaBlob = async (
    media: GalleryMedia,
    routeName: 'gallery.media.clipboard' | 'gallery.media.share',
): Promise<Blob> => {
    const response = await fetch(route(routeName, media.id), {
        headers: {
            Accept: media.type === 'image' ? 'image/*' : 'video/*',
        },
    });

    if (!response.ok) {
        throw new Error(
            routeName === 'gallery.media.clipboard'
                ? 'Unable to fetch media clipboard data.'
                : 'Unable to fetch media share data.',
        );
    }

    return await response.blob();
};

const fetchMediaClipboardBlob = async (media: GalleryMedia): Promise<Blob> =>
    fetchMediaBlob(media, 'gallery.media.clipboard');

const fetchMediaShareBlob = async (media: GalleryMedia): Promise<Blob> =>
    fetchMediaBlob(media, 'gallery.media.share');

const copyBlobToClipboard = async (blob: Blob, mimeType: string) => {
    const clipboard = window.navigator.clipboard;
    const ClipboardItemClass = window.ClipboardItem as
        | ClipboardItemConstructor
        | undefined;

    if (!clipboard?.write || !ClipboardItemClass) {
        throw new Error(
            'This browser does not support media clipboard writes.',
        );
    }

    if (ClipboardItemClass.supports && !ClipboardItemClass.supports(mimeType)) {
        throw new Error(`This browser cannot copy ${mimeType} media.`);
    }

    await clipboard.write([new ClipboardItemClass({ [mimeType]: blob })]);
};

const absoluteUrl = (url: string): string =>
    new URL(url, window.location.href).toString();

const copyTextToClipboard = async (text: string): Promise<void> => {
    if (!window.navigator.clipboard?.writeText) {
        throw new Error('This browser does not support clipboard text writes.');
    }

    await window.navigator.clipboard.writeText(text);
};

const mediaMimeType = (media: GalleryMedia, blob: Blob): string =>
    blob.type ||
    media.mime_type ||
    (media.type === 'image' ? 'image/png' : 'video/mp4');

const mediaFileName = (media: GalleryMedia, mimeType: string): string => {
    const extension =
        MIME_EXTENSION_MAP[mimeType.toLowerCase()] ??
        (media.type === 'image' ? 'png' : 'mp4');
    const baseName =
        media.title
            .trim()
            .replace(/[^A-Za-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || `sigma-vault-${media.id}`;

    return baseName.includes('.') ? baseName : `${baseName}.${extension}`;
};

export const canAttemptNativeFileShare = (): boolean => {
    const shareNavigator = window.navigator as FileShareNavigator;

    if (
        typeof File === 'undefined' ||
        !shareNavigator.share ||
        !shareNavigator.canShare
    ) {
        return false;
    }

    const testFile = new File([''], 'sigma-vault.png', {
        type: 'image/png',
    });

    return shareNavigator.canShare({ files: [testFile] });
};

export const shareMediaFile = async (
    media: GalleryMedia,
    text: string,
): Promise<GalleryNativeShareResult> => {
    const shareNavigator = window.navigator as FileShareNavigator;

    if (!shareNavigator.share || !shareNavigator.canShare) {
        return { kind: 'unsupported' };
    }

    const blob = await fetchMediaShareBlob(media);
    const mimeType = mediaMimeType(media, blob);
    const file = new File([blob], mediaFileName(media, mimeType), {
        type: mimeType,
    });

    if (!shareNavigator.canShare({ files: [file] })) {
        return { kind: 'unsupported' };
    }

    await shareNavigator.share({
        files: [file],
        text,
    });

    return { kind: 'shared' };
};

export const copyMediaToClipboard = async (
    media: GalleryMedia,
): Promise<GalleryClipboardResult> => {
    if (media.type === 'video') {
        if (!media.media_url) {
            throw new Error('Unable to find a video URL to copy.');
        }

        await copyTextToClipboard(absoluteUrl(media.media_url));

        return { kind: 'link' };
    }

    const blob = await fetchMediaClipboardBlob(media);

    await copyBlobToClipboard(await imageBlobToPng(blob), 'image/png');

    return { kind: 'media' };
};
