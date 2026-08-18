import { isLocalMode } from '../config.js';
import type { AppContext, AuthSession, Category, Office, Organization, Profile } from '../types.js';
import { getAdminContext } from './adminService.js';
import { storageSignedUrl, supabaseRequest } from './supabaseRest.js';
import { AppError } from '../utils/errors.js';

interface OrganizationRow { id: string; name: string; logo_path: string | null; phone: string | null; fax: string | null; address: string | null; }
interface OfficeRow { id: string; organization_id: string; name: string; address: string | null; phone: string | null; fax: string | null; is_active: boolean; }
interface ProfileRow { id: string; organization_id: string; office_id: string; employee_id: string; display_name: string; phone: string | null; flyer_contact_name: string | null; mobile_phone: string | null; role: Profile['role']; is_active: boolean; }
interface CategoryRow { id: string; organization_id: string | null; name: string; slug: string; sort_order: number; is_active: boolean; }

export async function loadAppContext(session: AuthSession): Promise<AppContext> {
  if (isLocalMode) return getAdminContext();
  const [orgRows, officeRows, profileRows, categoryRows] = await Promise.all([
    supabaseRequest<OrganizationRow[]>(`/rest/v1/organizations?id=eq.${encodeURIComponent(session.profile.organizationId)}&select=id,name,logo_path,phone,fax,address`, { token: session.accessToken }),
    supabaseRequest<OfficeRow[]>('/rest/v1/offices?select=id,organization_id,name,address,phone,fax,is_active&is_active=eq.true&order=name.asc', { token: session.accessToken }),
    supabaseRequest<ProfileRow[]>('/rest/v1/profiles?select=id,organization_id,office_id,employee_id,display_name,phone,flyer_contact_name,mobile_phone,role,is_active&is_active=eq.true&order=display_name.asc', { token: session.accessToken }),
    supabaseRequest<CategoryRow[]>('/rest/v1/categories?select=id,organization_id,name,slug,sort_order,is_active&is_active=eq.true&order=sort_order.asc', { token: session.accessToken })
  ]);
  const org = orgRows[0];
  if (!org) throw new AppError('会社情報を読み込めませんでした。もう一度ログインしてお試しください。');
  return {
    organization: await mapOrganization(org,session), offices: officeRows.map(mapOffice), profiles: profileRows.map(mapProfile), categories: categoryRows.map(mapCategory)
  };
}

async function mapOrganization(row: OrganizationRow,session:AuthSession): Promise<Organization> { let logoUrl='';if(row.logo_path){try{logoUrl=await storageSignedUrl('company-assets',row.logo_path,session.accessToken,3600);}catch{/* logo remains optional */}}return { id: row.id, name: row.name, logoPath: row.logo_path, logoUrl, phone: row.phone ?? '', fax: row.fax ?? '', address: row.address ?? '' }; }
function mapOffice(row: OfficeRow): Office { return { id: row.id, organizationId: row.organization_id, name: row.name, address: row.address ?? '', phone: row.phone ?? '', fax: row.fax ?? '', isActive: row.is_active }; }
function mapProfile(row: ProfileRow): Profile { return { id: row.id, organizationId: row.organization_id, officeId: row.office_id, employeeId: row.employee_id, displayName: row.display_name, phone: row.phone ?? '', flyerContactName: row.flyer_contact_name ?? '', mobilePhone: row.mobile_phone ?? '', role: row.role, isActive: row.is_active }; }
function mapCategory(row: CategoryRow): Category { return { id: row.id, organizationId: row.organization_id, name: row.name, slug: row.slug, sortOrder: row.sort_order, isActive: row.is_active }; }
