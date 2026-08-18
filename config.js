// Public browser configuration. Supabase URL and anon/publishable key are not secrets.
// Keep service-role keys and OpenAI API keys on the server only.
window.__TSS_CONFIG__ = window.__TSS_CONFIG__ || {
  supabaseUrl: "",
  supabaseAnonKey: "",
  authEmailDomain: "auth.taiyo-silver.internal",
  aiFunctionName: "ai-assist",
  appName: "太陽シルバーサービス 事例集・チラシ作成",
  // 公開環境では必ず false。true にするとログイン画面に確認用の社員IDとパスワードが表示されます。
  showDemoLogin: false
};
