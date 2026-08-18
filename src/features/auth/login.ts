import { config, isLocalMode } from '../../config.js';
import { icon } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
import { localDemoLoginInfo, login } from '../../services/authService.js';
import { escapeHtml } from '../../utils/html.js';
import type { AuthSession } from '../../types.js';

export function renderLogin(root: HTMLElement, onSuccess: (session: AuthSession)=>Promise<void>): void {
  root.innerHTML=`<main class="login-page"><section class="login-card">
    <div class="login-brand">${icon('sun',46,'login-sun')}<div><strong>太陽シルバーサービス</strong><span>事例集・チラシ作成</span></div></div>
    <div class="login-copy"><h1>社員ログイン</h1><p>社員IDとパスワードを入力してください。</p></div>
    ${isLocalMode?`<div class="local-mode-note"><strong>ローカル確認モード</strong><span>Supabase未接続のため、端末内の確認用データで動作しています。</span></div>`:''}
    <form id="login-form" class="login-form"><label>社員ID<input id="employee-id" autocomplete="username" inputmode="numeric" placeholder="社員ID" required></label><label>パスワード<input id="password" type="password" autocomplete="current-password" placeholder="パスワード" required></label><button class="btn primary login-submit" type="submit">ログイン</button><div class="login-error" id="login-error" role="alert"></div></form>
    ${(isLocalMode&&config.showDemoLogin)?`<details class="demo-credentials"><summary>確認用のログイン情報</summary><p>パスワード：<code>${escapeHtml(localDemoLoginInfo.password)}</code></p>${localDemoLoginInfo.ids.map((item)=>`<button type="button" data-demo-id="${item.employeeId}">${escapeHtml(item.employeeId)}｜${escapeHtml(item.name)}（${item.role==='org_admin'?'全社管理者':item.role==='office_admin'?'営業所管理者':'一般社員'}）</button>`).join('')}</details>`:''}
  </section></main>`;
  const form=root.querySelector<HTMLFormElement>('#login-form'); const idInput=root.querySelector<HTMLInputElement>('#employee-id'); const passInput=root.querySelector<HTMLInputElement>('#password'); const errorEl=root.querySelector<HTMLElement>('#login-error');
  root.querySelectorAll<HTMLButtonElement>('[data-demo-id]').forEach((button)=>button.addEventListener('click',()=>{if(idInput)idInput.value=button.dataset.demoId??'';if(passInput)passInput.value=localDemoLoginInfo.password;idInput?.focus();}));
  form?.addEventListener('submit',async(e)=>{e.preventDefault();if(!idInput||!passInput||!errorEl)return;errorEl.textContent='';const submit=form.querySelector<HTMLButtonElement>('button[type=submit]');if(submit){submit.disabled=true;submit.textContent='ログイン中…';}try{const session=await login(idInput.value,passInput.value);showToast('ログインしました','success');await onSuccess(session);}catch(error){errorEl.textContent=error instanceof Error?error.message:'ログインできませんでした。';}finally{if(submit){submit.disabled=false;submit.textContent='ログイン';}}});
}
