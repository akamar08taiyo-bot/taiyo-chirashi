/**
 * Calculates image geometry for the fixed flyer photo frame.
 * `contain` keeps the whole portrait/landscape image visible at 100%.
 * `cover` fills the frame and crops only the overflowing side.
 */
export function calculateImagePlacement(imageWidth, imageHeight, boxWidth, boxHeight, transform) {
    const iw = Math.max(1, imageWidth);
    const ih = Math.max(1, imageHeight);
    const bw = Math.max(1, boxWidth);
    const bh = Math.max(1, boxHeight);
    const fitMode = transform.fitMode ?? 'cover';
    const fitBase = fitMode === 'contain' ? Math.min(bw / iw, bh / ih) : Math.max(bw / iw, bh / ih);
    const scale = fitBase * (Math.max(1, transform.scale) / 100);
    const width = iw * scale;
    const height = ih * scale;
    const overflowX = Math.max(0, width - bw), overflowY = Math.max(0, height - bh);
    const slackX = Math.max(0, bw - width), slackY = Math.max(0, bh - height);
    const x = Math.max(0, Math.min(100, transform.x));
    const y = Math.max(0, Math.min(100, transform.y));
    const offsetX = (x - 50) / 50 * (overflowX > 0 ? overflowX / 2 : -slackX / 2);
    const offsetY = (y - 50) / 50 * (overflowY > 0 ? overflowY / 2 : -slackY / 2);
    return { width, height, offsetX, offsetY, fitMode };
}
//# sourceMappingURL=photoFit.js.map