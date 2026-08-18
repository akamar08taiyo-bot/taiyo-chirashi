import { isLocalMode } from '../config.js';
import { blobGet, blobSet, kvGet, kvSet } from '../storage/localDb.js';
import { createId } from '../utils/id.js';
import { AppError } from '../utils/errors.js';
import { blobToDataUrl, createPreviewBlob, validateImageFile } from '../utils/images.js';
import { createSeedMedia } from './demoData.js';
import { storageSignedUrl, supabaseRequest, supabaseUpload } from './supabaseRest.js';
const LOCAL_MEDIA = 'demo.media.v3';
export async function listMedia(session, query = '', kind = 'all') {
    let records;
    if (isLocalMode) {
        records = (await localMedia()).filter((record) => canReadLocalMedia(record, session));
    }
    else {
        const rows = await supabaseRequest('/rest/v1/media?deleted_at=is.null&select=*&order=created_at.desc', { token: session.accessToken });
        records = (await Promise.all(rows.map(async (row) => hydrateMediaRow(row, session)))).filter((record) => canReadLibraryMedia(record, session));
    }
    const q = query.trim().toLowerCase();
    return records.filter((m) => (kind === 'all' || m.kind === kind) && (!q || [m.fileName, m.category, m.manufacturer, m.productName].some((v) => v.toLowerCase().includes(q))));
}
export async function uploadMedia(session, file, options) {
    validateImageFile(file);
    const preview = await createPreviewBlob(file);
    const id = createId();
    const now = new Date().toISOString();
    if (isLocalMode) {
        const originalKey = `media:${id}:original`;
        const previewKey = `media:${id}:preview`;
        await Promise.all([blobSet(originalKey, file), blobSet(previewKey, preview)]);
        const previewUrl = await blobToDataUrl(preview);
        const record = { id, organizationId: session.profile.organizationId, officeId: session.profile.officeId, ownerId: session.profile.id, kind: options.kind, shareScope: options.shareScope, category: options.category, manufacturer: options.manufacturer ?? '', productName: options.productName ?? '', fileName: file.name, mimeType: file.type, sizeBytes: file.size, originalPath: originalKey, previewPath: previewKey, originalUrl: '', previewUrl, createdAt: now, deletedAt: null };
        const all = await localMedia();
        all.unshift(record);
        await kvSet(LOCAL_MEDIA, all);
        return record;
    }
    const ext = extensionFor(file);
    const previewExt = preview.type === 'image/webp' ? 'webp' : 'jpg';
    const originalPath = `${session.userId}/${id}/original.${ext}`;
    const previewPath = `${session.userId}/${id}/preview.${previewExt}`;
    await supabaseUpload(originalPath, file, session.accessToken);
    await supabaseUpload(previewPath, preview, session.accessToken);
    const rows = await supabaseRequest('/rest/v1/media', { method: 'POST', token: session.accessToken, prefer: 'return=representation', body: { organization_id: session.profile.organizationId, office_id: session.profile.officeId, owner_id: session.profile.id, kind: options.kind, share_scope: options.shareScope, category: options.category, manufacturer: options.manufacturer ?? '', product_name: options.productName ?? '', file_name: file.name, mime_type: file.type, size_bytes: file.size, original_path: originalPath, preview_path: previewPath } });
    const row = rows[0];
    if (!row)
        throw new AppError('写真を保存できませんでした。元の写真は削除されていません。もう一度お試しください。');
    return hydrateMediaRow(row, session);
}
export function mediaToFlyerRef(media) {
    return { mediaId: media.id, previewUrl: media.previewUrl, originalUrl: media.originalUrl, localBlobKey: isLocalMode ? media.originalPath : null, fileName: media.fileName };
}
export async function getOriginalBlobForRef(ref) {
    if (!ref?.localBlobKey || !isLocalMode)
        return null;
    return blobGet(ref.localBlobKey);
}
export async function refreshMediaRef(session, ref) {
    if (!ref?.mediaId || isLocalMode)
        return ref;
    const rows = await supabaseRequest(`/rest/v1/media?id=eq.${encodeURIComponent(ref.mediaId)}&deleted_at=is.null&select=*`, { token: session.accessToken });
    const row = rows[0];
    if (!row)
        return ref;
    const media = await hydrateMediaRow(row, session);
    return mediaToFlyerRef(media);
}
async function hydrateMediaRow(row, session) {
    const [previewUrl, originalUrl] = await Promise.all([storageSignedUrl('flyer-media', row.preview_path, session.accessToken), storageSignedUrl('flyer-media', row.original_path, session.accessToken)]);
    return { id: row.id, organizationId: row.organization_id, officeId: row.office_id, ownerId: row.owner_id, kind: row.kind, shareScope: row.share_scope, category: row.category ?? '', manufacturer: row.manufacturer ?? '', productName: row.product_name ?? '', fileName: row.file_name, mimeType: row.mime_type, sizeBytes: row.size_bytes, originalPath: row.original_path, previewPath: row.preview_path, originalUrl, previewUrl, createdAt: row.created_at, deletedAt: row.deleted_at };
}
async function localMedia() { let all = await kvGet(LOCAL_MEDIA); if (!all) {
    all = createSeedMedia();
    await kvSet(LOCAL_MEDIA, all);
} return all; }
function extensionFor(file) { if (file.type === 'image/png')
    return 'png'; if (file.type === 'image/webp')
    return 'webp'; return 'jpg'; }
function encodeStoragePath(path) { return path.split('/').map(encodeURIComponent).join('/'); }
export async function hydrateFlyerMediaRefs(session, record) {
    if (isLocalMode)
        return structuredClone(record);
    const next = structuredClone(record);
    await Promise.all(next.editorState.items.map(async (item) => { if (item.media?.mediaId) {
        try {
            item.media = await refreshMediaRef(session, item.media);
        }
        catch { /* keep existing ref */ }
    } }));
    return next;
}
export async function setMediaDeleted(session, id, deleted) {
    const deletedAt = deleted ? new Date().toISOString() : null;
    if (isLocalMode) {
        const all = await localMedia();
        const index = all.findIndex(m => m.id === id);
        if (index >= 0 && all[index])
            all[index] = { ...all[index], deletedAt };
        await kvSet(LOCAL_MEDIA, all);
        return;
    }
    await supabaseRequest(`/rest/v1/media?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', token: session.accessToken, body: { deleted_at: deletedAt }, prefer: 'return=minimal' });
}
function canReadLibraryMedia(record, session) { const p = session.profile; if (record.ownerId === p.id)
    return true; if (record.organizationId !== p.organizationId)
    return false; if (p.role === 'org_admin' && record.shareScope !== 'private')
    return true; if (record.shareScope === 'company')
    return true; return record.shareScope === 'office' && record.officeId === p.officeId; }
function canReadLocalMedia(record, session) { return canReadLibraryMedia(record, session); }
//# sourceMappingURL=mediaService.js.map