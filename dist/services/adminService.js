import { isLocalMode } from '../config.js';
import { kvGet, kvSet } from '../storage/localDb.js';
import { createDemoContext } from './demoData.js';
import { storageSignedUrl, supabaseRequest, supabaseUploadToBucket } from './supabaseRest.js';
import { createId } from '../utils/id.js';
import { AppError } from '../utils/errors.js';
import { blobToDataUrl, validateImageFile } from '../utils/images.js';
import { setLocalPassword } from './localCredentialService.js';
const LOCAL_ADMIN_CONTEXT = 'demo.admin.context.v1';
export async function getAdminContext() {
    if (!isLocalMode)
        throw new Error('Use loadAppContext for remote');
    const seed = createDemoContext();
    let ctx = await kvGet(LOCAL_ADMIN_CONTEXT);
    if (!ctx) {
        ctx = seed;
        await kvSet(LOCAL_ADMIN_CONTEXT, ctx);
        return structuredClone(ctx);
    }
    let changed = false;
    if (ctx.offices.filter(o => o.isActive).length < seed.offices.length) {
        const seededIds = new Set(seed.offices.map(o => o.id));
        const custom = ctx.offices.filter(o => !seededIds.has(o.id));
        ctx.offices = [...seed.offices.map(o => structuredClone(o)), ...custom];
        changed = true;
    }
    ctx.profiles = ctx.profiles.map(profile => {
        const legacy = profile;
        if (legacy.flyerContactName === undefined || legacy.mobilePhone === undefined)
            changed = true;
        return { ...profile, flyerContactName: legacy.flyerContactName ?? profile.displayName, mobilePhone: legacy.mobilePhone ?? profile.phone };
    });
    if (changed)
        await kvSet(LOCAL_ADMIN_CONTEXT, ctx);
    return structuredClone(ctx);
}
export async function uploadCompanyLogo(session, file) {
    if (session.profile.role !== 'org_admin')
        throw new AppError('会社ロゴを変更する権限がありません。');
    validateImageFile(file);
    if (file.size > 5 * 1024 * 1024)
        throw new AppError('会社ロゴは5MB以下の画像を選んでください。');
    if (isLocalMode) {
        const ctx = await getAdminContext();
        ctx.organization = { ...ctx.organization, logoPath: 'local-company-logo', logoUrl: await blobToDataUrl(file) };
        await kvSet(LOCAL_ADMIN_CONTEXT, ctx);
        return structuredClone(ctx.organization);
    }
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${session.profile.organizationId}/logo.${ext}`;
    await supabaseUploadToBucket('company-assets', path, file, session.accessToken, true);
    await supabaseRequest(`/rest/v1/organizations?id=eq.${encodeURIComponent(session.profile.organizationId)}`, { method: 'PATCH', token: session.accessToken, body: { logo_path: path }, prefer: 'return=minimal' });
    const logoUrl = await storageSignedUrl('company-assets', path, session.accessToken, 3600);
    const ctxOrg = (await supabaseRequest(`/rest/v1/organizations?id=eq.${encodeURIComponent(session.profile.organizationId)}&select=id,name,address,phone,fax,logo_path`, { token: session.accessToken }))[0];
    if (!ctxOrg)
        throw new AppError('会社ロゴを保存できませんでした。');
    return { id: ctxOrg.id, name: ctxOrg.name, address: ctxOrg.address ?? '', phone: ctxOrg.phone ?? '', fax: ctxOrg.fax ?? '', logoPath: ctxOrg.logo_path, logoUrl };
}
export async function updateOrganization(session, org) {
    if (session.profile.role !== 'org_admin')
        throw new AppError('会社情報を変更する権限がありません。');
    if (isLocalMode) {
        const ctx = await getAdminContext();
        ctx.organization = structuredClone(org);
        await kvSet(LOCAL_ADMIN_CONTEXT, ctx);
        return;
    }
    await supabaseRequest(`/rest/v1/organizations?id=eq.${encodeURIComponent(org.id)}`, { method: 'PATCH', token: session.accessToken, body: { name: org.name, address: org.address, phone: org.phone, fax: org.fax, logo_path: org.logoPath }, prefer: 'return=minimal' });
}
export async function createOffice(session, input) {
    if (session.profile.role !== 'org_admin')
        throw new AppError('営業所を追加する権限がありません。');
    const name = input.name.trim();
    if (!name)
        throw new AppError('営業所名を入力してください。');
    if (isLocalMode) {
        const ctx = await getAdminContext();
        const office = { id: createId(), organizationId: session.profile.organizationId, name, address: input.address.trim(), phone: input.phone.trim(), fax: input.fax.trim(), isActive: true };
        ctx.offices.push(office);
        await kvSet(LOCAL_ADMIN_CONTEXT, ctx);
        return structuredClone(office);
    }
    const rows = await supabaseRequest('/rest/v1/offices', { method: 'POST', token: session.accessToken, prefer: 'return=representation', body: { organization_id: session.profile.organizationId, name, address: input.address.trim(), phone: input.phone.trim(), fax: input.fax.trim(), is_active: true } });
    const row = rows[0];
    if (!row)
        throw new AppError('営業所を追加できませんでした。');
    return { id: row.id, organizationId: row.organization_id, name: row.name, address: row.address ?? '', phone: row.phone ?? '', fax: row.fax ?? '', isActive: row.is_active };
}
export async function updateOffice(session, office) {
    if (session.profile.role === 'employee' || (session.profile.role === 'office_admin' && session.profile.officeId !== office.id))
        throw new AppError('この営業所を変更する権限がありません。');
    if (isLocalMode) {
        const ctx = await getAdminContext();
        const i = ctx.offices.findIndex(o => o.id === office.id);
        if (i >= 0)
            ctx.offices[i] = structuredClone(office);
        await kvSet(LOCAL_ADMIN_CONTEXT, ctx);
        return;
    }
    await supabaseRequest(`/rest/v1/offices?id=eq.${encodeURIComponent(office.id)}`, { method: 'PATCH', token: session.accessToken, body: { name: office.name, address: office.address, phone: office.phone, fax: office.fax, is_active: office.isActive }, prefer: 'return=minimal' });
}
export async function createEmployee(session, input) {
    if (session.profile.role === 'employee')
        throw new AppError('社員を追加する権限がありません。');
    if (session.profile.role === 'office_admin' && input.officeId !== session.profile.officeId)
        throw new AppError('自営業所以外の社員は追加できません。');
    if (isLocalMode) {
        const ctx = await getAdminContext();
        if (ctx.profiles.some(p => p.employeeId === input.employeeId))
            throw new AppError('同じ社員IDがすでに登録されています。');
        const profile = { id: createId(), organizationId: session.profile.organizationId, officeId: input.officeId, employeeId: input.employeeId, displayName: input.displayName, phone: input.phone, flyerContactName: input.displayName, mobilePhone: input.phone, role: session.profile.role === 'office_admin' ? 'employee' : input.role, isActive: true };
        ctx.profiles.push(profile);
        await kvSet(LOCAL_ADMIN_CONTEXT, ctx);
        await setLocalPassword(profile.employeeId, input.password);
        return profile;
    }
    const result = await supabaseRequest('/functions/v1/admin-users', { method: 'POST', token: session.accessToken, body: { action: 'create', ...input } });
    return result.profile;
}
export async function setEmployeeActive(session, profile, active) {
    if (session.profile.role === 'employee' || (session.profile.role === 'office_admin' && profile.officeId !== session.profile.officeId))
        throw new AppError('この社員を変更する権限がありません。');
    if (profile.id === session.profile.id && !active)
        throw new AppError('自分自身を利用停止にはできません。');
    if (isLocalMode) {
        const ctx = await getAdminContext();
        const i = ctx.profiles.findIndex(p => p.id === profile.id);
        if (i >= 0 && ctx.profiles[i])
            ctx.profiles[i] = { ...ctx.profiles[i], isActive: active };
        await kvSet(LOCAL_ADMIN_CONTEXT, ctx);
        return;
    }
    await supabaseRequest('/functions/v1/admin-users', { method: 'POST', token: session.accessToken, body: { action: active ? 'activate' : 'deactivate', profileId: profile.id } });
}
export async function createCategory(session, name, slug) {
    if (session.profile.role !== 'org_admin')
        throw new AppError('カテゴリーを追加する権限がありません。');
    const category = { id: createId(), organizationId: session.profile.organizationId, name, slug, sortOrder: 100, isActive: true };
    if (isLocalMode) {
        const ctx = await getAdminContext();
        ctx.categories.push(category);
        await kvSet(LOCAL_ADMIN_CONTEXT, ctx);
        return category;
    }
    const rows = await supabaseRequest('/rest/v1/categories', { method: 'POST', token: session.accessToken, prefer: 'return=representation', body: { organization_id: session.profile.organizationId, name, slug, sort_order: 100, is_active: true } });
    const row = rows[0];
    if (!row)
        throw new AppError('カテゴリーを追加できませんでした。');
    return { id: row.id, organizationId: row.organization_id, name: row.name, slug: row.slug, sortOrder: row.sort_order, isActive: row.is_active };
}
//# sourceMappingURL=adminService.js.map