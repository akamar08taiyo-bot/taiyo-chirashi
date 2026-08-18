import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  prefer?: string;
}

export async function supabaseRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  const headers: Record<string, string> = {
    apikey: config.supabaseAnonKey,
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.prefer) headers.Prefer = options.prefer;
  try {
    const init: RequestInit = { method: options.method ?? 'GET', headers, signal: controller.signal };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    const response = await fetch(`${config.supabaseUrl}${path}`, init);
    const text = await response.text();
    const data = text ? safeJson(text) : null;
    if (!response.ok) {
      const message = extractMessage(data);
      throw new AppError(mapHttpMessage(response.status, message), response.status, data);
    }
    return data as T;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new AppError('通信に時間がかかっています。通信状況を確認して、もう一度お試しください。');
    throw new AppError('サーバーへ接続できませんでした。通信状況を確認してください。', 0, error);
  } finally {
    window.clearTimeout(timer);
  }
}

export async function supabaseUpload(path: string, blob: Blob, token: string): Promise<void> {
  return supabaseUploadToBucket('flyer-media',path,blob,token,false);
}

export async function supabaseUploadToBucket(bucket: string, path: string, blob: Blob, token: string, upsert = false): Promise<void> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(path)}`, {
      method: 'POST', signal: controller.signal, body: blob,
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}`, 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': upsert ? 'true' : 'false' }
    });
    if (!response.ok) throw new AppError('画像をアップロードできませんでした。元の画像は削除されていません。', response.status);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('画像をアップロードできませんでした。元の画像は削除されていません。', 0, error);
  } finally { window.clearTimeout(timer); }
}


export async function storageSignedUrl(bucket:string,path:string,token:string,expiresIn=3600):Promise<string>{
  if(!path)return'';
  const result=await supabaseRequest<{signedURL?:string;signedUrl?:string}>(`/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodePath(path)}`,{method:'POST',token,body:{expiresIn}});
  const signed=result.signedURL??result.signedUrl??'';
  return signed.startsWith('http')?signed:`${config.supabaseUrl}/storage/v1${signed}`;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return { message: text }; }
}

function extractMessage(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return String(record.message ?? record.error_description ?? record.error ?? '');
}

function mapHttpMessage(status: number, fallback: string): string {
  if (status === 401) return 'ログインの有効期限が切れました。もう一度ログインしてください。編集中の内容は一時保存されています。';
  if (status === 403) return 'この操作を行う権限がありません。';
  if (status === 404) return '対象のデータが見つかりませんでした。';
  if (status === 409) return '別の更新と重なりました。最新状態を確認してください。';
  if (status >= 500) return 'サーバーで一時的な問題が発生しました。少し待ってからもう一度お試しください。';
  return fallback || '処理を完了できませんでした。もう一度お試しください。';
}
