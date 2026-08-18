import { isLocalMode } from '../config.js';
import { kvGet, kvSet } from '../storage/localDb.js';
import { createId } from '../utils/id.js';
import { ensureLocalSeeds } from './flyerService.js';
import { supabaseRequest } from './supabaseRest.js';
import { normalizeEditorState, sanitizeEditorStateForServer } from '../utils/editorState.js';
import { AppError } from '../utils/errors.js';
const LOCAL_TEMPLATES = 'demo.templates.v3';
export async function listTemplates(session) {
    if (isLocalMode) {
        await ensureLocalSeeds();
        return ((await kvGet(LOCAL_TEMPLATES)) ?? []).filter((t) => !t.deletedAt && canRead(t, session));
    }
    const rows = await supabaseRequest('/rest/v1/templates?deleted_at=is.null&select=*&order=updated_at.desc', { token: session.accessToken });
    return rows.map(mapTemplate);
}
export async function saveFlyerAsTemplate(session, flyer, name, shareScope) {
    const now = new Date().toISOString();
    const template = { id: createId(), organizationId: session.profile.organizationId, officeId: shareScope === 'company' ? null : session.profile.officeId, ownerId: session.profile.id, name, categoryId: flyer.categoryId, shareScope, editorState: structuredClone(flyer.editorState), createdAt: now, updatedAt: now, deletedAt: null };
    if (isLocalMode) {
        await ensureLocalSeeds();
        const all = (await kvGet(LOCAL_TEMPLATES)) ?? [];
        all.unshift(template);
        await kvSet(LOCAL_TEMPLATES, all);
        return template;
    }
    const rows = await supabaseRequest('/rest/v1/templates', { method: 'POST', token: session.accessToken, prefer: 'return=representation', body: { organization_id: template.organizationId, office_id: template.officeId, owner_id: template.ownerId, name: template.name, category_id: template.categoryId, share_scope: template.shareScope, editor_state: sanitizeEditorStateForServer(template.editorState) } });
    const row = rows[0];
    if (!row)
        throw new AppError('テンプレートを保存できませんでした。通信状況を確認して、もう一度お試しください。');
    return mapTemplate(row);
}
function canRead(t, s) { const p = s.profile; if (t.ownerId === p.id)
    return true; if (t.organizationId !== p.organizationId)
    return false; if (p.role === 'org_admin' && t.shareScope !== 'private')
    return true; if (t.shareScope === 'company')
    return true; return t.shareScope === 'office' && t.officeId === p.officeId; }
function mapTemplate(row) { return { id: row.id, organizationId: row.organization_id, officeId: row.office_id, ownerId: row.owner_id, name: row.name, categoryId: row.category_id, shareScope: row.share_scope, editorState: normalizeEditorState(row.editor_state), createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at }; }
export async function setTemplateDeleted(session, id, deleted) {
    const deletedAt = deleted ? new Date().toISOString() : null;
    if (isLocalMode) {
        await ensureLocalSeeds();
        const all = (await kvGet(LOCAL_TEMPLATES)) ?? [];
        const index = all.findIndex(t => t.id === id);
        if (index >= 0 && all[index])
            all[index] = { ...all[index], deletedAt, updatedAt: new Date().toISOString() };
        await kvSet(LOCAL_TEMPLATES, all);
        return;
    }
    await supabaseRequest(`/rest/v1/templates?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', token: session.accessToken, body: { deleted_at: deletedAt }, prefer: 'return=minimal' });
}
//# sourceMappingURL=templateService.js.map