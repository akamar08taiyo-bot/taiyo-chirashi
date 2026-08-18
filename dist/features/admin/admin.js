import { topbar } from '../../components/shell.js';
import { icon } from '../../components/icons.js';
import { createCategory, createEmployee, createOffice, setEmployeeActive, updateOffice, updateOrganization, uploadCompanyLogo } from '../../services/adminService.js';
import { escapeAttr, escapeHtml } from '../../utils/html.js';
import { showToast } from '../../components/toast.js';
import { showModal } from '../../components/modal.js';
export async function renderAdmin(root, session, context) {
    if (session.profile.role === 'employee') {
        root.innerHTML = `${topbar(session)}<main class="center-message"><h1>管理画面を利用できません</h1><p>営業所管理者または全社管理者の権限が必要です。</p></main>`;
        return;
    }
    let localContext = structuredClone(context);
    let tab = 'employees';
    root.innerHTML = `${topbar(session)}<main class="standard-page admin-page"><header class="page-heading"><div><button class="page-back" data-nav="home">← ホームに戻る</button><h1>管理</h1><p>${session.profile.role === 'org_admin' ? '全社の社員・営業所・会社情報を管理できます。' : '自営業所の社員・営業所情報を管理できます。'}</p></div></header><div class="admin-tabs" id="admin-tabs"><button data-tab="employees" class="active">${icon('users', 17)}社員管理</button><button data-tab="offices">${icon('building', 17)}営業所情報</button>${session.profile.role === 'org_admin' ? `<button data-tab="company">${icon('settings', 17)}会社情報</button><button data-tab="categories">${icon('file', 17)}カテゴリー</button>` : ''}</div><section id="admin-content"></section></main>`;
    const content = root.querySelector('#admin-content');
    const render = () => { if (!content)
        return; if (tab === 'employees')
        content.innerHTML = employeesHtml(localContext.profiles, localContext.offices, session);
    else if (tab === 'offices')
        content.innerHTML = officesHtml(localContext.offices, session);
    else if (tab === 'company')
        content.innerHTML = companyHtml(localContext.organization);
    else
        content.innerHTML = categoriesHtml(localContext); bindContent(); };
    const bindContent = () => { content?.querySelector('#add-employee')?.addEventListener('click', () => void addEmployee()); content?.querySelector('#add-office')?.addEventListener('click', () => void addOffice()); content?.querySelectorAll('[data-toggle-user]').forEach(btn => btn.addEventListener('click', () => void toggleUser(btn.dataset.toggleUser ?? ''))); content?.querySelectorAll('[data-office-form]').forEach(form => form.addEventListener('submit', (e) => void saveOffice(e, form))); content?.querySelector('#company-form')?.addEventListener('submit', (e) => void saveCompany(e)); content?.querySelector('#company-logo-input')?.addEventListener('change', (e) => void saveLogo(e)); content?.querySelector('#category-form')?.addEventListener('submit', (e) => void addCategory(e)); };
    root.querySelector('#admin-tabs')?.addEventListener('click', (e) => { const btn = e.target.closest('[data-tab]'); if (!btn)
        return; tab = btn.dataset.tab; root.querySelectorAll('#admin-tabs button').forEach(b => b.classList.toggle('active', b === btn)); render(); });
    async function addOffice() { const input = await officeDialog(); if (!input)
        return; try {
        const office = await createOffice(session, input);
        localContext.offices.push(office);
        context.offices.push(structuredClone(office));
        render();
        showToast('営業所を追加しました', 'success');
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : '営業所を追加できませんでした。', 'error');
    } }
    async function addEmployee() { const input = await employeeDialog(localContext.offices, session); if (!input)
        return; try {
        const profile = await createEmployee(session, input);
        localContext.profiles.push(profile);
        context.profiles.push(structuredClone(profile));
        render();
        showToast('社員を追加しました', 'success');
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : '社員を追加できませんでした。', 'error');
    } }
    async function toggleUser(id) { const p = localContext.profiles.find(x => x.id === id); if (!p)
        return; const action = await showModal({ title: p.isActive ? '社員を利用停止にしますか？' : '社員を再開しますか？', bodyHtml: `<p>${escapeHtml(p.displayName)}さんのアカウントを${p.isActive ? '利用停止' : '再開'}します。過去作品は削除されません。</p>`, actions: [{ label: 'キャンセル', value: 'cancel', kind: 'secondary' }, { label: p.isActive ? '利用停止' : '再開', value: 'ok', kind: p.isActive ? 'danger' : 'primary' }] }); if (action !== 'ok')
        return; try {
        await setEmployeeActive(session, p, !p.isActive);
        p.isActive = !p.isActive;
        const shared = context.profiles.find(x => x.id === p.id);
        if (shared)
            shared.isActive = p.isActive;
        render();
        showToast(p.isActive ? '利用を再開しました' : '利用停止にしました', 'success');
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : '変更できませんでした。', 'error');
    } }
    async function saveOffice(e, form) { e.preventDefault(); const id = form.dataset.officeForm ?? ''; const office = localContext.offices.find(o => o.id === id); if (!office)
        return; const data = new FormData(form); const next = { ...office, name: String(data.get('name') ?? ''), address: String(data.get('address') ?? ''), phone: String(data.get('phone') ?? ''), fax: String(data.get('fax') ?? '') }; try {
        await updateOffice(session, next);
        Object.assign(office, next);
        const shared = context.offices.find(o => o.id === next.id);
        if (shared)
            Object.assign(shared, next);
        showToast('営業所情報を保存しました', 'success');
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : '保存できませんでした。', 'error');
    } }
    async function saveLogo(e) { const input = e.target; const file = input.files?.[0]; if (!file)
        return; try {
        const org = await uploadCompanyLogo(session, file);
        localContext.organization = org;
        Object.assign(context.organization, org);
        render();
        showToast('会社ロゴを保存しました', 'success');
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : '会社ロゴを保存できませんでした。', 'error');
    }
    finally {
        input.value = '';
    } }
    async function saveCompany(e) { e.preventDefault(); const form = e.target, data = new FormData(form); const next = { ...localContext.organization, name: String(data.get('name') ?? ''), address: String(data.get('address') ?? ''), phone: String(data.get('phone') ?? ''), fax: String(data.get('fax') ?? '') }; try {
        await updateOrganization(session, next);
        localContext.organization = next;
        Object.assign(context.organization, next);
        showToast('会社情報を保存しました', 'success');
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : '保存できませんでした。', 'error');
    } }
    async function addCategory(e) { e.preventDefault(); const form = e.target, data = new FormData(form), name = String(data.get('name') ?? '').trim(), slug = String(data.get('slug') ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'); if (!name || !slug)
        return showToast('カテゴリー名と識別名を入力してください。'); try {
        const c = await createCategory(session, name, slug);
        localContext.categories.push(c);
        context.categories.push(structuredClone(c));
        form.reset();
        render();
        showToast('カテゴリーを追加しました', 'success');
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : '追加できませんでした。', 'error');
    } }
    render();
}
function employeesHtml(profiles, offices, session) { const visible = profiles.filter(p => session.profile.role === 'org_admin' || p.officeId === session.profile.officeId); return `<div class="admin-section-head"><div><h2>社員管理</h2><p>退職・休職時は削除せず「利用停止」にします。</p></div><button class="btn primary" id="add-employee">${icon('plus', 16)}社員を追加</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>社員ID</th><th>氏名</th><th>営業所</th><th>権限</th><th>状態</th><th></th></tr></thead><tbody>${visible.map(p => `<tr><td>${escapeHtml(p.employeeId)}</td><td><strong>${escapeHtml(p.displayName)}</strong></td><td>${escapeHtml(offices.find(o => o.id === p.officeId)?.name ?? '')}</td><td>${roleLabel(p.role)}</td><td><span class="status-pill ${p.isActive ? 'active' : 'inactive'}">${p.isActive ? '利用中' : '利用停止'}</span></td><td><button class="btn small ${p.isActive ? 'danger-outline' : 'secondary'}" data-toggle-user="${escapeAttr(p.id)}" ${p.id === session.profile.id ? 'disabled' : ''}>${p.isActive ? '利用停止' : '再開'}</button></td></tr>`).join('')}</tbody></table></div>`; }
function officesHtml(offices, session) { return `<div class="admin-section-head"><div><h2>営業所情報</h2><p>チラシへ自動表示される住所・TEL・FAXです。</p></div>${session.profile.role === 'org_admin' ? `<button class="btn primary" id="add-office">${icon('plus', 16)}営業所を追加</button>` : ''}</div><div class="office-admin-grid">${offices.filter(o => session.profile.role === 'org_admin' || o.id === session.profile.officeId).map(o => `<form class="office-form" data-office-form="${escapeAttr(o.id)}"><h3>${escapeHtml(o.name)}</h3><label>営業所名<input name="name" value="${escapeAttr(o.name)}"></label><label>住所<input name="address" value="${escapeAttr(o.address)}"></label><div class="two-fields"><label>TEL<input name="phone" value="${escapeAttr(o.phone)}"></label><label>FAX<input name="fax" value="${escapeAttr(o.fax)}"></label></div><button class="btn primary" type="submit">保存する</button></form>`).join('')}</div>`; }
function companyHtml(org) { return `<div class="admin-section-head"><div><h2>会社情報</h2><p>全社共通で利用する基本情報です。</p></div></div><div class="company-logo-admin"><div class="company-logo-preview">${org.logoUrl ? `<img src="${escapeAttr(org.logoUrl)}" alt="会社ロゴ">` : `<span>${icon('image', 24)}<small>ロゴ未登録</small></span>`}</div><label class="btn secondary">${icon('upload', 16)}会社ロゴを変更<input id="company-logo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><small>JPEG・PNG・WebP、5MB以下</small></div><form class="company-form" id="company-form"><label>会社名<input name="name" value="${escapeAttr(org.name)}"></label><label>住所<input name="address" value="${escapeAttr(org.address)}"></label><div class="two-fields"><label>TEL<input name="phone" value="${escapeAttr(org.phone)}"></label><label>FAX<input name="fax" value="${escapeAttr(org.fax)}"></label></div><button class="btn primary" type="submit">会社情報を保存</button></form>`; }
function categoriesHtml(context) { return `<div class="admin-section-head"><div><h2>カテゴリー</h2><p>全社で利用できるカテゴリーを追加できます。</p></div></div><div class="category-admin"><div class="category-list">${context.categories.map(c => `<span>${escapeHtml(c.name)}</span>`).join('')}</div><form id="category-form"><label>カテゴリー名<input name="name" placeholder="例：歩行器特集"></label><label>識別名（英数字）<input name="slug" placeholder="例：walker"></label><button class="btn primary" type="submit">追加</button></form></div>`; }
function officeDialog() { return new Promise(resolve => { const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.innerHTML = `<section class="modal"><header><h2>営業所を追加</h2><button class="icon-btn close">${icon('close')}</button></header><div class="modal-body form-grid"><label>営業所名<input id="office-name"></label><label>住所<input id="office-address"></label><label>TEL<input id="office-phone"></label><label>FAX<input id="office-fax"></label></div><footer><button class="btn secondary cancel">キャンセル</button><button class="btn primary submit">追加する</button></footer></section>`; const done = (v) => { overlay.remove(); resolve(v); }; overlay.querySelector('.close')?.addEventListener('click', () => done(null)); overlay.querySelector('.cancel')?.addEventListener('click', () => done(null)); overlay.querySelector('.submit')?.addEventListener('click', () => { const name = overlay.querySelector('#office-name')?.value.trim() ?? ''; if (!name)
    return showToast('営業所名を入力してください。', 'error'); done({ name, address: overlay.querySelector('#office-address')?.value.trim() ?? '', phone: overlay.querySelector('#office-phone')?.value.trim() ?? '', fax: overlay.querySelector('#office-fax')?.value.trim() ?? '' }); }); document.body.append(overlay); overlay.querySelector('#office-name')?.focus(); }); }
function roleLabel(r) { return r === 'org_admin' ? '全社管理者' : r === 'office_admin' ? '営業所管理者' : '一般社員'; }
function employeeDialog(offices, session) { return new Promise(resolve => { const allowed = offices.filter(o => session.profile.role === 'org_admin' || o.id === session.profile.officeId); const overlay = document.createElement('div'); overlay.className = 'modal-overlay'; overlay.innerHTML = `<section class="modal"><header><h2>社員を追加</h2><button class="icon-btn close">${icon('close')}</button></header><div class="modal-body form-grid"><label>社員ID<input id="emp-id" autocomplete="off"></label><label>氏名<input id="emp-name"></label><label>初期パスワード<input id="emp-password" type="password" minlength="8"><small>8文字以上</small></label><label>営業所<select id="emp-office">${allowed.map(o => `<option value="${escapeAttr(o.id)}">${escapeHtml(o.name)}</option>`).join('')}</select></label><label>携帯番号（任意）<input id="emp-phone"></label><label>権限<select id="emp-role" ${session.profile.role === 'office_admin' ? 'disabled' : ''}><option value="employee">一般社員</option><option value="office_admin">営業所管理者</option>${session.profile.role === 'org_admin' ? '<option value="org_admin">全社管理者</option>' : ''}</select></label></div><footer><button class="btn secondary cancel">キャンセル</button><button class="btn primary submit">追加する</button></footer></section>`; const done = (v) => { overlay.remove(); resolve(v); }; const values = () => ({ employeeId: overlay.querySelector('#emp-id')?.value.trim() || '', displayName: overlay.querySelector('#emp-name')?.value.trim() || '', password: overlay.querySelector('#emp-password')?.value || '', officeId: overlay.querySelector('#emp-office')?.value || session.profile.officeId, phone: overlay.querySelector('#emp-phone')?.value.trim() || '', role: (session.profile.role === 'office_admin' ? 'employee' : overlay.querySelector('#emp-role')?.value || 'employee') }); overlay.querySelector('.close')?.addEventListener('click', () => done(null)); overlay.querySelector('.cancel')?.addEventListener('click', () => done(null)); overlay.querySelector('.submit')?.addEventListener('click', () => { const v = values(); if (!v.employeeId || !v.displayName || v.password.length < 8)
    return showToast('社員ID・氏名・8文字以上の初期パスワードを入力してください。', 'error'); done(v); }); document.body.append(overlay); }); }
//# sourceMappingURL=admin.js.map