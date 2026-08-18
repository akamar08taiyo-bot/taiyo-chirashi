import { isLocalMode } from '../config.js';
import { getAdminContext } from './adminService.js';
import { storageSignedUrl, supabaseRequest } from './supabaseRest.js';
import { AppError } from '../utils/errors.js';
export async function loadAppContext(session) {
    if (isLocalMode)
        return getAdminContext();
    const [orgRows, officeRows, profileRows, categoryRows] = await Promise.all([
        supabaseRequest(`/rest/v1/organizations?id=eq.${encodeURIComponent(session.profile.organizationId)}&select=id,name,logo_path,phone,fax,address`, { token: session.accessToken }),
        supabaseRequest('/rest/v1/offices?select=id,organization_id,name,address,phone,fax,is_active&is_active=eq.true&order=name.asc', { token: session.accessToken }),
        supabaseRequest('/rest/v1/profiles?select=id,organization_id,office_id,employee_id,display_name,phone,flyer_contact_name,mobile_phone,role,is_active&is_active=eq.true&order=display_name.asc', { token: session.accessToken }),
        supabaseRequest('/rest/v1/categories?select=id,organization_id,name,slug,sort_order,is_active&is_active=eq.true&order=sort_order.asc', { token: session.accessToken })
    ]);
    const org = orgRows[0];
    if (!org)
        throw new AppError('会社情報を読み込めませんでした。もう一度ログインしてお試しください。');
    return {
        organization: await mapOrganization(org, session), offices: officeRows.map(mapOffice), profiles: profileRows.map(mapProfile), categories: categoryRows.map(mapCategory)
    };
}
async function mapOrganization(row, session) { let logoUrl = ''; if (row.logo_path) {
    try {
        logoUrl = await storageSignedUrl('company-assets', row.logo_path, session.accessToken, 3600);
    }
    catch { /* logo remains optional */ }
} return { id: row.id, name: row.name, logoPath: row.logo_path, logoUrl, phone: row.phone ?? '', fax: row.fax ?? '', address: row.address ?? '' }; }
function mapOffice(row) { return { id: row.id, organizationId: row.organization_id, name: row.name, address: row.address ?? '', phone: row.phone ?? '', fax: row.fax ?? '', isActive: row.is_active }; }
function mapProfile(row) { return { id: row.id, organizationId: row.organization_id, officeId: row.office_id, employeeId: row.employee_id, displayName: row.display_name, phone: row.phone ?? '', flyerContactName: row.flyer_contact_name ?? '', mobilePhone: row.mobile_phone ?? '', role: row.role, isActive: row.is_active }; }
function mapCategory(row) { return { id: row.id, organizationId: row.organization_id, name: row.name, slug: row.slug, sortOrder: row.sort_order, isActive: row.is_active }; }
//# sourceMappingURL=contextService.js.map