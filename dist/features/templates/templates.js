import { topbar } from '../../components/shell.js';
import { icon } from '../../components/icons.js';
import { listTemplates, setTemplateDeleted } from '../../services/templateService.js';
import { createFlyer } from '../../services/flyerService.js';
import { escapeAttr, escapeHtml } from '../../utils/html.js';
import { showToast } from '../../components/toast.js';
import { showModal } from '../../components/modal.js';
import { navigate } from '../../app/router.js';
export async function renderTemplates(root, session, context) {
    root.innerHTML = `${topbar(session)}<main class="standard-page"><header class="page-heading"><div><button class="page-back" data-nav="home">← ホームに戻る</button><h1>テンプレート</h1><p>よく使うレイアウトを選ぶと、すぐ編集を始められます。</p></div><button class="btn primary" data-nav="create">${icon('plus', 17)}新しく作成</button></header><div class="filter-bar"><div class="search-input">${icon('search', 16)}<input id="template-search" placeholder="テンプレート名で検索"></div><select id="template-scope"><option value="all">すべて</option><option value="private">自分だけ</option><option value="office">営業所</option><option value="company">全社</option></select></div><section id="template-grid" class="template-library-grid"><div class="loading">読み込んでいます…</div></section></main>`;
    let records = await listTemplates(session).catch(() => []);
    const grid = root.querySelector('#template-grid');
    const search = root.querySelector('#template-search');
    const scope = root.querySelector('#template-scope');
    const render = () => { if (!grid)
        return; const q = (search?.value ?? '').trim().toLowerCase(), s = scope?.value ?? 'all'; const filtered = records.filter(t => (s === 'all' || t.shareScope === s) && (!q || t.name.toLowerCase().includes(q))); grid.innerHTML = filtered.length ? filtered.map(t => templateCard(t, context, session)).join('') : '<div class="empty-panel">該当するテンプレートがありません。</div>'; };
    search?.addEventListener('input', render);
    scope?.addEventListener('change', render);
    grid?.addEventListener('click', async (e) => { const btn = e.target.closest('[data-action]'); if (!btn)
        return; const tpl = records.find(t => t.id === btn.dataset.id); if (!tpl)
        return; if (btn.dataset.action === 'use') {
        try {
            const flyer = await createFlyer(session, context, { mode: tpl.editorState.mode ?? 'cases', categoryId: tpl.categoryId, officeId: session.profile.officeId, layoutCount: tpl.editorState.layoutCount, templateId: tpl.id, orientation: tpl.editorState.orientation });
            navigate(`editor/${flyer.id}`);
        }
        catch (error) {
            showToast(error instanceof Error ? error.message : '作成できませんでした。', 'error');
        }
    }
    else if (btn.dataset.action === 'delete') {
        const answer = await showModal({ title: 'テンプレートを削除しますか？', bodyHtml: `<p>「${escapeHtml(tpl.name)}」を削除します。</p>`, actions: [{ label: 'キャンセル', value: 'cancel', kind: 'secondary' }, { label: '削除', value: 'delete', kind: 'danger' }] });
        if (answer === 'delete') {
            await setTemplateDeleted(session, tpl.id, true);
            records = records.filter(t => t.id !== tpl.id);
            render();
            showToast('テンプレートを削除しました', 'success');
        }
    } });
    render();
}
function templateCard(t, context, session) { const category = context.categories.find(c => c.id === t.categoryId)?.name ?? '未分類'; const canDelete = t.ownerId === session.profile.id || session.profile.role === 'org_admin' || (session.profile.role === 'office_admin' && t.officeId === session.profile.officeId); return `<article class="template-library-card"><div class="template-large-thumb"><div class="mini-template-grid count-${t.editorState.layoutCount}">${Array.from({ length: t.editorState.layoutCount }, (_, i) => { const url = t.editorState.items[i]?.media?.previewUrl; return `<span>${url ? `<img src="${escapeAttr(url)}" alt="">` : ''}</span>`; }).join('')}</div></div><div class="template-card-copy"><span class="scope-badge">${scopeLabel(t.shareScope)}</span><h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(category)}・${t.editorState.mode === 'consumables' ? '商品' : '写真'}${t.editorState.layoutCount}${t.editorState.mode === 'consumables' ? '点' : '枚'}</p></div><div class="template-card-actions"><button class="btn primary" data-action="use" data-id="${escapeAttr(t.id)}">このテンプレートを使う</button>${canDelete ? `<button class="icon-btn danger-text" data-action="delete" data-id="${escapeAttr(t.id)}" title="削除">${icon('trash', 17)}</button>` : ''}</div></article>`; }
function scopeLabel(s) { return s === 'private' ? '自分だけ' : s === 'office' ? '営業所' : '全社'; }
//# sourceMappingURL=templates.js.map