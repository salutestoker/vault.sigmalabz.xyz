import { type GalleryMedia } from '@/types/gallery';

type ClipboardItemConstructor = {
    new (items: Record<string, Blob>): ClipboardItem;
    supports?: (type: string) => boolean;
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

const fetchMediaClipboardBlob = async (media: GalleryMedia): Promise<Blob> => {
    const response = await fetch(route('gallery.media.clipboard', media.id), {
        headers: {
            Accept: media.type === 'image' ? 'image/*' : 'video/*',
        },
    });

    if (!response.ok) {
        throw new Error('Unable to fetch media clipboard data.');
    }

    return await response.blob();
};

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

export const copyMediaToClipboard = async (media: GalleryMedia) => {
    const blob = await fetchMediaClipboardBlob(media);

    if (media.type === 'image') {
        await copyBlobToClipboard(await imageBlobToPng(blob), 'image/png');
        return;
    }

    const mimeType = blob.type || media.mime_type || 'video/mp4';

    await copyBlobToClipboard(blob, mimeType);
};
