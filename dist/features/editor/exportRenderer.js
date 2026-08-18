import { calculateBurdenAmounts, formatYen } from '../../utils/pricing.js';
import { getOriginalBlobForRef } from '../../services/mediaService.js';
import { calculateImagePlacement } from '../../utils/photoFit.js';
import { loadImage } from '../../utils/images.js';
import { AppError } from '../../utils/errors.js';
import { buildPngPrintDocument } from '../../utils/pngPrint.js';
import { getConsumablePresentation } from './consumablePresentation.js';
const PORTRAIT = { w: 2480, h: 3508 };
const LANDSCAPE = { w: 3508, h: 2480 };
export async function renderFlyerCanvas(record, context) {
    const size = record.orientation === 'landscape' ? LANDSCAPE : PORTRAIT;
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new AppError('画像出力を準備できませんでした。');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size.w, size.h);
    const scale = size.w / (record.orientation === 'landscape' ? 1123 : 794);
    const px = (n) => n * scale;
    const state = record.editorState;
    const accent = state.design.color;
    const margin = px(28);
    const pageW = size.w;
    const office = context.offices.find((o) => o.id === record.officeId) ?? context.offices[0];
    const assignee = context.profiles.find((p) => p.id === record.assigneeId);
    const contactName = state.contact?.personName || assignee?.flyerContactName || assignee?.displayName || '';
    const mobilePhone = state.contact?.mobilePhone || assignee?.mobilePhone || assignee?.phone || '';
    const headerH = px(record.orientation === 'landscape' ? 92 : 100);
    const footerH = px(80);
    const gap = px(10);
    const contentTop = margin + headerH;
    const contentBottom = size.h - margin - footerH - gap;
    const contentH = contentBottom - contentTop;
    const contentW = pageW - margin * 2;
    ctx.textBaseline = 'top';
    ctx.fillStyle = accent;
    ctx.fillRect(margin, margin + px(4), px(56), px(23));
    drawText(ctx, state.eyebrow, margin + px(8), margin + px(8), px(10), 'bold', '#fff');
    drawText(ctx, state.eyebrowNote, margin + px(66), margin + px(9), px(9), 'normal', '#43372f');
    drawText(ctx, state.title, margin, margin + px(35), px(record.orientation === 'landscape' ? 31 : 30), '700', '#2f2017', 'serif');
    drawText(ctx, state.subtitle, margin, margin + px(72), px(9.5), 'normal', '#44372e', 'serif', 'left', contentW * 0.68);
    const companyX = pageW - margin;
    if (state.display.showLogo !== false && context.organization.logoUrl) {
        try {
            const logo = await loadImage(context.organization.logoUrl);
            const lh = px(46), lw = Math.min(px(120), lh * (logo.naturalWidth / logo.naturalHeight));
            ctx.drawImage(logo, companyX - lw, margin + px(6), lw, lh);
        }
        catch { /* optional logo */ }
    }
    ctx.fillStyle = accent;
    ctx.fillRect(margin, contentTop - px(7), contentW, px(3));
    const spec = gridSpec(state.layoutCount);
    const cardGap = px(10);
    const cardW = (contentW - cardGap * (spec.cols - 1)) / spec.cols;
    const cardH = (contentH - cardGap * (spec.rows - 1)) / spec.rows;
    for (let i = 0; i < state.layoutCount; i++) {
        const item = state.items[i];
        if (!item)
            continue;
        const col = i % spec.cols, row = Math.floor(i / spec.cols);
        await drawCard(ctx, item, margin + col * (cardW + cardGap), contentTop + row * (cardH + cardGap), cardW, cardH, state, accent);
    }
    const fy = size.h - margin - footerH;
    ctx.fillStyle = accent;
    ctx.fillRect(margin, fy, contentW, footerH);
    drawText(ctx, state.footerHeadline, margin + px(12), fy + px(10), px(11), '700', '#fff', undefined, undefined, contentW * 0.6);
    drawText(ctx, state.footerNote, margin + px(12), fy + px(31), px(7.3), 'normal', '#fff', undefined, undefined, contentW * 0.62);
    const cx = pageW - margin - px(12);
    const cw = px(330);
    drawText(ctx, `${context.organization.name}　${office?.name ?? ''}`, cx, fy + px(9), px(13), '700', '#fff', undefined, 'right', cw);
    if (office?.address)
        drawText(ctx, office.address, cx, fy + px(28), px(8.6), 'normal', '#fff', undefined, 'right', cw);
    drawText(ctx, `TEL:${office?.phone ?? ''}　FAX:${office?.fax ?? ''}`, cx, fy + px(43), px(12), '700', '#fff', undefined, 'right', cw);
    if (contactName || mobilePhone)
        drawText(ctx, `担当：${contactName}${mobilePhone ? `　${mobilePhone}` : ''}`, cx, fy + px(62), px(8.6), 'normal', '#fff', undefined, 'right', cw);
    return canvas;
}
export async function findUnavailableExportImages(record) {
    const failed = [];
    for (let i = 0; i < record.editorState.layoutCount; i++) {
        const media = record.editorState.items[i]?.media;
        if (!media)
            continue;
        try {
            const local = await getOriginalBlobForRef(media);
            const source = local ?? media.originalUrl ?? media.previewUrl;
            if (!source)
                throw new Error('missing source');
            await loadImage(source);
        }
        catch {
            failed.push(i);
        }
    }
    return failed;
}
export async function exportPng(record, context) { const canvas = await renderFlyerCanvas(record, context); const blob = await canvasBlob(canvas, 'image/png'); download(blob, `${safeName(record.title)}.png`); }
export async function printPng(record, context) {
    const canvas = await renderFlyerCanvas(record, context);
    const blob = await canvasBlob(canvas, 'image/png');
    await printPngBlob(blob, record.orientation, record.title);
}
export async function exportJpeg(record, context) { const canvas = await renderFlyerCanvas(record, context); const blob = await canvasBlob(canvas, 'image/jpeg', 0.94); download(blob, `${safeName(record.title)}.jpg`); }
export async function exportPdf(record, context) { const canvas = await renderFlyerCanvas(record, context); const jpeg = await canvasBlob(canvas, 'image/jpeg', 0.95); const bytes = new Uint8Array(await jpeg.arrayBuffer()); const pdf = buildSingleImagePdf(bytes, canvas.width, canvas.height, record.orientation); download(new Blob([pdf], { type: 'application/pdf' }), `${safeName(record.title)}.pdf`); }
async function drawCard(ctx, item, x, y, w, h, state, accent) {
    if (state.mode === 'consumables')
        return drawConsumableCard(ctx, item, x, y, w, h, state, accent);
    return drawWelfareCard(ctx, item, x, y, w, h, state, accent);
}
async function drawCardPhoto(ctx, item, x, y, w, h, state, accent) {
    const border = Math.max(2, w / 500);
    ctx.strokeStyle = lighten(accent, 0.62);
    ctx.lineWidth = border;
    ctx.strokeRect(x, y, w, h);
    const photoRatio = state.layoutCount <= 2 ? 0.62 : state.layoutCount <= 4 ? 0.53 : 0.43;
    const photoH = h * photoRatio;
    ctx.fillStyle = '#eeeae6';
    ctx.fillRect(x + border, y + border, w - border * 2, photoH - border);
    if (item.media) {
        try {
            const local = await getOriginalBlobForRef(item.media);
            const source = local ?? item.media.originalUrl ?? item.media.previewUrl;
            if (source) {
                const img = await loadImage(source);
                drawFittedImage(ctx, img, x + border, y + border, w - border * 2, photoH - border, item.transform);
            }
        }
        catch { /* export validation will flag failed visual if needed */ }
    }
    return { border, photoH, pad: Math.max(16, w * 0.035) };
}
async function drawWelfareCard(ctx, item, x, y, w, h, state, accent) {
    const { photoH, pad, border } = await drawCardPhoto(ctx, item, x, y, w, h, state, accent);
    let ty = y + photoH + pad;
    if (item.equipmentCategory) {
        const bs = clamp(w * 0.032, 16, 24);
        ctx.font = `700 ${bs}px sans-serif`;
        const bw = ctx.measureText(item.equipmentCategory).width + bs * 1.1;
        const bh = bs * 1.75;
        ctx.fillStyle = accent;
        roundRect(ctx, x + pad, ty, bw, bh, bh / 2);
        ctx.fill();
        drawText(ctx, item.equipmentCategory, x + pad + bs * 0.55, ty + bh / 2 + bs * 0.36, bs, '700', '#ffffff');
        ty += bh + pad * 0.35;
    }
    if (item.productName) {
        const ps = clamp(w * 0.062, 28, 48);
        const lines = wrapLines(ctx, item.productName, w - pad * 2, ps, '800', 'sans-serif', 2);
        for (const line of lines) {
            drawText(ctx, line, x + pad, ty, ps, '800', '#2b1f16');
            ty += ps * 1.2;
        }
        ty += ps * .15;
    }
    const titleSize = clamp(w * 0.040, 19, 30);
    drawText(ctx, item.title, x + pad, ty, titleSize, '700', '#5b4a3d', undefined, undefined, w - pad * 2);
    ty += titleSize * 1.3;
    const descSize = clamp(w * 0.034, 17, 26);
    const descLines = wrapLines(ctx, item.description, w - pad * 2, descSize, 'normal', 'sans-serif', state.layoutCount <= 4 ? 4 : 3);
    for (const line of descLines) {
        drawText(ctx, line, x + pad, ty, descSize, 'normal', '#4a413a');
        ty += descSize * 1.35;
    }
    const metaParts = [item.maker, item.taisCode ? `TAIS ${item.taisCode}` : '', item.productCode ? `品番 ${item.productCode}` : ''].filter(Boolean);
    if (metaParts.length) {
        const ms = clamp(w * .026, 14, 20);
        ty += ms * .35;
        drawText(ctx, metaParts.join('　'), x + pad, ty, ms, 'normal', '#7a6f66', undefined, undefined, w - pad * 2);
        ty += ms * 1.2;
    }
    if (item.assistBarFree) {
        const label = item.assistBarLabel || '介助バー無料';
        const fs2 = clamp(w * .03, 15, 23);
        ctx.font = `700 ${Math.round(fs2)}px sans-serif`;
        const tw = ctx.measureText(label).width + fs2 * .9;
        const th = fs2 * 1.6;
        ctx.fillStyle = '#e8f3ec';
        roundRect(ctx, x + pad, ty, tw, th, 4);
        ctx.fill();
        ctx.strokeStyle = '#2c7b4f';
        ctx.lineWidth = 1;
        roundRect(ctx, x + pad, ty, tw, th, 4);
        ctx.stroke();
        drawText(ctx, label, x + pad + fs2 * .45, ty + th / 2 + fs2 * .36, fs2, '700', '#1f5c3a');
        ty += th + fs2 * .3;
    }
    // 料金帯：参考チラシに合わせ、色を敷いて金額を大きく見せる。
    const bottom = y + h - pad;
    const burdens = calculateBurdenAmounts(item.monthlyAmount);
    const enabled = [state.display.showBurden1 ? `1割 ${formatYen(burdens.burden1)}` : '', state.display.showBurden2 ? `2割 ${formatYen(burdens.burden2)}` : '', state.display.showBurden3 ? `3割 ${formatYen(burdens.burden3)}` : ''].filter(Boolean);
    const burdenSize = clamp(w * .040, 20, 30);
    const unitSize = clamp(w * .052, 24, 38);
    const bandH = (state.display.showUnits ? unitSize * 1.5 : 0) + (enabled.length ? burdenSize * 1.6 : 0) + pad * .5;
    if (bandH > pad) {
        ctx.fillStyle = lighten(accent, .90);
        ctx.fillRect(x + border, bottom + pad - bandH, w - border * 2, bandH - border);
    }
    let burdenY = bottom - burdenSize * 1.2;
    if (enabled.length) {
        drawText(ctx, enabled.join('　'), x + pad, burdenY, burdenSize, '700', accent, undefined, undefined, w - pad * 2);
        burdenY -= unitSize * 1.35;
    }
    if (state.display.showUnits) {
        drawText(ctx, '単位数', x + pad, burdenY + unitSize * .34, clamp(w * .026, 14, 20), 'normal', '#4c4037');
        drawText(ctx, `${Math.max(0, item.units).toLocaleString('ja-JP')} 単位／月`, x + pad, burdenY, unitSize, '800', '#34251b', undefined, 'right', w - pad * 2);
    }
}
async function drawConsumableCard(ctx, item, x, y, w, h, state, accent) {
    const { photoH, pad } = await drawCardPhoto(ctx, item, x, y, w, h, state, accent);
    const maxWidth = w - pad * 2;
    const presentation = getConsumablePresentation(item, state.layoutCount, state.display.showPrices !== false);
    let ty = y + photoH + pad;
    if (presentation.categoryLabel) {
        const categorySize = clamp(w * .026, 17, 27);
        drawFittedSingleLine(ctx, presentation.categoryLabel, x + pad, ty, maxWidth, categorySize, clamp(categorySize * .76, 13, 19), '800', accent);
        ty += categorySize * 1.24;
    }
    const classScale = presentation.productLayout.className === 'very-long' ? .72 : presentation.productLayout.className === 'long' ? .86 : 1;
    const preferredProductSize = clamp(w * .045, 29, 60) * classScale;
    const minimumProductSize = clamp(preferredProductSize * .72, 20, 36);
    for (const line of presentation.productLayout.lines.slice(0, 2)) {
        const fitted = fitTextSize(ctx, line, maxWidth, preferredProductSize, minimumProductSize, '900', 'sans-serif');
        drawText(ctx, line, x + pad, ty, fitted, '900', '#2e251f');
        ty += fitted * 1.18;
    }
    const metaSize = clamp(w * .022, 15, 22);
    if (item.productCode) {
        drawFittedSingleLine(ctx, `品番：${item.productCode}`, x + pad, ty, maxWidth, metaSize, 13, 'normal', '#82786f');
        ty += metaSize * 1.18;
    }
    if (presentation.specificationLabel) {
        drawFittedSingleLine(ctx, presentation.specificationLabel, x + pad, ty, maxWidth, clamp(w * .024, 16, 23), 14, '700', '#5e544c');
        ty += clamp(w * .024, 16, 23) * 1.23;
    }
    if (item.title) {
        const catchSize = clamp(w * .025, 17, 24);
        drawFittedSingleLine(ctx, item.title, x + pad, ty, maxWidth, catchSize, 14, '700', '#6b5e54');
        ty += catchSize * 1.22;
    }
    const priceSize = clamp(w * .06, 39, 76);
    const priceReserve = presentation.showPrice ? priceSize * 1.35 + pad * .45 : 0;
    const descSize = clamp(w * .029, 16, 27);
    const maxDescLines = state.layoutCount <= 2 ? 6 : state.layoutCount <= 4 ? 4 : state.layoutCount === 6 ? 3 : 2;
    const availableBottom = y + h - pad - priceReserve;
    const possibleLines = Math.max(0, Math.floor((availableBottom - ty) / (descSize * 1.32)));
    const descLines = wrapLines(ctx, item.description, maxWidth, descSize, 'normal', 'sans-serif', Math.min(maxDescLines, possibleLines));
    for (const line of descLines) {
        drawText(ctx, line, x + pad, ty, descSize, 'normal', '#4a413a');
        ty += descSize * 1.32;
    }
    if (presentation.showPrice) {
        const lineY = y + h - pad - priceSize * 1.05;
        ctx.strokeStyle = lighten(accent, .82);
        ctx.lineWidth = Math.max(1, w / 900);
        ctx.beginPath();
        ctx.moveTo(x + pad, lineY - priceSize * .20);
        ctx.lineTo(x + w - pad, lineY - priceSize * .20);
        ctx.stroke();
        const numeric = presentation.priceLabel.replace(/円$/, '');
        const yenSize = clamp(priceSize * .46, 16, 29);
        const yenWidth = measureText(ctx, '円', yenSize, '800', 'sans-serif');
        const numberSize = fitTextSize(ctx, numeric, maxWidth - yenWidth - 8, priceSize, clamp(priceSize * .68, 28, 48), '900', 'sans-serif');
        const numberWidth = measureText(ctx, numeric, numberSize, '900', 'sans-serif');
        const right = x + w - pad;
        drawText(ctx, numeric, right - yenWidth - 8 - numberWidth, lineY, numberSize, '900', accent);
        drawText(ctx, '円', right - yenWidth, lineY + Math.max(0, numberSize - yenSize) * .72, yenSize, '800', accent);
    }
}
function setCanvasFont(ctx, size, weight, family = 'sans-serif') {
    // チラシは高齢の方も読むため、可読性の高いUDフォントを優先する。
    // family==='serif' は見出し用の指定。明朝から親しみやすいゴシックへ変更。
    ctx.font = `${weight} ${Math.round(size)}px ${family === 'serif' ? `"BIZ UDPGothic","Hiragino Maru Gothic ProN","Yu Gothic","Meiryo",sans-serif` : `"BIZ UDPGothic","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif`}`;
}
function measureText(ctx, text, size, weight, family = 'sans-serif') {
    setCanvasFont(ctx, size, weight, family);
    return ctx.measureText(text).width;
}
function fitTextSize(ctx, text, maxWidth, preferred, minimum, weight, family = 'sans-serif') {
    let size = preferred;
    while (size > minimum && measureText(ctx, text, size, weight, family) > maxWidth)
        size -= 1;
    return Math.max(minimum, size);
}
function drawFittedSingleLine(ctx, text, x, y, maxWidth, preferred, minimum, weight, color) {
    const size = fitTextSize(ctx, text, maxWidth, preferred, minimum, weight, 'sans-serif');
    let visible = text;
    setCanvasFont(ctx, size, weight, 'sans-serif');
    if (ctx.measureText(visible).width > maxWidth) {
        while (visible.length > 1 && ctx.measureText(`${visible}…`).width > maxWidth)
            visible = visible.slice(0, -1);
        if (visible !== text)
            visible = `${visible.trimEnd()}…`;
    }
    drawText(ctx, visible, x, y, size, weight, color);
}
function drawFittedImage(ctx, img, x, y, w, h, t) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(t.rotation * Math.PI / 180); const placement = calculateImagePlacement(img.naturalWidth, img.naturalHeight, w, h, t); ctx.drawImage(img, -placement.width / 2 - placement.offsetX, -placement.height / 2 - placement.offsetY, placement.width, placement.height); ctx.restore(); }
function drawText(ctx, text, x, y, size, weight, color, family = 'sans-serif', align = 'left', maxWidth) { setCanvasFont(ctx, size, weight, family); ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x + (align === 'right' && maxWidth ? maxWidth : 0), y, maxWidth); }
function wrapLines(ctx, text, maxWidth, size, weight, family, maxLines) { if (maxLines <= 0 || !text)
    return []; setCanvasFont(ctx, size, weight, family); const lines = []; let line = ''; for (const ch of text) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = ch;
        if (lines.length >= maxLines)
            break;
    }
    else
        line = next;
} if (lines.length < maxLines && line)
    lines.push(line); if (lines.length === maxLines && text.length > lines.join('').length) {
    let last = lines[maxLines - 1] ?? '';
    while (last && ctx.measureText(last + '…').width > maxWidth)
        last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
} return lines; }
function gridSpec(count) { if (count === 1)
    return { cols: 1, rows: 1 }; if (count === 2)
    return { cols: 2, rows: 1 }; if (count === 3)
    return { cols: 3, rows: 1 }; if (count === 4)
    return { cols: 2, rows: 2 }; if (count === 6)
    return { cols: 3, rows: 2 }; return { cols: 3, rows: 3 }; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function lighten(hex, amount) { const clean = hex.replace('#', ''); if (clean.length !== 6)
    return '#d9c3ad'; const parts = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)); return `rgb(${parts.map((p) => Math.round(p + (255 - p) * amount)).join(',')})`; }
function canvasBlob(canvas, type, quality) { return new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new AppError('画像データを作成できませんでした。もう一度お試しください。')), type, quality)); }
function safeName(name) { return (name.trim() || 'チラシ').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80); }
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
async function printPngBlob(blob, orientation, title) {
    const imageUrl = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    document.body.append(frame);
    const cleanup = () => { URL.revokeObjectURL(imageUrl); frame.remove(); };
    try {
        const doc = frame.contentDocument;
        if (!doc)
            throw new Error('印刷画面を準備できませんでした。');
        doc.open();
        doc.write(buildPngPrintDocument(imageUrl, orientation, title));
        doc.close();
        const image = doc.querySelector('.print-image');
        if (!image)
            throw new Error('PNG印刷用の画像を準備できませんでした。');
        await new Promise((resolve, reject) => { if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
        } image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => reject(new Error('PNG印刷用の画像を読み込めませんでした。')), { once: true }); });
        const win = frame.contentWindow;
        if (!win)
            throw new Error('印刷画面を開けませんでした。');
        let cleaned = false;
        const safeCleanup = () => { if (cleaned)
            return; cleaned = true; cleanup(); };
        win.addEventListener('afterprint', safeCleanup, { once: true });
        win.focus();
        win.print();
        window.setTimeout(safeCleanup, 30000);
    }
    catch (error) {
        cleanup();
        throw error;
    }
}
function buildSingleImagePdf(jpeg, pixelW, pixelH, orientation) {
    const pageW = orientation === 'landscape' ? 841.89 : 595.28, pageH = orientation === 'landscape' ? 595.28 : 841.89;
    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [0];
    let len = 0;
    const push = (data) => { const b = typeof data === 'string' ? enc.encode(data) : data; chunks.push(b); len += b.length; };
    push('%PDF-1.4\n%âãÏÓ\n');
    const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
    obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${pixelW} /Height ${pixelH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); push(jpeg); push('\nendstream'); });
    const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ`;
    obj(5, () => push(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}\nendstream`));
    const xref = len;
    push('xref\n0 6\n0000000000 65535 f \n');
    for (let i = 1; i <= 5; i++)
        push(`${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(len);
    let pos = 0;
    for (const c of chunks) {
        out.set(c, pos);
        pos += c.length;
    }
    return out;
}
function roundRect(ctx, x, y, w, h, r) { const rr = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath(); }
//# sourceMappingURL=exportRenderer.js.map