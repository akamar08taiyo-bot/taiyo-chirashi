export function buildPngPrintDocument(imageUrl, orientation, title = 'チラシ') {
    const landscape = orientation === 'landscape';
    const width = landscape ? '297mm' : '210mm';
    const height = landscape ? '210mm' : '297mm';
    const safeTitle = escapePrintHtml(title);
    const safeUrl = escapePrintAttr(imageUrl);
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${safeTitle}</title><style>@page{size:A4 ${orientation};margin:0}html,body{margin:0!important;padding:0!important;width:${width};height:${height};background:#fff;overflow:hidden}body{display:flex;align-items:center;justify-content:center}.print-image{display:block;width:${width};height:${height};max-width:none;max-height:none;object-fit:contain;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body><img class="print-image" src="${safeUrl}" alt=""></body></html>`;
}
function escapePrintHtml(value) { return value.replace(/[&<>]/g, (ch) => ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'); }
function escapePrintAttr(value) { return escapePrintHtml(value).replace(/"/g, '&quot;'); }
//# sourceMappingURL=pngPrint.js.map