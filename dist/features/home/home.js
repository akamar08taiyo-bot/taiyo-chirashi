import { topbar } from '../../components/shell.js';
import { icon } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
import { showModal } from '../../components/modal.js';
import { duplicateFlyer, listFlyers, setFlyerDeleted } from '../../services/flyerService.js';
import { hydrateFlyerMediaRefs } from '../../services/mediaService.js';
import { exportPdf, exportPng, findUnavailableExportImages, printPng } from '../editor/exportRenderer.js';
import { escapeAttr, escapeHtml } from '../../utils/html.js';
import { formatDateTime } from '../../utils/time.js';
import { navigate } from '../../app/router.js';
import { renderPaper, findOverflowIndexes } from '../editor/paper.js';
import { mergeDomOverflowIssues, validateEditorState } from '../../utils/validation.js';
export async function renderHome(root, session, context) {
    root.innerHTML = `${topbar(session)}<main class="home-page"><section class="home-hero"><div><h1>事例集・チラシを作成</h1><p>福祉用具のレンタル・事例集・消耗品チラシを、写真と文章だけでかんたんに作成できます。</p></div><button class="new-flyer-btn" id="new-flyer">${icon('plus', 24)}<span><strong>新しく作成する</strong><small>3ステップで作成開始</small></span></button></section><section class="home-section"><div class="section-title-row"><div><h2>最近作成したもの</h2><p>編集・複製・出力・共有設定ができます。</p></div><div class="list-tabs" id="work-filter"><button data-filter="mine" class="active">自分の作品</button><button data-filter="office">営業所内</button><button data-filter="company">会社全体</button></div></div><div id="flyer-list" class="flyer-list"><div class="loading">読み込んでいます…</div></div></section><section class="quick-links"><button data-nav="templates">${icon('template', 22)}<span><strong>テンプレート</strong><small>よく使う型から作成</small></span></button><button data-nav="media">${icon('image', 22)}<span><strong>写真ライブラリ</strong><small>商品写真・事例写真</small></span></button><button data-nav="trash">${icon('trash', 22)}<span><strong>ゴミ箱</strong><small>削除した作品を復元</small></span></button>${session.profile.role !== 'employee' ? `<button data-nav="admin">${icon('settings', 22)}<span><strong>管理</strong><small>社員・営業所・会社情報</small></span></button>` : ''}</section></main>`;
    let records = [];
    let filter = 'mine';
    const list = root.querySelector('#flyer-list');
    const load = async () => { try {
        records = await listFlyers(session, false);
        renderList();
    }
    catch (error) {
        if (list)
            list.innerHTML = `<div class="empty-panel error">${escapeHtml(error instanceof Error ? error.message : '作品を読み込めませんでした。')}</div>`;
    } };
    const renderList = () => { if (!list)
        return; const filtered = records.filter(r => filter === 'mine' ? r.ownerId === session.profile.id : filter === 'office' ? r.shareScope === 'office' && r.officeId === session.profile.officeId : r.shareScope === 'company'); list.innerHTML = filtered.length ? filtered.slice(0, 20).map(r => card(r, context, session)).join('') : `<div class="empty-panel"><strong>まだ作品がありません</strong><span>「新しく作成する」から始めてください。</span></div>`; };
    root.querySelector('#new-flyer')?.addEventListener('click', () => navigate('create'));
    root.querySelector('#work-filter')?.addEventListener('click', (e) => { const button = e.target.closest('[data-filter]'); if (!button)
        return; filter = button.dataset.filter; root.querySelectorAll('#work-filter button').forEach(b => b.classList.toggle('active', b === button)); renderList(); });
    list?.addEventListener('click', async (e) => { const button = e.target.closest('[data-action]'); if (!button)
        return; const id = button.dataset.id ?? ''; const record = records.find(r => r.id === id); if (!record)
        return; const action = button.dataset.action; if (action === 'edit')
        navigate(`editor/${id}`);
    else if (action === 'duplicate') {
        try {
            const copy = await duplicateFlyer(session, record);
            showToast('複製しました', 'success');
            navigate(`editor/${copy.id}`);
        }
        catch (error) {
            showToast(error instanceof Error ? error.message : '複製できませんでした。', 'error');
        }
    }
    else if (action === 'delete') {
        const answer = await showModal({ title: 'ゴミ箱へ移動しますか？', bodyHtml: `<p>「${escapeHtml(record.title)}」をゴミ箱へ移動します。あとから復元できます。</p>`, actions: [{ label: 'キャンセル', value: 'cancel', kind: 'secondary' }, { label: 'ゴミ箱へ移動', value: 'delete', kind: 'danger' }] });
        if (answer === 'delete') {
            await setFlyerDeleted(session, id, true);
            records = records.filter(r => r.id !== id);
            renderList();
            showToast('ゴミ箱へ移動しました', 'success');
        }
    }
    else if (action === 'pdf' || action === 'png' || action === 'png-print') {
        try {
            const hydrated = await hydrateFlyerMediaRefs(session, record);
            if (!(await confirmQuickOutput(hydrated, context)))
                return;
            showToast(action === 'png-print' ? '高品質PNGを作成しています…' : '出力データを作成しています…');
            if (action === 'pdf')
                await exportPdf(hydrated, context);
            else if (action === 'png-print')
                await printPng(hydrated, context);
            else
                await exportPng(hydrated, context);
            showToast(action === 'png-print' ? 'PNG印刷画面を開きました' : '保存しました', 'success');
        }
        catch (error) {
            showToast(error instanceof Error ? error.message : '出力できませんでした。', 'error');
        }
    } });
    await load();
}
function card(record, context, session) { const category = context.categories.find(c => c.id === record.categoryId)?.name ?? '未分類'; const office = context.offices.find(o => o.id === record.officeId)?.name ?? ''; const owner = context.profiles.find(p => p.id === record.ownerId)?.displayName ?? ''; const modeLabel = record.editorState.mode === 'consumables' ? '消耗品' : record.editorState.mode === 'rental' ? 'レンタル' : '事例集'; const first = record.editorState.items.find(i => i.media?.previewUrl)?.media?.previewUrl ?? ''; return `<article class="flyer-row"><button class="flyer-preview" data-action="edit" data-id="${escapeAttr(record.id)}">${first ? `<img src="${escapeAttr(first)}" alt="">` : `${icon('file', 32)}`}</button><div class="flyer-meta"><div class="meta-badges"><span>${modeLabel}</span><span>${escapeHtml(category)}</span><span>${scopeLabel(record.shareScope)}</span></div><h3>${escapeHtml(record.title)}</h3><p>${escapeHtml(office)}・${escapeHtml(owner)}　更新 ${escapeHtml(formatDateTime(record.updatedAt))}</p></div><div class="flyer-actions"><button class="icon-action primary-text" data-action="edit" data-id="${escapeAttr(record.id)}">${icon('edit', 16)}編集</button><button class="icon-action" data-action="duplicate" data-id="${escapeAttr(record.id)}">${icon('copy', 16)}複製</button><button class="icon-action" data-action="pdf" data-id="${escapeAttr(record.id)}">${icon('pdf', 16)}PDF</button><button class="icon-action" data-action="png" data-id="${escapeAttr(record.id)}">${icon('image', 16)}画像</button><button class="icon-action" data-action="png-print" data-id="${escapeAttr(record.id)}">${icon('print', 16)}PNG印刷</button>${canDelete(record, session) ? `<button class="icon-action danger-text" data-action="delete" data-id="${escapeAttr(record.id)}">${icon('trash', 16)}削除</button>` : ''}</div></article>`; }
function scopeLabel(scope) { return scope === 'private' ? '自分だけ' : scope === 'office' ? '営業所' : '会社全体'; }
function canDelete(record, session) { const p = session.profile; if (record.ownerId === p.id)
    return true; if (record.shareScope === 'private' || record.organizationId !== p.organizationId)
    return false; if (p.role === 'org_admin')
    return true; return p.role === 'office_admin' && record.officeId === p.officeId; }
async function confirmQuickOutput(record, context) {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none;z-index:-1';
    host.innerHTML = renderPaper(record, context, -1, false);
    document.body.append(host);
    try {
        const paper = host.querySelector('#flyer-paper');
        const issues = mergeDomOverflowIssues(validateEditorState(record.editorState), paper ? findOverflowIndexes(paper) : [], record.editorState.mode);
        const unavailable = await findUnavailableExportImages(record);
        for (const index of unavailable)
            issues.push({ code: `image_load_${index}`, message: `写真${String(index + 1).padStart(2, '0')}を読み込めませんでした。写真を選び直すか、通信状況を確認してください。`, itemIndex: index, severity: 'error' });
        if (!issues.length)
            return true;
        const errors = issues.filter(issue => issue.severity === 'error');
        const body = `<div class="validation-list">${issues.map(issue => `<div class="validation-item ${issue.severity}">${icon(issue.severity === 'error' ? 'warning' : 'help', 16)}<span>${escapeHtml(issue.message)}</span></div>`).join('')}</div>`;
        const actions = errors.length ? [{ label: '編集画面で修正', value: 'edit', kind: 'primary' }] : [{ label: '編集画面で確認', value: 'edit', kind: 'secondary' }, { label: 'このまま出力', value: 'continue', kind: 'primary' }];
        const answer = await showModal({ title: errors.length ? '出力前に修正が必要です' : '出力前の確認', bodyHtml: body, actions });
        if (answer === 'edit') {
            navigate(`editor/${record.id}`);
            return false;
        }
        return answer === 'continue';
    }
    finally {
        host.remove();
    }
}
//# sourceMappingURL=home.js.map