const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5.6';
const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? '';

type Mode = 'polish' | 'from_memo';
type DocumentMode = 'rental' | 'cases' | 'consumables';
interface RequestBody { mode?: Mode; documentMode?: DocumentMode; text?: string; title?: string; }

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ message: 'この操作には対応していません。' }, 405, cors);
  if (!originAllowed(request)) return json({ message: 'この画面からは利用できません。' }, 403, cors);
  if (!OPENAI_API_KEY) return json({ message: 'AI機能の設定が完了していません。管理者へお問い合わせください。' }, 503, cors);

  const auth = request.headers.get('Authorization') ?? '';
  const profile = await authenticatedProfile(auth);
  if (!profile?.is_active) return json({ message: 'ログインの有効期限が切れました。もう一度ログインしてください。' }, 401, cors);

  let body: RequestBody;
  try { body = await request.json(); } catch { return json({ message: '入力内容を確認してください。' }, 400, cors); }
  const mode = body.mode;
  const text = String(body.text ?? '').trim();
  const title = String(body.title ?? '').trim();
  const documentMode: DocumentMode = body.documentMode === 'consumables' ? 'consumables' : body.documentMode === 'rental' ? 'rental' : 'cases';
  if (mode !== 'polish' && mode !== 'from_memo') return json({ message: 'AIの処理方法を選び直してください。' }, 400, cors);
  if (!text) return json({ message: mode === 'polish' ? '整える文章を入力してください。' : '説明文にしたいメモを入力してください。' }, 400, cors);
  if (text.length > 4000 || title.length > 300) return json({ message: '文章が長すぎます。少し短くしてからお試しください。' }, 400, cors);

  const documentPurpose = documentMode === 'consumables' ? '施設向け消耗品チラシ' : documentMode === 'rental' ? '福祉用具レンタルチラシ' : '福祉用具の事例集・チラシ';
  const task = mode === 'polish'
    ? `入力文の事実関係を一切増やさず、${documentPurpose}向けに、自然で読みやすい日本語へ整えてください。`
    : `短いメモに書かれている事実だけを使い、${documentPurpose}向けの簡潔な説明文を1案作ってください。`;
  const instructions = [
    'あなたは太陽シルバーサービス社内の文章補助です。',
    task,
    '最重要ルール: ユーザーが入力していない事実を絶対に追加しないでください。',
    '病名、身体状況、障害、年齢、性別、利用者属性、商品名、メーカー名、品番、規格、容量、入数、価格、設置場所、設置方法、効果、介護度、事故歴などを推測してはいけません。',
    '入力にない具体的な数値・固有名詞・因果関係も作らないでください。',
    '情報が足りない場合は、足りない事実を補わず、入力された範囲だけを自然な文章にしてください。',
    '断定を強めたり、医療・介護上の判断を新たに加えたりしないでください。',
    '回答は提案文だけにしてください。前置き、箇条書き、引用符、解説は不要です。'
  ].join('\n');
  const input = `タイトル（参考情報）: ${title || '未入力'}\n\n入力内容:\n${text}`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OPENAI_MODEL, instructions, input, max_output_tokens: 700 })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('OpenAI API error', response.status, safeError(payload));
      return json({ message: 'AI文章を作成できませんでした。入力内容を残したまま、もう一度お試しください。' }, 502, cors);
    }
    const suggestion = extractOutputText(payload).trim();
    if (!suggestion) return json({ message: 'AIから文章を取得できませんでした。もう一度お試しください。' }, 502, cors);
    return json({ suggestion }, 200, cors);
  } catch (error) {
    console.error('AI request failed', error instanceof Error ? error.message : 'unknown');
    return json({ message: 'AI文章を作成できませんでした。入力内容を残したまま、もう一度お試しください。' }, 502, cors);
  }
});

async function authenticatedProfile(auth: string): Promise<{ id: string; is_active: boolean } | null> {
  if (!auth.startsWith('Bearer ') || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth } });
  if (!userResponse.ok) return null;
  const user = await userResponse.json().catch(() => null) as { id?: string } | null;
  if (!user?.id) return null;
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,is_active`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth } });
  if (!profileResponse.ok) return null;
  const rows = await profileResponse.json().catch(() => []) as Array<{ id: string; is_active: boolean }>;
  return rows[0] ?? null;
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === 'string') return record.output_text;
  const output = Array.isArray(record.output) ? record.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === 'string') chunks.push(text);
    }
  }
  return chunks.join('\n');
}
function safeError(value: unknown): string { try { return JSON.stringify(value).slice(0, 800); } catch { return 'unserializable'; } }
function originAllowed(request: Request): boolean { if (!APP_ORIGIN) return true; return (request.headers.get('Origin') ?? '') === APP_ORIGIN; }
function corsHeaders(request: Request): Record<string,string> { const origin = APP_ORIGIN || request.headers.get('Origin') || '*'; return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }; }
function json(body: unknown, status: number, headers: Record<string,string>): Response { return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } }); }
