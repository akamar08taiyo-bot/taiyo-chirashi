import { appState } from './app/state.js';
import { navigate, startRouter, type Route } from './app/router.js';
import { renderLogin } from './features/auth/login.js';
import { renderHome } from './features/home/home.js';
import { renderCreateWizard } from './features/flyers/createWizard.js';
import { renderEditor } from './features/editor/editor.js';
import { renderTemplates } from './features/templates/templates.js';
import { renderMediaLibrary } from './features/media/mediaLibrary.js';
import { renderAdmin } from './features/admin/admin.js';
import { renderTrash } from './features/home/trash.js';
import { getStoredSession, logout } from './services/authService.js';
import { loadAppContext } from './services/contextService.js';
import { ensureLocalSeeds } from './services/flyerService.js';
import { showModal } from './components/modal.js';
import { icon } from './components/icons.js';
import { isLocalMode } from './config.js';

const rootElement=document.getElementById('app');
if(!rootElement)throw new Error('App root not found');
const root:HTMLElement=rootElement;
let cleanup:(()=>void)|null=null;

async function bootstrap(){
  await ensureLocalSeeds();
  appState.session=await getStoredSession();
  if(appState.session){try{appState.context=await loadAppContext(appState.session);}catch{appState.session=null;appState.context=null;}}
  startRouter(renderRoute);
}

async function renderRoute(route:Route){
  cleanup?.();cleanup=null;
  if(!appState.session){renderLogin(root,async(session)=>{appState.session=session;appState.context=await loadAppContext(session);navigate('home');});return;}
  if(!appState.context){appState.context=await loadAppContext(appState.session);}
  const session=appState.session,context=appState.context;
  if(route.name==='login'){navigate('home');return;}
  if(route.name==='home')await renderHome(root,session,context);
  else if(route.name==='create')await renderCreateWizard(root,session,context);
  else if(route.name==='editor'&&route.params.id)cleanup=await renderEditor(root,route.params.id,{session,context});
  else if(route.name==='templates')await renderTemplates(root,session,context);
  else if(route.name==='media')await renderMediaLibrary(root,session,context);
  else if(route.name==='admin')await renderAdmin(root,session,context);
  else if(route.name==='trash')await renderTrash(root,session,context);
  else navigate('home');
}

let shellEventsBound=false;
function bindGlobalEvents(){
  if(shellEventsBound)return;
  shellEventsBound=true;
  document.addEventListener('click',async(e)=>{
    const target=e.target as Element|null;if(!target)return;
    const nav=target.closest<HTMLElement>('[data-nav]');
    if(nav){const route=nav.dataset.nav;if(route){e.preventDefault();navigate(route);return;}}
    const profileButton=target.closest('#profile-button');
    if(profileButton){e.stopPropagation();root.querySelector('#profile-popover')?.classList.toggle('open');return;}
    root.querySelector('#profile-popover')?.classList.remove('open');
    if(target.closest('#logout-btn')){const session=appState.session;await logout(session);appState.session=null;appState.context=null;navigate('login');return;}
    if(target.closest('#help-btn')){await showHelp();}
  });
}
async function showHelp(){await showModal({title:'かんたんな使い方',wide:true,bodyHtml:`<div class="help-steps"><div><b>1</b><span><strong>新しく作成</strong>カテゴリ・写真枚数・テンプレートを選びます。</span></div><div><b>2</b><span><strong>写真を追加</strong>ドラッグ＆ドロップまたは写真ライブラリから追加します。</span></div><div><b>3</b><span><strong>文章を入力</strong>中央のA4を見ながら、右側でタイトルや説明を編集します。</span></div><div><b>4</b><span><strong>自動保存</strong>操作を止めると自動保存されます。オフライン時はこのPCに残ります。</span></div><div><b>5</b><span><strong>PDF・画像・印刷</strong>下部のボタンからA4で出力します。</span></div></div>${isLocalMode?`<div class="local-mode-note inline">${icon('warning',16)}<span>現在はSupabase未接続のローカル確認モードです。AIとサーバー共有は本番設定後に有効になります。</span></div>`:''}`,actions:[{label:'閉じる',value:'close',kind:'primary'}]});}

bindGlobalEvents();
void bootstrap();
