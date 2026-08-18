import { AppError } from './errors.js';
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function validateImageFile(file) {
    if (file.size > MAX_IMAGE_BYTES)
        throw new AppError('写真の容量が大きすぎます。20MB以下の写真を選んでください。');
    if (!allowedTypes.has(file.type)) {
        if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name))
            throw new AppError('HEIC/HEIF形式はこのブラウザでは安定して編集できません。JPEG、PNG、WebP形式の写真を選んでください。');
        throw new AppError('対応していない写真形式です。JPEG、PNG、WebP形式の写真を選んでください。');
    }
}
export async function createPreviewBlob(file, maxDimension = 1600) {
    try {
        const bitmap = await decodeImage(file);
        const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * ratio));
        const height = Math.max(1, Math.round(bitmap.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx)
            throw new AppError('写真を処理できませんでした。別の写真をお試しください。');
        ctx.drawImage(bitmap.source, 0, 0, width, height);
        bitmap.cleanup();
        return await canvasToBlob(canvas, 'image/webp', 0.84).catch(() => canvasToBlob(canvas, 'image/jpeg', 0.86));
    }
    catch (error) {
        if (error instanceof AppError)
            throw error;
        throw new AppError('写真を読み込めませんでした。写真ファイルが壊れていないか確認し、別の写真をお試しください。', 0, error);
    }
}
export async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}
export async function loadImage(source) {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    try {
        const image = new Image();
        image.decoding = 'async';
        image.crossOrigin = source instanceof Blob ? '' : 'anonymous';
        await new Promise((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('image load failed')); image.src = url; });
        return image;
    }
    finally {
        if (source instanceof Blob)
            URL.revokeObjectURL(url);
    }
}
async function decodeImage(blob) {
    if ('createImageBitmap' in window) {
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        return { width: bitmap.width, height: bitmap.height, source: bitmap, cleanup: () => bitmap.close() };
    }
    const url = URL.createObjectURL(blob);
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('decode failed')); image.src = url; });
    return { width: image.naturalWidth, height: image.naturalHeight, source: image, cleanup: () => URL.revokeObjectURL(url) };
}
function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('encode failed')), type, quality));
}
//# sourceMappingURL=images.js.map