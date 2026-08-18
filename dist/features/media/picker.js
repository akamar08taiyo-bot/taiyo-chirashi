import { icon } from '../../components/icons.js';
import { escapeAttr, escapeHtml } from '../../utils/html.js';
import { listMedia, uploadMedia } from '../../services/mediaService.js';
import { showToast } from '../../components/toast.js';
export async function openMediaPicker(session, defaultKind = 'case') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<section class="modal media-picker wide" role="dialog" aria-modal="true"><header><h2>写真ライブラリ</h2><button class="icon-btn close">${icon('close')}</button></header><div class="media-picker-tools"><div class="search-input">${icon('search', 16)}<input id="media-search" placeholder="商品名・カテゴリーで検索"></div><select id="media-kind"><option value="all">すべて</option><option value="product">商品写真</option><option value="case" selected>事例写真</option></select><label class="btn secondary upload-inline">${icon('upload', 16)}写真を追加<input id="picker-upload" type="file" accept="image/jpeg,image/png,image/webp" hidden></label></div><div class="media-grid picker-grid" id="picker-grid"><div class="loading">写真を読み込んでいます…</div></div><footer><button class="btn secondary close">キャンセル</button></footer></section>`;
    document.body.append(overlay);
    const grid = overlay.querySelector('#picker-grid');
    const search = overlay.querySelector('#media-search');
    const kind = overlay.querySelector('#media-kind');
    const upload = overlay.querySelector('#picker-upload');
    if (kind)
        kind.value = defaultKind;
    let records = [];
    const refresh = async () => { if (!grid)
        return; grid.innerHTML = '<div class="loading">写真を読み込んでいます…</div>'; try {
        records = await listMedia(session, search?.value ?? '', (kind?.value ?? 'all'));
        grid.innerHTML = records.length ? records.map(mediaCard).join('') : '<div class="empty-panel">該当する写真がありません。</div>';
    }
    catch (error) {
        grid.innerHTML = `<div class="empty-panel error">${escapeHtml(error instanceof Error ? error.message : '写真を読み込めませんでした。')}</div>`;
    } };
    await refresh();
    return await new Promise((resolve) => { let settled = false; const close = (result) => { if (settled)
        return; settled = true; overlay.remove(); resolve(result); }; overlay.querySelectorAll('.close').forEach((el) => el.addEventListener('click', () => close(null))); overlay.addEventListener('click', (e) => { if (e.target === overlay)
        close(null); }); grid?.addEventListener('click', (e) => { const button = e.target.closest('[data-media-id]'); if (!button)
        return; const item = records.find((r) => r.id === button.dataset.mediaId); if (item)
        close(item); }); let searchTimer = 0; search?.addEventListener('input', () => { window.clearTimeout(searchTimer); searchTimer = window.setTimeout(() => void refresh(), 250); }); kind?.addEventListener('change', () => void refresh()); upload?.addEventListener('change', async () => { const file = upload.files?.[0]; if (!file)
        return; try {
        showToast('写真をアップロードしています…');
        await uploadMedia(session, file, { kind: (kind?.value === 'product' ? 'product' : 'case'), shareScope: 'private', category: kind?.value === 'product' ? '商品写真' : '事例写真' });
        showToast('写真を追加しました', 'success');
        upload.value = '';
        await refresh();
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : '写真をアップロードできませんでした。', 'error');
    } }); });
}
function mediaCard(item) { return `<button class="media-card" data-media-id="${escapeAttr(item.id)}"><div class="media-thumb"><img src="${escapeAttr(item.previewUrl)}" alt=""></div><strong>${escapeHtml(item.productName || item.category || item.fileName)}</strong><span>${item.kind === 'product' ? '商品写真' : '事例写真'}・${scopeLabel(item.shareScope)}</span></button>`; }
function scopeLabel(s) { return s === 'private' ? '自分だけ' : s === 'office' ? '営業所' : '会社共有'; }
//# sourceMappingURL=picker.js.map