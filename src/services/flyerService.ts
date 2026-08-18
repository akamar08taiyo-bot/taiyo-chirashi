import { isLocalMode } from '../config.js';
import type { AppContext, AuthSession, EditorState, FlyerRecord, NewFlyerInput, SaveResult, ShareScope, TemplateRecord } from '../types.js';
import { createDefaultEditorState, createSeedFlyers, createSeedTemplates } from './demoData.js';
import { kvGet, kvSet } from '../storage/localDb.js';
import { createId } from '../utils/id.js';
import { supabaseRequest } from './supabaseRest.js';
import { AppError } from '../utils/errors.js';
import { normalizeEditorState, sanitizeEditorStateForServer } from '../utils/editorState.js';

const LOCAL_FLYERS = 'demo.flyers.v3';
const LOCAL_TEMPLATES = 'demo.templates.v3';

interface FlyerRow {
  id: string; organization_id: string; office_id: string; owner_id: string; assignee_id: string; title: string; category_id: string; share_scope: ShareScope;
  orientation: FlyerRecord['orientation']; layout_count: FlyerRecord['layoutCount']; design_style: FlyerRecord['designStyle']; main_color: string; editor_state: EditorState;
  version: number; created_at: string; updated_at: string; deleted_at: string | null;
}

export async function ensureLocalSeeds(): Promise<void> {
  if (!isLocalMode) return;
  if (!(await kvGet<FlyerRecord[]>(LOCAL_FLYERS))) await kvSet(LOCAL_FLYERS, createSeedFlyers());
  const seeds = createSeedTemplates();
  const existing = await kvGet<TemplateRecord[]>(LOCAL_TEMPLATES);
  if (!existing) { await kvSet(LOCAL_TEMPLATES, seeds); return; }
  // 初期テンプレートを後から増やしても既存の利用者へ届くように、不足分だけ補充する。
  // 利用者が自分で保存したテンプレートは消さない。
  const existingIds = new Set(existing.map((t) => t.id));
  const missing = seeds.filter((t) => !existingIds.has(t.id));
  const retired = new Set(['tpl-private-bed-4']);
  const kept = existing.filter((t) => !retired.has(t.id));
  if (missing.length || kept.length !== existing.length) await kvSet(LOCAL_TEMPLATES, [...missing, ...kept]);
}

export async function listFlyers(session: AuthSession, includeDeleted = false): Promise<FlyerRecord[]> {
  if (isLocalMode) {
    await ensureLocalSeeds();
    const all = (await kvGet<FlyerRecord[]>(LOCAL_FLYERS)) ?? [];
    return all.filter((record) => canReadLocal(record, session) && (includeDeleted ? Boolean(record.deletedAt)&&canDeleteLocal(record,session) : !record.deletedAt)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const deletedFilter = includeDeleted ? 'deleted_at=not.is.null' : 'deleted_at=is.null';
  const rows = await supabaseRequest<FlyerRow[]>(`/rest/v1/flyers?select=*&${deletedFilter}&order=updated_at.desc`, { token: session.accessToken });
  return rows.map(mapFlyer);
}

export async function getFlyer(session: AuthSession, id: string): Promise<FlyerRecord | null> {
  if (isLocalMode) return (await listAllLocal()).find((record) => record.id === id && canReadLocal(record, session)) ?? null;
  const rows = await supabaseRequest<FlyerRow[]>(`/rest/v1/flyers?id=eq.${encodeURIComponent(id)}&select=*`, { token: session.accessToken });
  return rows[0] ? mapFlyer(rows[0]) : null;
}

export async function createFlyer(session: AuthSession, context: AppContext, input: NewFlyerInput): Promise<FlyerRecord> {
  const template = input.templateId ? await getTemplateById(session, input.templateId) : null;
  const state = template ? normalizeEditorState(template.editorState) : createDefaultEditorState(input.layoutCount, input.mode);
  state.mode = input.mode;
  if (input.mode === 'consumables') { state.display.showUnits=false; state.display.showBurden1=false; state.display.showBurden2=false; state.display.showBurden3=false; state.display.showPrices=true; }
  state.layoutCount = input.layoutCount;
  state.orientation = input.orientation;
  state.items.forEach((item, index) => { item.number = index + 1; });
  const now = new Date().toISOString();
  const base: FlyerRecord = {
    id: createId(), organizationId: session.profile.organizationId, officeId: input.officeId || session.profile.officeId, ownerId: session.profile.id, assigneeId: session.profile.id,
    title: state.title || (input.mode==='consumables'?'無題の消耗品チラシ':input.mode==='rental'?'無題のレンタルチラシ':'無題の事例集'), categoryId: input.categoryId, shareScope: 'private', orientation: state.orientation, layoutCount: state.layoutCount,
    designStyle: state.design.style, mainColor: state.design.color, editorState: state, version: 1, createdAt: now, updatedAt: now, deletedAt: null
  };
  if (isLocalMode) {
    const all = await listAllLocal(); all.unshift(base); await kvSet(LOCAL_FLYERS, all); return structuredClone(base);
  }
  const payload = toInsertPayload(base); delete (payload as Partial<Record<string, unknown>>).id;
  const rows = await supabaseRequest<FlyerRow[]>('/rest/v1/flyers', { method: 'POST', token: session.accessToken, body: payload, prefer: 'return=representation' });
  const row = rows[0]; if (!row) throw new AppError('新しい事例集を作成できませんでした。もう一度お試しください。');
  return mapFlyer(row);
}

export async function saveFlyer(session: AuthSession, record: FlyerRecord, expectedVersion: number): Promise<SaveResult> {
  if (isLocalMode) {
    const all = await listAllLocal();
    const index = all.findIndex((entry) => entry.id === record.id);
    if (index < 0) return { ok: false, record: null, conflict: false, errorMessage: '保存先が見つかりませんでした。' };
    const current = all[index];
    if (!current) return { ok: false, record: null, conflict: false, errorMessage: '保存先が見つかりませんでした。' };
    if (current.version !== expectedVersion) return { ok: false, record: structuredClone(current), conflict: true, errorMessage: null };
    const saved = structuredClone(record); saved.version = expectedVersion + 1; saved.updatedAt = new Date().toISOString();
    all[index] = saved; await kvSet(LOCAL_FLYERS, all); return { ok: true, record: structuredClone(saved), conflict: false, errorMessage: null };
  }
  try {
    const rows = await supabaseRequest<FlyerRow[]>('/rest/v1/rpc/update_flyer_versioned', {
      method: 'POST', token: session.accessToken,
      body: {
        p_flyer_id: record.id, p_expected_version: expectedVersion, p_title: record.title, p_category_id: record.categoryId,
        p_office_id: record.officeId, p_assignee_id: record.assigneeId, p_share_scope: record.shareScope, p_orientation: record.orientation,
        p_layout_count: record.layoutCount, p_design_style: record.designStyle, p_main_color: record.mainColor, p_editor_state: sanitizeEditorStateForServer(record.editorState)
      }
    });
    const row = rows[0];
    if (!row) return { ok: false, record: await getFlyer(session, record.id), conflict: true, errorMessage: null };
    return { ok: true, record: mapFlyer(row), conflict: false, errorMessage: null };
  } catch (error) {
    if (error instanceof AppError && error.status === 409) return { ok: false, record: await getFlyer(session, record.id), conflict: true, errorMessage: null };
    return { ok: false, record: null, conflict: false, errorMessage: error instanceof AppError ? error.userMessage : '保存できませんでした。変更内容はこのPCに残っています。通信状況を確認して、もう一度お試しください。' };
  }
}

export async function duplicateFlyer(session: AuthSession, source: FlyerRecord, titleSuffix = '（コピー）'): Promise<FlyerRecord> {
  const now = new Date().toISOString();
  const copy: FlyerRecord = { ...structuredClone(source), id: createId(), ownerId: session.profile.id, assigneeId: session.profile.id, officeId: session.profile.officeId, shareScope: 'private', title: `${source.title}${titleSuffix}`, version: 1, createdAt: now, updatedAt: now, deletedAt: null };
  copy.editorState.title = copy.title;
  if (isLocalMode) { const all = await listAllLocal(); all.unshift(copy); await kvSet(LOCAL_FLYERS, all); return structuredClone(copy); }
  const payload = toInsertPayload(copy); delete (payload as Partial<Record<string, unknown>>).id;
  const rows = await supabaseRequest<FlyerRow[]>('/rest/v1/flyers', { method: 'POST', token: session.accessToken, body: payload, prefer: 'return=representation' });
  const row = rows[0]; if (!row) throw new AppError('複製できませんでした。もう一度お試しください。'); return mapFlyer(row);
}

export async function setFlyerDeleted(session: AuthSession, id: string, deleted: boolean): Promise<void> {
  if (isLocalMode) {
    const all = await listAllLocal(); const index = all.findIndex((record) => record.id === id); if (index < 0) return;
    const current = all[index]; if (!current) return;if(!canDeleteLocal(current,session))throw new AppError('この作品を削除・復元する権限がありません。'); all[index] = { ...current, deletedAt: deleted ? new Date().toISOString() : null, updatedAt: new Date().toISOString() }; await kvSet(LOCAL_FLYERS, all); return;
  }
  const rows=await supabaseRequest<Array<{id:string}>>('/rest/v1/rpc/set_flyer_deleted',{method:'POST',token:session.accessToken,body:{p_flyer_id:id,p_deleted:deleted}});if(!rows.length)throw new AppError('この作品を削除・復元する権限がありません。');
}

export async function permanentlyDeleteFlyer(session: AuthSession, id: string): Promise<void> {
  if (isLocalMode) { const all=await listAllLocal();const record=all.find(r=>r.id===id);if(!record?.deletedAt||Date.now()-new Date(record.deletedAt).getTime()<30*86400000)throw new AppError('削除から30日経過するまで完全削除できません。');if(!canDeleteLocal(record,session))throw new AppError('完全削除する権限がありません。');await kvSet(LOCAL_FLYERS, all.filter((record) => record.id !== id)); return; }
  await supabaseRequest(`/rest/v1/flyers?id=eq.${encodeURIComponent(id)}&deleted_at=not.is.null`, { method: 'DELETE', token: session.accessToken, prefer: 'return=minimal' });
}

async function listAllLocal(): Promise<FlyerRecord[]> { await ensureLocalSeeds(); return (await kvGet<FlyerRecord[]>(LOCAL_FLYERS)) ?? []; }
async function getTemplateById(session: AuthSession, id: string): Promise<TemplateRecord | null> {
  if (isLocalMode) { await ensureLocalSeeds(); return ((await kvGet<TemplateRecord[]>(LOCAL_TEMPLATES)) ?? []).find((t) => t.id === id) ?? null; }
  const rows = await supabaseRequest<Array<{ id:string; organization_id:string; office_id:string|null; owner_id:string; name:string; category_id:string; share_scope:ShareScope; editor_state:EditorState; created_at:string; updated_at:string; deleted_at:string|null }>>(`/rest/v1/templates?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=*`, { token: session.accessToken });
  const row = rows[0]; return row ? { id:row.id,organizationId:row.organization_id,officeId:row.office_id,ownerId:row.owner_id,name:row.name,categoryId:row.category_id,shareScope:row.share_scope,editorState:normalizeEditorState(row.editor_state),createdAt:row.created_at,updatedAt:row.updated_at,deletedAt:row.deleted_at } : null;
}

function canReadLocal(record: FlyerRecord, session: AuthSession): boolean {
  const p = session.profile;
  if (record.ownerId === p.id) return true;
  if (record.organizationId !== p.organizationId) return false;
  if (p.role === 'org_admin' && record.shareScope !== 'private') return true;
  if (record.shareScope === 'company') return true;
  return record.shareScope === 'office' && record.organizationId === p.organizationId && record.officeId === p.officeId;
}
function mapFlyer(row: FlyerRow): FlyerRecord { return { id:row.id,organizationId:row.organization_id,officeId:row.office_id,ownerId:row.owner_id,assigneeId:row.assignee_id,title:row.title,categoryId:row.category_id,shareScope:row.share_scope,orientation:row.orientation,layoutCount:row.layout_count,designStyle:row.design_style,mainColor:row.main_color,editorState:normalizeEditorState(row.editor_state),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at,deletedAt:row.deleted_at }; }
function toInsertPayload(record: FlyerRecord): Record<string, unknown> { return { id:record.id,organization_id:record.organizationId,office_id:record.officeId,owner_id:record.ownerId,assignee_id:record.assigneeId,title:record.title,category_id:record.categoryId,share_scope:record.shareScope,orientation:record.orientation,layout_count:record.layoutCount,design_style:record.designStyle,main_color:record.mainColor,editor_state:sanitizeEditorStateForServer(record.editorState),version:record.version }; }

function canDeleteLocal(record:FlyerRecord,session:AuthSession):boolean{const p=session.profile;if(record.ownerId===p.id)return true;if(record.organizationId!==p.organizationId||record.shareScope==='private')return false;if(p.role==='org_admin')return true;return p.role==='office_admin'&&record.officeId===p.officeId;}
