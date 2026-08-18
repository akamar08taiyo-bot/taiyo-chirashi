const raw = window.__TSS_CONFIG__ ?? {};
export const config = {
    supabaseUrl: String(raw.supabaseUrl ?? '').replace(/\/$/, ''),
    supabaseAnonKey: String(raw.supabaseAnonKey ?? ''),
    authEmailDomain: String(raw.authEmailDomain ?? 'auth.taiyo-silver.internal'),
    aiFunctionName: String(raw.aiFunctionName ?? 'ai-assist'),
    appName: String(raw.appName ?? '太陽シルバーサービス 事例集・チラシ作成'),
    showDemoLogin: raw.showDemoLogin === true
};
export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
export const isLocalMode = !isSupabaseConfigured;
//# sourceMappingURL=config.js.map