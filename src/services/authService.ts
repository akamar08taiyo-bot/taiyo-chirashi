import { config, isLocalMode } from '../config.js';
import type { AuthSession, Profile } from '../types.js';
import { demoProfiles } from './demoData.js';
import { getAdminContext } from './adminService.js';
import { supabaseRequest } from './supabaseRest.js';
import { AppError } from '../utils/errors.js';
import { localDefaultDemoPassword, verifyLocalPassword } from './localCredentialService.js';

const SESSION_KEY = 'tss.auth.session.v1';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string };
}
interface ProfileRow {
  id: string; organization_id: string; office_id: string; employee_id: string; display_name: string; phone: string | null; flyer_contact_name: string | null; mobile_phone: string | null; role: Profile['role']; is_active: boolean;
}

export function normalizeEmployeeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

export function authEmailForEmployeeId(employeeId: string): string {
  return `${normalizeEmployeeId(employeeId)}@${config.authEmailDomain}`;
}

export async function login(employeeId: string, password: string): Promise<AuthSession> {
  const normalized = normalizeEmployeeId(employeeId);
  if (!normalized || !password) throw new AppError('社員IDとパスワードを入力してください。');
  if (isLocalMode) {
    const ctx = await getAdminContext();
    const profile = ctx.profiles.find((entry) => entry.employeeId === normalized && entry.isActive);
    if (!profile || !(await verifyLocalPassword(normalized,password))) throw new AppError('社員IDまたはパスワードが正しくありません。');
    const session: AuthSession = { accessToken: 'local', refreshToken: 'local', expiresAt: Date.now() + 86400000, userId: profile.id, profile };
    storeSession(session); return session;
  }
  let auth: AuthResponse;
  try {
    auth = await supabaseRequest<AuthResponse>('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email: authEmailForEmployeeId(normalized), password }
    });
  } catch (error) {
    if (error instanceof AppError && (error.status === 400 || error.status === 401)) throw new AppError('社員IDまたはパスワードが正しくありません。');
    throw error;
  }
  const rows = await supabaseRequest<ProfileRow[]>(`/rest/v1/profiles?id=eq.${encodeURIComponent(auth.user.id)}&select=id,organization_id,office_id,employee_id,display_name,phone,flyer_contact_name,mobile_phone,role,is_active`, { token: auth.access_token });
  const row = rows[0];
  if (!row || !row.is_active) throw new AppError('この社員IDは現在利用できません。管理者へお問い合わせください。');
  const profile = mapProfile(row);
  const session: AuthSession = { accessToken: auth.access_token, refreshToken: auth.refresh_token, expiresAt: Date.now() + auth.expires_in * 1000, userId: auth.user.id, profile };
  storeSession(session); return session;
}

export async function getStoredSession(): Promise<AuthSession | null> {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    if (isLocalMode) {
      const ctx = await getAdminContext();
      const current = ctx.profiles.find((profile) => profile.id === session.userId && profile.isActive);
      if (!current) { localStorage.removeItem(SESSION_KEY); return null; }
      const next = { ...session, profile: current };
      storeSession(next);
      return next;
    }
    const active = session.expiresAt > Date.now() + 60000 ? session : await refreshSession(session);
    if (!active) return null;
    return await validateRemoteSession(active);
  } catch (error) {
    // A connectivity failure must not destroy a usable cached session. RLS remains
    // authoritative once the connection returns, and every server request still
    // carries the JWT. Authentication/permission failures do clear the cache.
    if (error instanceof AppError && error.status > 0) localStorage.removeItem(SESSION_KEY);
    if (error instanceof AppError && error.status === 0) {
      try { return JSON.parse(raw) as AuthSession; } catch { return null; }
    }
    return null;
  }
}

async function refreshSession(session: AuthSession): Promise<AuthSession | null> {
  try {
    const auth = await supabaseRequest<AuthResponse>('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refreshToken } });
    const next = { ...session, accessToken: auth.access_token, refreshToken: auth.refresh_token, expiresAt: Date.now() + auth.expires_in * 1000, userId: auth.user.id };
    storeSession(next); return next;
  } catch (error) {
    if (error instanceof AppError && error.status === 0) throw error;
    localStorage.removeItem(SESSION_KEY); return null;
  }
}

async function validateRemoteSession(session: AuthSession): Promise<AuthSession | null> {
  const rows = await supabaseRequest<ProfileRow[]>(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.userId)}&select=id,organization_id,office_id,employee_id,display_name,phone,flyer_contact_name,mobile_phone,role,is_active`, { token: session.accessToken });
  const row = rows[0];
  if (!row || !row.is_active) { localStorage.removeItem(SESSION_KEY); return null; }
  const next = { ...session, profile: mapProfile(row) };
  storeSession(next);
  return next;
}

export async function logout(session: AuthSession | null): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
  if (!session || isLocalMode) return;
  try { await supabaseRequest('/auth/v1/logout', { method: 'POST', token: session.accessToken }); } catch { /* local logout must still succeed */ }
}

function storeSession(session: AuthSession): void { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
function mapProfile(row: ProfileRow): Profile {
  return { id: row.id, organizationId: row.organization_id, officeId: row.office_id, employeeId: row.employee_id, displayName: row.display_name, phone: row.phone ?? '', flyerContactName: row.flyer_contact_name ?? '', mobilePhone: row.mobile_phone ?? '', role: row.role, isActive: row.is_active };
}

export const localDemoLoginInfo = { password: localDefaultDemoPassword, ids: demoProfiles.map((p) => ({ employeeId: p.employeeId, name: p.displayName, role: p.role })) };
