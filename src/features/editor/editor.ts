import type { AppContext, AuthSession, EditorState, FlyerItem, FlyerMode, FlyerRecord, LayoutCount, Orientation, ShareScope, SaveStatus } from '../../types.js';
import { topbar } from '../../components/shell.js';
import { icon } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
import { promptText, showModal } from '../../components/modal.js';
import { getFlyer, duplicateFlyer, saveFlyer } from '../../services/flyerService.js';
import { requestAiSuggestion } from '../../services/aiService.js';
import { mediaToFlyerRef, refreshMediaRef, uploadMedia } from '../../services/mediaService.js';
import { saveFlyerAsTemplate } from '../../services/templateService.js';
import { draftGet, draftSet } from '../../storage/localDb.js';
import { debounce } from '../../utils/debounce.js';
import { escapeAttr, escapeHtml } from '../../utils/html.js';
import { calculateBurdenAmounts, formatYen } from '../../utils/pricing.js';
import { validateEditorState, mergeDomOverflowIssues } from '../../utils/validation.js';
import { createId } from '../../utils/id.js';
import { normalizeEditorState } from '../../utils/editorState.js';
import { renderPaper, findOverflowIndexes } from './paper.js';
import { exportJpeg, exportPdf, exportPng, findUnavailableExportImages, printPng } from './exportRenderer.js';
import { openMediaPicker } from '../media/picker.js';
import { navigate } from '../../app/router.js';
import { getCopySamples, type CopySampleField } from './copySamples.js';
import { getRememberedFlyerContact, saveRememberedFlyerContact } from '../../services/contactPreferenceService.js';
import { CONSUMABLE_GROUPS, CONSUMABLE_GROUP_NAMES, getConsumableTypes, hasConsumableType } from './consumableCatalog.js';
import { layoutProductName } from '../../utils/productName.js';

/** 介護保険の福祉用具貸与13種目。候補として出すだけで、自由入力も可能。 */
const equipmentCategories=['特殊寝台','特殊寝台付属品','車椅子','車椅子付属品','床ずれ防止用具','体位変換器','手すり','スロープ','歩行器','歩行補助杖','認知症老人徘徊感知機器','移動用リフト','自動排泄処理装置','特定福祉用具','住宅改修'];

interface DraftEnvelope { record: FlyerRecord; savedAt: string; }
interface EditorDeps { session: AuthSession; context: AppContext; }

export async function renderEditor(root: HTMLElement, id: string, deps: EditorDeps): Promise<() => void> {
  let record=await getFlyer(deps.session,id);
  if(!record){root.innerHTML=`${topbar(deps.session)}<main class="center-message"><h1>事例集が見つかりません</h1><p>削除されたか、閲覧権限がない可能性があります。</p><button class="btn primary" data-nav="home">ホームへ戻る</button></main>`;return()=>{};}
  record={...record,editorState:normalizeEditorState(record.editorState)};
  record=await hydrateMedia(record,deps.session);
  const controller=new EditorController(root,record,deps);
  await controller.init();
  return()=>controller.destroy();
}

class EditorController {
  private record: FlyerRecord;
  private selectedIndex=0;
  private zoom=76;
  private autoFit=true;
  private history: FlyerRecord[]=[];
  private future: FlyerRecord[]=[];
  private saveStatus: SaveStatus='saved';
  private changeCounter=0;
  private lastSavedCounter=0;
  private destroyed=false;
  private dragFrom:number|null=null;
  private historyStamp=0;
  private localSave=debounce(()=>void this.persistLocalDraft(),180);
  private remoteSave=debounce(()=>void this.saveNow(),1300);
  private contactSave=debounce(()=>void this.persistContactPreference(),700);
  private onlineHandler=()=>{if(this.destroyed)return;this.updateConnectivity();if(this.changeCounter!==this.lastSavedCounter)void this.saveNow();void this.persistContactPreference();};
  private offlineHandler=()=>{if(this.destroyed)return;this.setSaveStatus('offline');this.showOfflineBanner();};
  private resizeTimer=0;
  private resizeHandler=()=>{if(this.destroyed)return;window.clearTimeout(this.resizeTimer);this.resizeTimer=window.setTimeout(()=>{if(!this.destroyed)this.fitZoom();},150);};
  private visibilityHandler=()=>{if(document.visibilityState==='hidden')void this.persistLocalDraft();};

  constructor(private root:HTMLElement,record:FlyerRecord,private deps:EditorDeps){this.record=record;}

  async init(){
    const draft=await draftGet<DraftEnvelope>(this.draftKey());
    if(draft && draft.record.id===this.record.id && new Date(draft.savedAt).getTime()>new Date(this.record.updatedAt).getTime()+500){
      const action=await showModal({title:'前回の編集中データがあります',bodyHtml:'<p>このPCに、サーバー保存より新しい編集中の内容が残っています。復元しますか？</p>',actions:[{label:'サーバーの内容を開く',value:'server',kind:'secondary'},{label:'このPCの内容を復元',value:'local',kind:'primary'}]});
      if(action==='local'){this.record={...draft.record,editorState:normalizeEditorState(draft.record.editorState)};showToast('このPCに残っていた編集内容を復元しました','success');}
    }
    let filledRememberedContact=false;
    if(this.record.ownerId===this.deps.session.userId&&!this.record.editorState.contact.personName&&!this.record.editorState.contact.mobilePhone){
      const remembered=await getRememberedFlyerContact(this.deps.session);
      if(remembered.personName||remembered.mobilePhone){this.record.editorState.contact=remembered;filledRememberedContact=true;}
    }
    this.build();
    window.addEventListener('online',this.onlineHandler);window.addEventListener('offline',this.offlineHandler);window.addEventListener('resize',this.resizeHandler);document.addEventListener('visibilitychange',this.visibilityHandler);
    this.updateConnectivity();
    if(filledRememberedContact)this.changed();
  }
  destroy(){this.destroyed=true;this.localSave.cancel();this.remoteSave.cancel();this.contactSave.cancel();window.clearTimeout(this.resizeTimer);window.removeEventListener('resize',this.resizeHandler);window.removeEventListener('online',this.onlineHandler);window.removeEventListener('offline',this.offlineHandler);document.removeEventListener('visibilitychange',this.visibilityHandler);void this.persistLocalDraft();void this.persistContactPreference();}

  private build(){
    this.root.innerHTML=`${topbar(this.deps.session,{editor:true})}<main class="workspace editor-workspace">
      <aside class="left-panel panel">${this.leftPanelHtml()}</aside>
      <section class="canvas-area"><div class="offline-banner hidden" id="offline-banner">${icon('wifiOff',17)}<span>現在オフラインです。変更内容はこのPCに保存しています。通信が戻り次第、自動保存します。</span></div>${this.toolbarHtml()}<div class="paper-wrap" id="paper-wrap"><div class="paper-stage" id="paper-host"></div></div>${this.bottomActionsHtml()}</section>
      <aside class="right-panel panel"><div id="right-editor"></div></aside>
    </main>`;
    this.bindStaticEvents();this.renderPaperOnly();this.renderRightEditor();this.scheduleFit();this.setSaveStatus(this.saveStatus);this.showOfflineBanner();
  }

  private leftPanelHtml(){
    const s=this.record.editorState;const p=this.deps.session.profile;
    const canManageMetadata=this.record.ownerId===p.id||p.role==='org_admin'||(p.role==='office_admin'&&this.record.officeId===p.officeId);
    const canChangeOffice=this.record.ownerId===p.id||p.role==='org_admin'||(p.role==='office_admin'&&this.record.officeId===p.officeId);
    const offices=this.deps.context.offices.filter(o=>o.isActive&&(canChangeOffice||o.id===this.record.officeId));
    const selectedOffice=this.deps.context.offices.find(o=>o.id===this.record.officeId);
    const profiles=this.deps.context.profiles.filter(x=>x.isActive&&x.officeId===this.record.officeId);
    const canChangeAssignee=canManageMetadata&&(p.role==='org_admin'||this.record.ownerId===p.id||this.record.officeId===p.officeId);
    const assigneeKnown=profiles.some(x=>x.id===this.record.assigneeId);
    return `<div class="tabs"><button class="tab active">設定</button><button class="tab" data-nav="templates">テンプレート</button><button class="tab" data-nav="home">保存済み</button></div>
    <section class="section-block mode-section"><h2>${icon('layout',16)} 作成モード</h2><div class="mode-switch"><button data-flyer-mode="rental" class="${s.mode==='rental'?'active':''}">レンタル</button><button data-flyer-mode="cases" class="${s.mode==='cases'?'active':''}">事例集</button><button data-flyer-mode="consumables" class="${s.mode==='consumables'?'active':''}">消耗品</button></div><small class="mode-help">モードを変えても入力済みデータは削除されません。</small></section>
    <section class="section-block"><h2>${icon('building',16)} 基本情報</h2>
      <label>営業所<select id="office-select" ${canChangeOffice?'':'disabled'}>${offices.map(o=>`<option value="${escapeAttr(o.id)}" ${o.id===this.record.officeId?'selected':''}>${escapeHtml(o.name)}</option>`).join('')}</select></label>
      ${selectedOffice?`<div class="office-auto-info"><strong>${escapeHtml(selectedOffice.name)}</strong><span>${escapeHtml(selectedOffice.address)}</span><span>TEL：${escapeHtml(selectedOffice.phone)}　FAX：${escapeHtml(selectedOffice.fax)}</span><small>営業所を選ぶと、この情報へ自動で切り替わります。</small></div>`:''}
      <label>チラシ担当名<input id="contact-name" maxlength="100" value="${escapeAttr(s.contact.personName)}" placeholder="例：久保 匠史"><small class="remember-hint">一度入力すると次回の新規作成でも自動入力します</small></label>
      <label>担当者の携帯番号<input id="contact-mobile" maxlength="40" value="${escapeAttr(s.contact.mobilePhone)}" inputmode="tel" placeholder="例：090-1234-5678"><small class="remember-hint">一度入力すると次回も自動入力します</small></label>
      ${s.mode!=='consumables'?`<label>カテゴリ<select id="category-select">${this.categoriesForMode(s.mode).map(c=>`<option value="${escapeAttr(c.id)}" ${c.id===this.record.categoryId?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select></label>`:'<div class="mode-info-note">消耗品モードでは、商品ごとに消耗品の種類を設定します。</div>'}
      <label>タイトル<input id="doc-title" maxlength="80" value="${escapeAttr(s.title)}"></label>${this.sampleSelectHtml('doc-title-sample','documentTitle','タイトル文言サンプル')}
      <label>サブタイトル（任意）<textarea id="doc-subtitle" rows="2" maxlength="220">${escapeHtml(s.subtitle)}</textarea></label>${this.sampleSelectHtml('doc-subtitle-sample','subtitle','サブタイトル文言サンプル')}
    </section>
    <section class="section-block"><h2>${icon('layout',16)} ${s.mode==='consumables'?'商品数・レイアウト':'写真レイアウト'}</h2><div class="layout-grid" id="layout-grid">${([1,2,3,4,6,9] as LayoutCount[]).map(count=>`<button data-layout="${count}" class="${s.layoutCount===count?'selected':''}"><i class="mini-layout mini-${count}">${Array.from({length:Math.min(count,9)},()=>'<span></span>').join('')}</i><span>${count}${s.mode==='consumables'?'商品':'枚'}${count===9?'（3×3）':''}</span>${s.layoutCount===count?'<b>✓</b>':''}</button>`).join('')}</div></section>
    <section class="section-block"><h2>${icon('eye',16)} 表示設定</h2>${this.switchHtml('showLogo','会社ロゴを表示',s.display.showLogo)}${s.mode==='consumables'?this.switchHtml('showPrices','価格（○○円）を表示',s.display.showPrices):`${this.switchHtml('showUnits','単位数を表示',s.display.showUnits)}${this.switchHtml('showBurden1','1割負担を表示',s.display.showBurden1)}${this.switchHtml('showBurden2','2割負担を表示',s.display.showBurden2)}${this.switchHtml('showBurden3','3割負担を表示',s.display.showBurden3)}`}</section>
    <section class="section-block"><h2>${icon('palette',16)} デザイン設定</h2><label>デザインスタイル<select id="design-style"><option value="standard" ${s.design.style==='standard'?'selected':''}>標準（ブラウン）</option><option value="simple" ${s.design.style==='simple'?'selected':''}>シンプル</option><option value="soft" ${s.design.style==='soft'?'selected':''}>やわらかい</option><option value="product" ${s.design.style==='product'?'selected':''}>商品紹介</option><option value="catalog" ${s.design.style==='catalog'?'selected':''}>商品カタログ（にぎやか）</option></select></label><div class="color-row"><span>メインカラー</span><div class="swatches">${['#2f86c5','#5a9f67','#ec8a1c','#8e6bc2','#71431f'].map(c=>`<button class="swatch ${s.design.color===c?'active':''}" data-color="${c}" style="background:${c}">${s.design.color===c?'✓':''}</button>`).join('')}<label class="swatch custom">＋<input type="color" id="custom-color" value="${escapeAttr(s.design.color)}"></label></div></div></section>
    <details class="section-block compact"><summary>${icon('settings',16)} その他の設定</summary><div class="details-body">
      <label>作品担当者（管理用）<select id="assignee-select" ${canChangeAssignee?'':'disabled'}>${!assigneeKnown?`<option value="${escapeAttr(this.record.assigneeId)}" selected>現在の担当者</option>`:''}${profiles.map(x=>`<option value="${escapeAttr(x.id)}" ${x.id===this.record.assigneeId?'selected':''}>${escapeHtml(x.displayName)}</option>`).join('')}</select></label>
      <label>共有範囲<select id="share-scope" ${canManageMetadata?'':'disabled'}><option value="private" ${this.record.shareScope==='private'?'selected':''}>自分だけ</option><option value="office" ${this.record.shareScope==='office'?'selected':''}>同じ営業所</option><option value="company" ${this.record.shareScope==='company'?'selected':''}>会社全体</option></select></label>
      <label>フッター見出し<input id="footer-headline" maxlength="100" value="${escapeAttr(s.footerHeadline)}"></label>${this.sampleSelectHtml('footer-headline-sample','footerHeadline','フッター見出しサンプル')}
      <label>フッター補足<textarea id="footer-note" rows="3" maxlength="220">${escapeHtml(s.footerNote)}</textarea></label>${this.sampleSelectHtml('footer-note-sample','footerNote','フッター補足サンプル')}
      <button class="btn secondary full" id="save-template-btn">テンプレートとして保存</button>
    </div></details>
    <button class="reset-btn" id="reset-visual-btn">${icon('restore',15)} 写真調整をリセット</button>`;
  }
  private categoriesForMode(mode:FlyerMode){const allowed=mode==='rental'?new Set(['rental','private-rental']):new Set(['cases','casebook','renovation','specified','specific-welfare','product','product-flyer']);const current=this.deps.context.categories.find(c=>c.id===this.record.categoryId);const list=this.deps.context.categories.filter(c=>allowed.has(c.slug));if(current&&!list.some(c=>c.id===current.id)&&current.slug!=='consumables')list.unshift(current);return list;}
  private sampleSelectHtml(id:string,field:CopySampleField,label:string){
    const grouped=new Map<string,string[]>();const samples=getCopySamples(field).filter(sample=>this.record.editorState.mode!=='consumables'||sample.group==='消耗品'||sample.group==='共通');for(const sample of samples){const list=grouped.get(sample.group)??[];list.push(sample.text);grouped.set(sample.group,list);}
    return `<label class="sample-select-label">${escapeHtml(label)}<select id="${escapeAttr(id)}" class="copy-sample-select"><option value="">サンプルから選ぶ（手入力も可能）</option>${[...grouped.entries()].map(([group,texts])=>`<optgroup label="${escapeAttr(group)}">${texts.map(text=>`<option value="${escapeAttr(text)}">${escapeHtml(text)}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
  }
  private switchHtml(key:keyof EditorState['display'],label:string,on:boolean){return `<div class="switch-row"><span>${label}</span><button class="switch ${on?'on':''}" data-display-key="${key}" aria-pressed="${on}"></button></div>`;}
  private toolbarHtml(){return `<div class="canvas-toolbar"><select id="orientation-select" aria-label="用紙方向"><option value="portrait" ${this.record.orientation==='portrait'?'selected':''}>A4縦</option><option value="landscape" ${this.record.orientation==='landscape'?'selected':''}>A4横</option></select><button class="ghost-btn" id="preview-btn">${icon('eye',16)}プレビュー表示</button><div class="zoom-group"><button id="zoom-out">−</button><span id="zoom-label">${this.zoom}%</span><button id="zoom-in">＋</button></div></div>`;}
  private bottomActionsHtml(){return `<div class="bottom-actions"><button class="secondary" id="save-btn">${icon('save',16)}下書きを保存</button><button class="primary" id="pdf-btn">${icon('pdf',16)}PDF出力</button><div class="split-action"><button class="secondary" id="png-btn">${icon('image',16)}画像（PNG）で保存</button><button class="secondary split-caret" id="jpeg-btn" title="JPEGで保存">JPG</button></div><button class="secondary" id="png-print-btn">${icon('print',16)}PNGを印刷</button><button class="primary" id="print-btn">${icon('print',16)}直接印刷</button></div>`;}

  private bindStaticEvents(){
    this.root.querySelector('#undo-btn')?.addEventListener('click',()=>this.undo());this.root.querySelector('#redo-btn')?.addEventListener('click',()=>this.redo());
    const title=this.root.querySelector<HTMLInputElement>('#doc-title');title?.addEventListener('input',()=>this.inputCommit('title',()=>{this.record.editorState.title=title.value;this.record.title=title.value||'無題の事例集';}));
    const subtitle=this.root.querySelector<HTMLTextAreaElement>('#doc-subtitle');subtitle?.addEventListener('input',()=>this.inputCommit('subtitle',()=>{this.record.editorState.subtitle=subtitle.value;}));
    const contactName=this.root.querySelector<HTMLInputElement>('#contact-name');contactName?.addEventListener('input',()=>{this.inputCommit('contact-name',()=>{this.record.editorState.contact.personName=contactName.value;});this.contactSave();});
    const contactMobile=this.root.querySelector<HTMLInputElement>('#contact-mobile');contactMobile?.addEventListener('input',()=>{this.inputCommit('contact-mobile',()=>{this.record.editorState.contact.mobilePhone=contactMobile.value;});this.contactSave();});
    const footerHeadline=this.root.querySelector<HTMLInputElement>('#footer-headline');footerHeadline?.addEventListener('input',()=>this.inputCommit('footer-headline',()=>{this.record.editorState.footerHeadline=footerHeadline.value;}));
    const footerNote=this.root.querySelector<HTMLTextAreaElement>('#footer-note');footerNote?.addEventListener('input',()=>this.inputCommit('footer-note',()=>{this.record.editorState.footerNote=footerNote.value;}));
    this.bindDocumentSample('#doc-title-sample',(value)=>{if(title){title.value=value;this.inputCommit('title-sample',()=>{this.record.editorState.title=value;this.record.title=value||'無題の事例集';});}});
    this.bindDocumentSample('#doc-subtitle-sample',(value)=>{if(subtitle){subtitle.value=value;this.inputCommit('subtitle-sample',()=>{this.record.editorState.subtitle=value;});}});
    this.bindDocumentSample('#footer-headline-sample',(value)=>{if(footerHeadline){footerHeadline.value=value;this.inputCommit('footer-headline-sample',()=>{this.record.editorState.footerHeadline=value;});}});
    this.bindDocumentSample('#footer-note-sample',(value)=>{if(footerNote){footerNote.value=value;this.inputCommit('footer-note-sample',()=>{this.record.editorState.footerNote=value;});}});
    this.root.querySelectorAll<HTMLButtonElement>('[data-flyer-mode]').forEach(btn=>btn.addEventListener('click',()=>this.switchMode(btn.dataset.flyerMode as FlyerMode)));
    this.root.querySelector<HTMLSelectElement>('#category-select')?.addEventListener('change',(e)=>this.commit(()=>{this.record.categoryId=(e.target as HTMLSelectElement).value;}));
    this.root.querySelector<HTMLSelectElement>('#assignee-select')?.addEventListener('change',(e)=>this.commit(()=>{this.record.assigneeId=(e.target as HTMLSelectElement).value;}));
    this.root.querySelector<HTMLSelectElement>('#office-select')?.addEventListener('change',(e)=>{const officeId=(e.target as HTMLSelectElement).value;this.commit(()=>{this.record.officeId=officeId;},true);this.build();});
    this.root.querySelector('#layout-grid')?.addEventListener('click',(e)=>{const button=(e.target as Element).closest<HTMLButtonElement>('[data-layout]');if(!button)return;const count=Number(button.dataset.layout) as LayoutCount;this.commit(()=>{this.record.editorState.layoutCount=count;this.record.layoutCount=count;this.selectedIndex=Math.min(this.selectedIndex,count-1);},true);this.build();});
    this.root.querySelectorAll<HTMLButtonElement>('[data-display-key]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.displayKey as keyof EditorState['display'];this.commit(()=>{this.record.editorState.display[key]=!this.record.editorState.display[key];});btn.classList.toggle('on',this.record.editorState.display[key]);btn.setAttribute('aria-pressed',String(this.record.editorState.display[key]));}));
    this.root.querySelector<HTMLSelectElement>('#design-style')?.addEventListener('change',(e)=>this.commit(()=>{this.record.editorState.design.style=(e.target as HTMLSelectElement).value as EditorState['design']['style'];this.record.designStyle=this.record.editorState.design.style;}));
    this.root.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(btn=>btn.addEventListener('click',()=>{const color=btn.dataset.color??'#2f86c5';this.commit(()=>{this.record.editorState.design.color=color;this.record.mainColor=color;});this.build();}));
    this.root.querySelector<HTMLInputElement>('#custom-color')?.addEventListener('change',(e)=>{const color=(e.target as HTMLInputElement).value;this.commit(()=>{this.record.editorState.design.color=color;this.record.mainColor=color;});this.build();});
    this.root.querySelector<HTMLSelectElement>('#share-scope')?.addEventListener('change',(e)=>this.commit(()=>{this.record.shareScope=(e.target as HTMLSelectElement).value as ShareScope;}));
    this.root.querySelector('#save-template-btn')?.addEventListener('click',()=>void this.saveAsTemplate());
    this.root.querySelector<HTMLSelectElement>('#orientation-select')?.addEventListener('change',(e)=>{const orientation=(e.target as HTMLSelectElement).value as Orientation;this.commit(()=>{this.record.orientation=orientation;this.record.editorState.orientation=orientation;});this.autoFit=true;this.renderPaperOnly();this.scheduleFit();});
    this.root.querySelector('#zoom-in')?.addEventListener('click',()=>{this.autoFit=false;this.setZoom(Math.min(100,this.zoom+4));});this.root.querySelector('#zoom-out')?.addEventListener('click',()=>{this.autoFit=false;this.setZoom(Math.max(52,this.zoom-4));});this.root.querySelector('#preview-btn')?.addEventListener('click',()=>this.previewFullscreen());
    this.root.querySelector('#save-btn')?.addEventListener('click',()=>void this.saveNow(true));this.root.querySelector('#pdf-btn')?.addEventListener('click',()=>void this.export('pdf'));this.root.querySelector('#png-btn')?.addEventListener('click',()=>void this.export('png'));this.root.querySelector('#jpeg-btn')?.addEventListener('click',()=>void this.export('jpeg'));this.root.querySelector('#png-print-btn')?.addEventListener('click',()=>void this.printAsPng());this.root.querySelector('#print-btn')?.addEventListener('click',()=>void this.print());
    this.root.querySelector('#reset-visual-btn')?.addEventListener('click',()=>{this.pushHistory();this.record.editorState.items.forEach(item=>item.transform={scale:100,x:50,y:50,rotation:0,fitMode:item.transform.fitMode??'cover'});this.changed();this.renderPaperOnly();this.renderRightEditor();});
    const host=this.root.querySelector<HTMLElement>('#paper-host');this.bindPaperInteraction(host,true);
  }

  private bindDocumentSample(selector:string,apply:(value:string)=>void){this.root.querySelector<HTMLSelectElement>(selector)?.addEventListener('change',(e)=>{const select=e.target as HTMLSelectElement;if(!select.value)return;apply(select.value);select.value='';});}
  private async persistContactPreference(){try{await saveRememberedFlyerContact(this.deps.session,this.record.editorState.contact);}catch{/* Flyer save is independent; local preference was already retained. */}}

  private renderPaperOnly(){const host=this.root.querySelector<HTMLElement>('#paper-host');if(!host)return;host.innerHTML=renderPaper(this.record,this.deps.context,this.selectedIndex,true);this.applyZoom();}
  private bindPaperInteraction(host:HTMLElement|null,allowDrag:boolean){
    if(!host)return;
    host.addEventListener('click',(e)=>{
      const target=e.target as HTMLElement;
      const card=target.closest<HTMLElement>('[data-item-index]');
      if(card){const index=Number(card.dataset.itemIndex);if(Number.isFinite(index)){this.selectedIndex=index;host.querySelectorAll('.case-card').forEach((node)=>node.classList.toggle('selected',node===card));this.renderRightEditor();}}
      if(target.closest('[data-preview-field]'))return;
      if(target.closest('[data-preview-action="photo"]')){
        this.activateRightTab('photo');
        // 写真が未設定の枠は、クリックだけでファイル選択が開くようにする
        if(!this.currentItem()?.media)window.setTimeout(()=>this.root.querySelector<HTMLInputElement>('#file-input')?.click(),0);
      }
      else if(target.closest('[data-preview-action="cost"]'))this.activateRightTab('basic');
    });
    host.addEventListener('focusin',(e)=>{
      const editable=(e.target as HTMLElement).closest<HTMLElement>('[data-preview-field]');if(!editable)return;
      const card=editable.closest<HTMLElement>('[data-item-index]');if(card){const index=Number(card.dataset.itemIndex);if(Number.isFinite(index))this.selectedIndex=index;}
      if(editable.dataset.historyPushed!=='1'){this.pushHistory();editable.dataset.historyPushed='1';}
      this.renderRightEditor();
    });
    host.addEventListener('keydown',(e)=>{
      const editable=(e.target as HTMLElement).closest<HTMLElement>('[data-preview-field]');if(!editable)return;
      const field=editable.dataset.previewField??'';
      const multiline=new Set(['document-subtitle','item-description','footer-note', ...(this.record.editorState.mode==='consumables'?['item-product']:[])]);
      if(e.key==='Enter'&&!multiline.has(field)){e.preventDefault();editable.blur();}
      if(e.key==='Escape'){e.preventDefault();editable.blur();}
    });
    host.addEventListener('input',(e)=>{const editable=(e.target as HTMLElement).closest<HTMLElement>('[data-preview-field]');if(editable)this.handlePreviewInput(editable);});
    host.addEventListener('focusout',(e)=>{
      const editable=(e.target as HTMLElement).closest<HTMLElement>('[data-preview-field]');if(!editable)return;
      delete editable.dataset.historyPushed;this.normalizePreviewField(editable);this.renderRightEditor();
    });
    if(allowDrag){
      host.addEventListener('dragstart',(e)=>{if((e.target as HTMLElement).closest('[data-preview-field]')){e.preventDefault();return;}const card=(e.target as Element).closest<HTMLElement>('[data-item-index]');if(card){this.dragFrom=Number(card.dataset.itemIndex);e.dataTransfer?.setData('text/plain',String(this.dragFrom));}});
      host.addEventListener('dragover',(e)=>{e.preventDefault();});
      host.addEventListener('drop',(e)=>void this.handlePaperDrop(e as DragEvent));
    }else host.querySelectorAll<HTMLElement>('[draggable="true"]').forEach((node)=>node.draggable=false);
  }
  private handlePreviewInput(editable:HTMLElement){
    const field=editable.dataset.previewField??'';const max=Math.max(1,Number(editable.dataset.previewMaxlength)||9999);let value=(field==='item-product'&&this.record.editorState.mode==='consumables'?(editable.innerText??''):(editable.textContent??'')).replace(/\u00a0/g,' ').replace(/\n{3,}/g,'\n\n');
    if(value.length>max){value=value.slice(0,max);editable.textContent=value;placeCaretAtEnd(editable);}
    const card=editable.closest<HTMLElement>('[data-item-index]');const itemIndex=card?Number(card.dataset.itemIndex):null;
    if(field==='document-title'){this.record.editorState.title=value;this.record.title=value.trim()||'無題の事例集';this.syncControlValue('#doc-title',value);}
    else if(field==='document-subtitle'){this.record.editorState.subtitle=value;this.syncControlValue('#doc-subtitle',value);}
    else if(field==='eyebrow')this.record.editorState.eyebrow=value;
    else if(field==='eyebrow-note')this.record.editorState.eyebrowNote=value;
    else if(field==='footer-headline')this.record.editorState.footerHeadline=value;
    else if(field==='footer-note')this.record.editorState.footerNote=value;
    else if(itemIndex!==null&&Number.isFinite(itemIndex)){
      const item=this.record.editorState.items[itemIndex];if(!item)return;
      if(field==='item-title'){item.title=value;if(itemIndex===this.selectedIndex)this.syncControlValue('#item-title',value);}
      else if(field==='item-description'){item.description=value;editable.classList.remove('compact','tight');if(value.length>90)editable.classList.add('tight');else if(value.length>60)editable.classList.add('compact');if(itemIndex===this.selectedIndex)this.syncControlValue('#item-description',value);}
      else if(field==='item-product'){item.productName=value;if(itemIndex===this.selectedIndex)this.syncControlValue('#item-product',value);}
      else if(field==='item-code'){item.productCode=value;if(itemIndex===this.selectedIndex)this.syncControlValue('#item-code',value);}
      else if(field==='item-units'){item.units=Math.max(0,Number(value.replace(/[^0-9]/g,''))||0);if(itemIndex===this.selectedIndex)this.syncControlValue('#item-units',String(item.units));}
      this.syncRightCounts(itemIndex,item);
    }
    this.changed();
  }
  private normalizePreviewField(editable:HTMLElement){
    if(editable.dataset.previewField!=='item-units')return;const card=editable.closest<HTMLElement>('[data-item-index]');const index=card?Number(card.dataset.itemIndex):NaN;const item=this.record.editorState.items[index];if(item)editable.textContent=Math.max(0,item.units).toLocaleString('ja-JP');
  }
  private syncControlValue(selector:string,value:string){const control=this.root.querySelector<HTMLInputElement|HTMLTextAreaElement>(selector);if(control&&control.value!==value)control.value=value;}
  private syncRightCounts(index:number,item:FlyerItem){if(index!==this.selectedIndex)return;const pairs:[string,number][]=[['#title-count',item.title.length],['#desc-count',item.description.length],['#product-count',item.productName.length]];for(const [selector,count] of pairs){const el=this.root.querySelector<HTMLElement>(selector);if(el)el.textContent=String(count);}}
  private activateRightTab(tab:'basic'|'photo'){const host=this.root.querySelector<HTMLElement>('#right-editor');if(!host)return;host.querySelectorAll<HTMLElement>('[data-editor-tab]').forEach((el)=>el.classList.toggle('active',el.dataset.editorTab===tab));host.querySelector('#basic-editor')?.classList.toggle('hidden',tab!=='basic');host.querySelector('#photo-editor')?.classList.toggle('hidden',tab!=='photo');}
  private renderRightEditor(){const host=this.root.querySelector<HTMLElement>('#right-editor');const item=this.record.editorState.items[this.selectedIndex];if(!host||!item)return;const burden=calculateBurdenAmounts(item.monthlyAmount);host.innerHTML=`<div class="editor-heading"><h2>${this.record.editorState.mode==='consumables'?'商品を編集':'写真・項目を編集'}</h2><div class="item-nav"><select id="item-select">${this.record.editorState.items.slice(0,this.record.layoutCount).map((it,i)=>`<option value="${i}" ${i===this.selectedIndex?'selected':''}>${escapeHtml(it.title||`${String(i+1).padStart(2,'0')} 未設定`)}</option>`).join('')}</select><button id="prev-item">${icon('chevronLeft',18)}</button><button id="next-item">${icon('chevronRight',18)}</button></div></div><div class="editor-tabs"><button class="active" data-editor-tab="basic">基本情報</button><button data-editor-tab="photo">写真の調整</button></div><div id="basic-editor" class="editor-body">${this.basicEditorHtml(item,burden)}</div><div id="photo-editor" class="editor-body hidden">${this.photoEditorHtml(item)}</div>`;this.bindRightEvents();}
  private basicEditorHtml(item:FlyerItem,burden:ReturnType<typeof calculateBurdenAmounts>){
    if(this.record.editorState.mode==='consumables')return this.consumableEditorHtml(item);
    return `<div class="primary-fields"><label class="field-strong">商品名<input id="item-product" maxlength="50" value="${escapeAttr(item.productName)}" placeholder="例：シーホネンス コア・ネオ"><small><span id="product-count">${item.productName.length}</span> / 50</small></label><label>カテゴリ（チラシに色付きで表示）<select id="equipment-category-select"><option value="">選択してください</option>${equipmentCategories.map(c=>`<option value="${escapeAttr(c)}" ${c===item.equipmentCategory?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></label><label>カテゴリを手入力・変更<input id="equipment-category-custom" maxlength="20" value="${escapeAttr(item.equipmentCategory)}" placeholder="候補にない場合はここへ"></label><div class="two-col"><label>メーカー<input id="item-maker" maxlength="30" value="${escapeAttr(item.maker)}" placeholder="例：パラマウント"></label><label>TAIS番号<input id="item-tais" maxlength="20" value="${escapeAttr(item.taisCode)}" placeholder="例：00167-000262"></label></div><label>品番（任意）<input id="item-code" maxlength="30" value="${escapeAttr(item.productCode)}"></label><label class="field-strong">単位数<div class="unit-input"><input id="item-units" type="number" min="0" value="${item.units}"><span>単位／月</span></div></label><div class="switch-row embedded"><span>「${escapeHtml(item.assistBarLabel||"介助バー無料")}」を表示</span><button class="switch ${item.assistBarFree?"on":""}" id="assist-bar-toggle" aria-label="特典表示の切替"></button></div><label>特典の文言<input id="assist-bar-label" maxlength="20" value="${escapeAttr(item.assistBarLabel||"介助バー無料")}" placeholder="例：介助バー無料"></label></div><div class="cost-box"><h3>利用者負担額（自動計算）</h3><label>月額（保険対象額）<div class="money-input"><input id="monthly-amount" type="number" min="0" step="10" value="${item.monthlyAmount}"><span>円</span></div></label><div class="cost-grid"><div><span>1割負担</span><strong id="cost1">${formatYen(burden.burden1)}</strong></div><div><span>2割負担</span><strong id="cost2">${formatYen(burden.burden2)}</strong></div><div><span>3割負担</span><strong <label>見出し（写真の上に出る短い文）<input id="item-title" maxlength="40" value="${escapeAttr(item.title)}"><small><span id="title-count">${item.title.length}</span> / 40</small></label>${this.sampleSelectHtml('item-title-sample','itemTitle','タイトル文言サンプル')}<label>説明文<textarea id="item-description" rows="3" maxlength="180">${escapeHtml(item.description)}</textarea><small><span id="desc-count">${item.description.length}</span> / 180</small></label>${this.sampleSelectHtml('item-description-sample','description','説明文サンプル')}id="cost3">${formatYen(burden.burden3)}</strong></div></div></div><div class="ai-actions"><button class="ai-btn" id="ai-polish">${icon('sparkles',17)} AIで文章を整える</button><button class="ai-btn secondary-ai" id="ai-memo">${icon('sparkles',17)} メモから説明文を作る</button></div><button class="delete-btn" id="clear-item">${icon('trash',15)} この項目を空にする</button>`;
  }
  private consumableEditorHtml(item:FlyerItem){
    const categoryKnown=CONSUMABLE_GROUP_NAMES.includes(item.consumableCategory);const typeOptions=getConsumableTypes(item.consumableCategory);const typeKnown=hasConsumableType(item.consumableCategory,item.consumableType);
    return `<div class="consumable-editor-note"><strong>消耗品の商品情報</strong><span>候補から選んだ後でも、入力欄で自由に変更できます。</span></div><label>大分類<select id="consumable-category-select"><option value="">選択してください</option>${CONSUMABLE_GROUPS.map(group=>`<option value="${escapeAttr(group.group)}" ${group.group===item.consumableCategory?'selected':''}>${escapeHtml(group.group)}</option>`).join('')}${item.consumableCategory&&!categoryKnown?`<option value="${escapeAttr(item.consumableCategory)}" selected>${escapeHtml(item.consumableCategory)}（自由入力）</option>`:''}</select></label><label>大分類を手入力・変更<input id="consumable-category-custom" maxlength="50" value="${escapeAttr(item.consumableCategory)}" placeholder="例：施設備品・衛生用品"></label><label>消耗品の種類<select id="consumable-type-select"><option value="">選択してください</option>${typeOptions.map(type=>`<option value="${escapeAttr(type)}" ${type===item.consumableType?'selected':''}>${escapeHtml(type)}</option>`).join('')}${item.consumableType&&!typeKnown?`<option value="${escapeAttr(item.consumableType)}" selected>${escapeHtml(item.consumableType)}（自由入力）</option>`:''}</select></label><label>種類を手入力・変更<input id="consumable-type-custom" maxlength="60" value="${escapeAttr(item.consumableType)}" placeholder="例：業務用ペーパータオル"></label><label>商品名<textarea id="item-product" rows="2" maxlength="80" placeholder="商品名を入力。改行位置も手動で調整できます。">${escapeHtml(item.productName)}</textarea><small><span id="product-count">${item.productName.length}</span> / 80　長い商品名は意味の切れ目を優先して自動調整します。</small></label><button class="btn secondary compact-btn" id="auto-wrap-product">商品名を見やすく自動改行</button><label>品番（任意）<input id="item-code" maxlength="30" value="${escapeAttr(item.productCode)}"></label><div class="two-fields"><label>規格・容量<input id="consumable-spec" maxlength="50" value="${escapeAttr(item.specification)}" placeholder="例：200mL / 45L"></label><label>入数・包装<input id="consumable-pack" maxlength="50" value="${escapeAttr(item.packSize)}" placeholder="例：30枚×10袋"></label></div><label>見出し・ひとこと<input id="item-title" maxlength="50" value="${escapeAttr(item.title)}"><small><span id="title-count">${item.title.length}</span> / 50</small></label><label>商品説明<textarea id="item-description" rows="4" maxlength="180">${escapeHtml(item.description)}</textarea><small><span id="desc-count">${item.description.length}</span> / 180</small></label>${this.sampleSelectHtml('item-description-sample','description','説明文サンプル')}<div class="cost-box consumable-price-editor"><h3>価格表示</h3><label>販売価格<div class="money-input"><input id="consumable-price" type="number" min="0" step="1" value="${item.priceYen}"><span>円</span></div></label><div class="switch-row embedded"><span>この商品の価格を表示</span><button class="switch ${item.showPrice?'on':''}" id="item-show-price" aria-pressed="${item.showPrice}"></button></div><small>左側の「価格を表示」がOFFの場合は、全商品の価格が非表示になります。</small></div><div class="ai-actions"><button class="ai-btn" id="ai-polish">${icon('sparkles',17)} AIで文章を整える</button><button class="ai-btn secondary-ai" id="ai-memo">${icon('sparkles',17)} メモから説明文を作る</button></div><button class="delete-btn" id="clear-item">${icon('trash',15)} この商品を空にする</button>`;
  }
  private photoEditorHtml(item:FlyerItem){const fitMode=item.transform.fitMode??'cover';return `<div class="current-photo"><div class="current-photo-stage"><div class="current-photo-bg"></div>${item.media?.previewUrl?`<img src="${escapeAttr(item.media.previewUrl)}" alt="選択中の写真" style="object-fit:${fitMode};object-position:${item.transform.x}% ${item.transform.y}%;transform:scale(${item.transform.scale/100}) rotate(${item.transform.rotation}deg)">`:`<div class="empty-photo-large">写真が未設定です</div>`}</div></div><div class="drop-zone" id="drop-zone"><strong>写真をここにドロップ</strong><span>縦長・横長どちらの写真にも対応しています</span><div class="drop-actions"><label class="btn secondary">${icon('upload',16)}写真を選択<input id="file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label><button class="btn secondary" id="library-btn">${icon('image',16)}ライブラリから</button></div></div><div class="photo-tools"><h3>写真の表示方法</h3><div class="photo-fit-choice"><button type="button" data-fit-mode="contain" class="${fitMode==='contain'?'selected':''}"><strong>写真全体を表示</strong><span>縦長写真におすすめ</span></button><button type="button" data-fit-mode="cover" class="${fitMode==='cover'?'selected':''}"><strong>枠いっぱいに表示</strong><span>余白なしで大きく表示</span></button></div><p class="photo-fit-help">写真が切れる場合は「写真全体を表示」を選んでください。必要なら下の拡大・位置調整で仕上げられます。</p><h3>写真の調整</h3><label>拡大・縮小 <output id="scale-output">${item.transform.scale}%</output><input id="scale-range" type="range" min="100" max="200" value="${item.transform.scale}"></label><label>左右位置 <output id="x-output">${item.transform.x}%</output><input id="x-range" type="range" min="0" max="100" value="${item.transform.x}"></label><label>上下位置 <output id="y-output">${item.transform.y}%</output><input id="y-range" type="range" min="0" max="100" value="${item.transform.y}"></label><label>回転 <output id="rotate-output">${item.transform.rotation}°</output><input id="rotate-range" type="range" min="-15" max="15" value="${item.transform.rotation}"></label><div class="photo-tool-row"><button class="btn secondary" id="center-photo">中央に戻す</button><button class="btn danger-outline" id="remove-photo">写真を外す</button></div></div>`;}

  private bindRightEvents(){const host=this.root.querySelector<HTMLElement>('#right-editor');if(!host)return;host.querySelector<HTMLSelectElement>('#item-select')?.addEventListener('change',(e)=>{this.selectedIndex=Number((e.target as HTMLSelectElement).value);this.renderPaperOnly();this.renderRightEditor();});host.querySelector('#prev-item')?.addEventListener('click',()=>this.selectRelative(-1));host.querySelector('#next-item')?.addEventListener('click',()=>this.selectRelative(1));host.querySelectorAll<HTMLButtonElement>('[data-editor-tab]').forEach(btn=>btn.addEventListener('click',()=>{host.querySelectorAll('[data-editor-tab]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');host.querySelector('#basic-editor')?.classList.toggle('hidden',btn.dataset.editorTab!=='basic');host.querySelector('#photo-editor')?.classList.toggle('hidden',btn.dataset.editorTab!=='photo');}));
    const bindText=(id:string,key:keyof Pick<FlyerItem,'title'|'description'|'productName'|'productCode'|'maker'|'taisCode'|'equipmentCategory'|'assistBarLabel'>,countId?:string)=>{host.querySelector<HTMLInputElement|HTMLTextAreaElement>(`#${id}`)?.addEventListener('input',(e)=>{this.inputCommit(`item-${this.selectedIndex}-${key}`,()=>{const it=this.currentItem();if(it)(it[key] as string)=(e.target as HTMLInputElement|HTMLTextAreaElement).value;});if(countId){const c=host.querySelector<HTMLElement>(`#${countId}`);if(c)c.textContent=String((e.target as HTMLInputElement|HTMLTextAreaElement).value.length);}});};bindText('item-title','title','title-count');bindText('item-description','description','desc-count');bindText('item-product','productName','product-count');bindText('item-code','productCode');
    host.querySelector<HTMLSelectElement>('#item-title-sample')?.addEventListener('change',(e)=>{const select=e.target as HTMLSelectElement;if(!select.value)return;const numbered=`${String(this.selectedIndex+1).padStart(2,'0')} ${select.value}`;const input=host.querySelector<HTMLInputElement>('#item-title');if(input)input.value=numbered;this.inputCommit(`item-${this.selectedIndex}-title-sample`,()=>{const it=this.currentItem();if(it)it.title=numbered;});this.renderRightEditor();});
    host.querySelector<HTMLSelectElement>('#item-description-sample')?.addEventListener('change',(e)=>{const select=e.target as HTMLSelectElement;if(!select.value)return;const input=host.querySelector<HTMLTextAreaElement>('#item-description');if(input)input.value=select.value;this.inputCommit(`item-${this.selectedIndex}-description-sample`,()=>{const it=this.currentItem();if(it)it.description=select.value;});this.renderRightEditor();});
    host.querySelector<HTMLInputElement>('#item-units')?.addEventListener('input',(e)=>this.inputCommit(`item-${this.selectedIndex}-units`,()=>{const it=this.currentItem();if(it)it.units=Math.max(0,Number((e.target as HTMLInputElement).value)||0);}));host.querySelector<HTMLInputElement>('#monthly-amount')?.addEventListener('input',(e)=>{this.inputCommit(`item-${this.selectedIndex}-monthly`,()=>{const it=this.currentItem();if(it)it.monthlyAmount=Math.max(0,Number((e.target as HTMLInputElement).value)||0);});const b=calculateBurdenAmounts(this.currentItem()?.monthlyAmount??0);const c1=host.querySelector('#cost1'),c2=host.querySelector('#cost2'),c3=host.querySelector('#cost3');if(c1)c1.textContent=formatYen(b.burden1);if(c2)c2.textContent=formatYen(b.burden2);if(c3)c3.textContent=formatYen(b.burden3);});
    bindText('item-maker','maker');bindText('item-tais','taisCode');
    bindText('assist-bar-label','assistBarLabel');
    host.querySelector('#assist-bar-toggle')?.addEventListener('click',()=>{const it=this.currentItem();if(!it)return;this.commit(()=>{it.assistBarFree=!it.assistBarFree;});this.renderRightEditor();});

    const applyEquipmentCategory=(value:string)=>{this.inputCommit(`item-${this.selectedIndex}-equipcat`,()=>{const it=this.currentItem();if(it)it.equipmentCategory=value;});
      const custom=host.querySelector<HTMLInputElement>('#equipment-category-custom');if(custom&&custom.value!==value)custom.value=value;
      const select=host.querySelector<HTMLSelectElement>('#equipment-category-select');if(select&&select.value!==value)select.value=equipmentCategories.includes(value)?value:'';};
    host.querySelector<HTMLSelectElement>('#equipment-category-select')?.addEventListener('change',(e)=>applyEquipmentCategory((e.target as HTMLSelectElement).value));
    host.querySelector<HTMLInputElement>('#equipment-category-custom')?.addEventListener('input',(e)=>applyEquipmentCategory((e.target as HTMLInputElement).value));
    this.bindConsumableEvents(host);
    host.querySelector('#ai-polish')?.addEventListener('click',()=>void this.aiPolish());host.querySelector('#ai-memo')?.addEventListener('click',()=>void this.aiFromMemo());host.querySelector('#clear-item')?.addEventListener('click',()=>void this.clearItem());
    host.querySelector<HTMLInputElement>('#file-input')?.addEventListener('change',(e)=>void this.handleFiles((e.target as HTMLInputElement).files));const drop=host.querySelector<HTMLElement>('#drop-zone');drop?.addEventListener('dragover',(e)=>{e.preventDefault();drop.classList.add('dragover');});drop?.addEventListener('dragleave',()=>drop.classList.remove('dragover'));drop?.addEventListener('drop',(e)=>{e.preventDefault();drop.classList.remove('dragover');void this.handleFiles(e.dataTransfer?.files??null);});host.querySelector('#library-btn')?.addEventListener('click',()=>void this.pickFromLibrary());
    host.querySelectorAll<HTMLButtonElement>('[data-fit-mode]').forEach(btn=>btn.addEventListener('click',()=>{const fitMode=btn.dataset.fitMode==='contain'?'contain':'cover';this.commit(()=>{const it=this.currentItem();if(it){it.transform.fitMode=fitMode;it.transform.scale=100;it.transform.x=50;it.transform.y=50;}});this.renderRightEditor();}));
    const bindRange=(id:string,key:'scale'|'x'|'y'|'rotation',out:string)=>host.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener('input',(e)=>{const value=Number((e.target as HTMLInputElement).value);this.inputCommit(`transform-${this.selectedIndex}-${key}`,()=>{const it=this.currentItem();if(it)it.transform[key]=value;});const o=host.querySelector<HTMLOutputElement>(`#${out}`);if(o)o.value=`${value}${key==='rotation'?'°':'%'}`;});bindRange('scale-range','scale','scale-output');bindRange('x-range','x','x-output');bindRange('y-range','y','y-output');bindRange('rotate-range','rotation','rotate-output');host.querySelector('#center-photo')?.addEventListener('click',()=>{this.commit(()=>{const it=this.currentItem();if(it)it.transform={scale:100,x:50,y:50,rotation:0,fitMode:it.transform.fitMode??'cover'};});this.renderRightEditor();});host.querySelector('#remove-photo')?.addEventListener('click',()=>{this.commit(()=>{const it=this.currentItem();if(it)it.media=null;});this.renderRightEditor();});
  }

  private bindConsumableEvents(host:HTMLElement){
    if(this.record.editorState.mode!=='consumables')return;
    const categorySelect=host.querySelector<HTMLSelectElement>('#consumable-category-select');const categoryCustom=host.querySelector<HTMLInputElement>('#consumable-category-custom');
    categorySelect?.addEventListener('change',()=>{const value=categorySelect.value;this.commit(()=>{const it=this.currentItem();if(it){it.consumableCategory=value;if(value&&!getConsumableTypes(value).includes(it.consumableType))it.consumableType='';}});this.renderRightEditor();});
    categoryCustom?.addEventListener('input',()=>this.inputCommit(`consumable-category-${this.selectedIndex}`,()=>{const it=this.currentItem();if(it)it.consumableCategory=categoryCustom.value;}));
    categoryCustom?.addEventListener('blur',()=>this.renderRightEditor());
    const typeSelect=host.querySelector<HTMLSelectElement>('#consumable-type-select');const typeCustom=host.querySelector<HTMLInputElement>('#consumable-type-custom');
    typeSelect?.addEventListener('change',()=>{const value=typeSelect.value;this.commit(()=>{const it=this.currentItem();if(it)it.consumableType=value;});this.renderRightEditor();});
    typeCustom?.addEventListener('input',()=>this.inputCommit(`consumable-type-${this.selectedIndex}`,()=>{const it=this.currentItem();if(it)it.consumableType=typeCustom.value;}));
    typeCustom?.addEventListener('blur',()=>this.renderRightEditor());
    const spec=host.querySelector<HTMLInputElement>('#consumable-spec');spec?.addEventListener('input',()=>this.inputCommit(`consumable-spec-${this.selectedIndex}`,()=>{const it=this.currentItem();if(it)it.specification=spec.value;}));
    const pack=host.querySelector<HTMLInputElement>('#consumable-pack');pack?.addEventListener('input',()=>this.inputCommit(`consumable-pack-${this.selectedIndex}`,()=>{const it=this.currentItem();if(it)it.packSize=pack.value;}));
    const price=host.querySelector<HTMLInputElement>('#consumable-price');price?.addEventListener('input',()=>this.inputCommit(`consumable-price-${this.selectedIndex}`,()=>{const it=this.currentItem();if(it)it.priceYen=Math.max(0,Number(price.value)||0);}));
    host.querySelector<HTMLButtonElement>('#item-show-price')?.addEventListener('click',(e)=>{const button=e.currentTarget as HTMLButtonElement;this.commit(()=>{const it=this.currentItem();if(it)it.showPrice=!it.showPrice;});button.classList.toggle('on',this.currentItem()?.showPrice??false);button.setAttribute('aria-pressed',String(this.currentItem()?.showPrice??false));});
    host.querySelector<HTMLButtonElement>('#auto-wrap-product')?.addEventListener('click',()=>this.autoWrapProductName(true));
    host.querySelector<HTMLTextAreaElement>('#item-product')?.addEventListener('blur',()=>this.autoWrapProductName(false));
  }
  private autoWrapProductName(showMessage:boolean){const item=this.currentItem();if(!item||this.record.editorState.mode!=='consumables'||item.productName.includes('\n'))return;const layout=layoutProductName(item.productName,this.record.layoutCount>=6?20:this.record.layoutCount>=3?28:36);if(layout.autoWrapped&&layout.lines.length>1){this.commit(()=>{const current=this.currentItem();if(current)current.productName=layout.lines.join('\n');});this.renderRightEditor();if(showMessage)showToast('見やすい位置で商品名を改行しました','success');}else if(showMessage)showToast('自動改行が必要な長さ・区切りではありません');}
  private switchMode(mode:FlyerMode){if(mode===this.record.editorState.mode)return;this.pushHistory();this.record.editorState.mode=mode;const preferred=mode==='rental'?['rental']:mode==='consumables'?['consumables']:['cases','casebook'];const category=this.deps.context.categories.find(c=>preferred.includes(c.slug));if(category)this.record.categoryId=category.id;if(mode==='consumables'){this.record.editorState.display.showUnits=false;this.record.editorState.display.showBurden1=false;this.record.editorState.display.showBurden2=false;this.record.editorState.display.showBurden3=false;this.record.editorState.display.showPrices=true;}else{this.record.editorState.display.showUnits=true;if(!this.record.editorState.display.showBurden1&&!this.record.editorState.display.showBurden2&&!this.record.editorState.display.showBurden3)this.record.editorState.display.showBurden1=true;}this.changed();this.build();showToast(mode==='consumables'?'消耗品モードに切り替えました':mode==='rental'?'レンタルモードに切り替えました':'事例集モードに切り替えました','success');}

  private currentItem(){return this.record.editorState.items[this.selectedIndex]??null;}
  private selectRelative(delta:number){const count=this.record.layoutCount;this.selectedIndex=(this.selectedIndex+delta+count)%count;this.renderPaperOnly();this.renderRightEditor();}
  private pushHistory(){this.history.push(structuredClone(this.record));if(this.history.length>40)this.history.shift();this.future=[];}
  private pushHistoryThrottled(){const now=Date.now();if(now-this.historyStamp>650){this.pushHistory();this.historyStamp=now;}}
  private commit(mutator:()=>void,history=true){if(history)this.pushHistory();mutator();this.changed();this.renderPaperOnly();}
  private inputCommit(_key:string,mutator:()=>void){this.pushHistoryThrottled();mutator();this.changed();this.renderPaperOnly();}
  private changed(){this.record.layoutCount=this.record.editorState.layoutCount;this.record.orientation=this.record.editorState.orientation;this.record.designStyle=this.record.editorState.design.style;this.record.mainColor=this.record.editorState.design.color;this.changeCounter++;this.setSaveStatus(navigator.onLine?'saving':'offline');this.localSave();if(navigator.onLine)this.remoteSave();else this.showOfflineBanner();}
  private undo(){const previous=this.history.pop();if(!previous)return showToast('戻せる操作がありません');this.future.push(structuredClone(this.record));this.record=previous;this.selectedIndex=Math.min(this.selectedIndex,this.record.layoutCount-1);this.changeCounter++;this.build();this.localSave();this.remoteSave();}
  private redo(){const next=this.future.pop();if(!next)return showToast('やり直せる操作がありません');this.history.push(structuredClone(this.record));this.record=next;this.selectedIndex=Math.min(this.selectedIndex,this.record.layoutCount-1);this.changeCounter++;this.build();this.localSave();this.remoteSave();}

  private async persistLocalDraft(){try{await draftSet(this.draftKey(),{record:structuredClone(this.record),savedAt:new Date().toISOString()} satisfies DraftEnvelope);}catch{/* server save remains independent */}}
  private draftKey(){return `flyer:${this.deps.session.userId}:${this.record.id}`;}
  private async saveNow(manual=false){if(this.destroyed)return;if(!navigator.onLine){this.setSaveStatus('offline');await this.persistLocalDraft();if(manual)showToast('現在オフラインです。変更内容はこのPCに保存しました。');return;}const startCounter=this.changeCounter;const snapshot=structuredClone(this.record);this.setSaveStatus('saving');const result=await saveFlyer(this.deps.session,snapshot,snapshot.version);if(this.destroyed)return;if(result.conflict){this.setSaveStatus('conflict');await this.handleConflict(result.record);return;}if(!result.ok||!result.record){this.setSaveStatus('error');await this.persistLocalDraft();if(manual||result.errorMessage)showToast(result.errorMessage??'保存できませんでした。変更内容はこのPCに残っています。','error');return;}this.record.version=result.record.version;this.record.updatedAt=result.record.updatedAt;this.lastSavedCounter=startCounter;await this.persistLocalDraft();if(this.changeCounter===startCounter){this.setSaveStatus('saved');if(manual)showToast('保存しました','success');}else{this.setSaveStatus('saving');this.remoteSave();}}
  private async handleConflict(latest:FlyerRecord|null){const action=await showModal({title:'別のユーザーによる更新が見つかりました',bodyHtml:'<p>この事例集は別のユーザーによって先に更新されています。無条件には上書きしません。</p><p class="muted">最新状態を読み込むか、現在の内容を複製して残してください。</p>',actions:[{label:'最新状態を確認',value:'latest',kind:'secondary'},{label:'自分の内容を複製して残す',value:'duplicate',kind:'primary'}],dismissible:false});if(action==='duplicate'){const copy=await duplicateFlyer(this.deps.session,this.record,'（競合コピー）');navigate(`editor/${copy.id}`);return;}if(latest){this.record=await hydrateMedia(latest,this.deps.session);this.history=[];this.future=[];this.changeCounter=0;this.lastSavedCounter=0;this.setSaveStatus('saved');this.build();showToast('最新の内容を読み込みました','success');}}

  private setSaveStatus(status:SaveStatus){this.saveStatus=status;const el=this.root.querySelector<HTMLElement>('#top-save-status');if(!el)return;const map:Record<SaveStatus,string>={idle:'保存待ち',saving:'保存中…',saved:`${icon('check',14)} 保存しました`,offline:`${icon('wifiOff',14)} このPCに保存中`,error:`${icon('warning',14)} 保存できませんでした`,conflict:`${icon('warning',14)} 更新競合`};el.innerHTML=map[status];el.dataset.status=status;}
  private updateConnectivity(){if(navigator.onLine){this.showOfflineBanner(false);if(this.saveStatus==='offline')this.setSaveStatus(this.changeCounter===this.lastSavedCounter?'saved':'saving');}else{this.setSaveStatus('offline');this.showOfflineBanner(true);}}
  private showOfflineBanner(force?:boolean){const el=this.root.querySelector<HTMLElement>('#offline-banner');if(el)el.classList.toggle('hidden',force===undefined?navigator.onLine:!force);}

  private setZoom(value:number){this.zoom=value;const label=this.root.querySelector('#zoom-label');if(label)label.textContent=`${value}%`;this.applyZoom();}
  private applyZoom(){const paper=this.root.querySelector<HTMLElement>('#flyer-paper');const host=this.root.querySelector<HTMLElement>('#paper-host');if(!paper||!host)return;const base=this.zoomBase();const factor=this.zoom/base;paper.style.transform=`scale(${factor})`;host.style.height=`${paper.offsetHeight*factor}px`;host.style.width=`${paper.offsetWidth*factor}px`;}
  private scheduleFit(){this.fitZoom();window.setTimeout(()=>{if(!this.destroyed)this.fitZoom();},0);window.setTimeout(()=>{if(!this.destroyed)this.fitZoom();},150);}
  private zoomBase(){return this.record.orientation==='landscape'?107.5:76;}
  private fitZoom(){if(!this.autoFit)return this.applyZoom();const paper=this.root.querySelector<HTMLElement>('#flyer-paper');const wrap=this.root.querySelector<HTMLElement>('#paper-wrap');if(!paper||!wrap)return;const available=wrap.clientWidth-24;const width=paper.offsetWidth;if(available<=0||width<=0)return;const ideal=Math.floor(available/width*this.zoomBase());const next=Math.max(52,Math.min(100,ideal));if(next!==this.zoom)this.setZoom(next);else this.applyZoom();}
  private previewFullscreen(){const html=renderPaper(this.record,this.deps.context,this.selectedIndex,true);const overlay=document.createElement('div');overlay.className='preview-overlay';overlay.innerHTML=`<div class="preview-tools"><span>${icon('edit',16)} 文字はプレビュー上で直接編集できます</span><button class="preview-close">${icon('close',22)} 閉じる</button></div><div class="preview-paper-host">${html}</div>`;const host=overlay.querySelector<HTMLElement>('.preview-paper-host');this.bindPaperInteraction(host,false);overlay.querySelector('.preview-close')?.addEventListener('click',()=>{overlay.remove();this.renderPaperOnly();this.renderRightEditor();});document.body.append(overlay);}

  private async handleFiles(files:FileList|null){if(!files?.length)return;const list=Array.from(files).slice(0,this.record.layoutCount-this.selectedIndex);if(!list.length)return;showToast(`${list.length}枚の写真を追加しています…`);const start=this.selectedIndex;this.pushHistory();let added=0;let failed=false;for(let i=0;i<list.length;i++){const file=list[i];if(!file)continue;try{const consumables=this.record.editorState.mode==='consumables';const media=await uploadMedia(this.deps.session,file,{kind:consumables?'product':'case',shareScope:'private',category:consumables?'消耗品':'事例写真'});const item=this.record.editorState.items[start+i];if(item){item.media=mediaToFlyerRef(media);item.transform={scale:100,x:50,y:50,rotation:0,fitMode:'contain'};added++;}}catch(error){failed=true;showToast(error instanceof Error?error.message:'写真をアップロードできませんでした。','error');break;}}if(!added)return;this.changed();this.renderPaperOnly();this.renderRightEditor();if(!failed)showToast('写真を追加しました','success');}
  private async handlePaperDrop(e:DragEvent){e.preventDefault();const target=(e.target as Element).closest<HTMLElement>('[data-item-index]');const to=target?Number(target.dataset.itemIndex):this.selectedIndex;if(e.dataTransfer?.files?.length){this.selectedIndex=to;await this.handleFiles(e.dataTransfer.files);return;}const from=this.dragFrom??Number(e.dataTransfer?.getData('text/plain'));if(Number.isFinite(from)&&from!==to){this.pushHistory();const a=this.record.editorState.items[from],b=this.record.editorState.items[to];if(a&&b){this.record.editorState.items[from]=b;this.record.editorState.items[to]=a;this.record.editorState.items.forEach((item,index)=>item.number=index+1);this.selectedIndex=to;this.changed();this.renderPaperOnly();this.renderRightEditor();}}this.dragFrom=null;}
  private async pickFromLibrary(){const media=await openMediaPicker(this.deps.session,this.record.editorState.mode==='consumables'?'product':'case');if(!media)return;this.commit(()=>{const it=this.currentItem();if(it){it.media=mediaToFlyerRef(media);it.transform={scale:100,x:50,y:50,rotation:0,fitMode:'contain'};}});this.renderRightEditor();}

  private async aiPolish(){const item=this.currentItem();if(!item)return;if(!item.description.trim()&&!item.title.trim())return showToast('整える文章を入力してください。');await this.runAi('polish',item.description||item.title);}
  private async aiFromMemo(){const item=this.currentItem();if(!item)return;const memo=await promptText('メモから説明文を作る','事実として分かっていることだけを短く入力してください。例：玄関、段差あり、転倒防止、手すり設置','','AIに提案してもらう');if(memo===null)return;if(!memo)return showToast('メモを入力してください。');await this.runAi('from_memo',memo);}
  private async runAi(mode:'polish'|'from_memo',text:string){const item=this.currentItem();if(!item)return;showToast('AIが文章を作成しています…');try{const result=await requestAiSuggestion(this.deps.session,{mode,documentMode:this.record.editorState.mode,text,title:item.title});const action=await showModal({title:'AIからの提案',bodyHtml:`<div class="ai-suggestion"><p>${escapeHtml(result.suggestion)}</p><small>入力されていない事実は追加しない設定です。採用前に内容をご確認ください。</small></div>`,actions:[{label:'やり直す',value:'retry',kind:'secondary'},{label:'この文章を使う',value:'use',kind:'primary'}]});if(action==='use'){this.commit(()=>{const current=this.currentItem();if(current)current.description=result.suggestion;});this.renderRightEditor();}else if(action==='retry'){await this.runAi(mode,text);}}catch(error){showToast(error instanceof Error?error.message:'AI文章補助を利用できませんでした。','error');}}
  private async clearItem(){const ok=await showModal({title:'この項目を空にしますか？',bodyHtml:`<p>写真、タイトル、説明、${this.record.editorState.mode==='consumables'?'商品・価格情報':'料金情報'}を空にします。</p>`,actions:[{label:'キャンセル',value:'cancel',kind:'secondary'},{label:'空にする',value:'clear',kind:'danger'}]});if(ok!=='clear')return;this.commit(()=>{const old=this.currentItem();if(!old)return;this.record.editorState.items[this.selectedIndex]={id:old.id||createId(),number:this.selectedIndex+1,title:`${String(this.selectedIndex+1).padStart(2,'0')} ${this.record.editorState.mode==='consumables'?'商品':'未設定'}`,description:'',productName:'',productCode:'',equipmentCategory:'',maker:'',taisCode:'',assistBarFree:false,assistBarLabel:'介助バー無料',consumableCategory:'',consumableType:'',specification:'',packSize:'',priceYen:0,showPrice:true,units:0,monthlyAmount:0,media:null,transform:{scale:100,x:50,y:50,rotation:0,fitMode:'contain'}};});this.renderRightEditor();}

  private async saveAsTemplate(){const name=await promptText('テンプレートとして保存','テンプレート名を入力してください。',`${this.record.title} テンプレート`,'決定',false);if(!name)return;const scopeAction=await showModal({title:'テンプレートの共有範囲',bodyHtml:'<p>誰がこのテンプレートを利用できるか選んでください。</p>',actions:[{label:'自分だけ',value:'private',kind:'secondary'},{label:'同じ営業所',value:'office',kind:'secondary'},{label:'会社全体',value:'company',kind:'primary'}]});if(!scopeAction)return;try{await saveFlyerAsTemplate(this.deps.session,this.record,name,scopeAction as ShareScope);showToast('テンプレートを保存しました','success');}catch(error){showToast(error instanceof Error?error.message:'テンプレートを保存できませんでした。','error');}}

  private async checkBeforeOutput():Promise<boolean>{await Promise.all(this.record.editorState.items.slice(0,this.record.layoutCount).map(async(item)=>{if(item.media?.mediaId){try{item.media=await refreshMediaRef(this.deps.session,item.media);}catch{/* validation below reports unreadable image */}}}));const paper=this.root.querySelector<HTMLElement>('#flyer-paper');const issues=mergeDomOverflowIssues(validateEditorState(this.record.editorState),paper?findOverflowIndexes(paper):[],this.record.editorState.mode);const unavailable=await findUnavailableExportImages(this.record);for(const index of unavailable)issues.push({code:`image_load_${index}`,message:`写真${String(index+1).padStart(2,'0')}を読み込めませんでした。写真を選び直すか、通信状況を確認してください。`,itemIndex:index,severity:'error'});if(!issues.length)return true;const errors=issues.filter(i=>i.severity==='error');const body=`<div class="validation-list">${issues.map(i=>`<div class="validation-item ${i.severity}">${icon(i.severity==='error'?'warning':'help',16)}<span>${escapeHtml(i.message)}</span></div>`).join('')}</div>`;const actions=errors.length?[{label:'修正する',value:'fix',kind:'primary' as const}]:[{label:'修正する',value:'fix',kind:'secondary' as const},{label:'このまま出力',value:'continue',kind:'primary' as const}];const action=await showModal({title:errors.length?'出力前に修正が必要です':'出力前の確認',bodyHtml:body,actions});if(action==='fix'){const first=issues[0];if(first?.itemIndex!==null&&first?.itemIndex!==undefined){this.selectedIndex=first.itemIndex;this.renderPaperOnly();this.renderRightEditor();}return false;}return action==='continue';}
  private async export(kind:'pdf'|'png'|'jpeg'){if(!(await this.checkBeforeOutput()))return;showToast('高品質データを作成しています…');try{if(kind==='pdf')await exportPdf(this.record,this.deps.context);else if(kind==='png')await exportPng(this.record,this.deps.context);else await exportJpeg(this.record,this.deps.context);showToast(`${kind.toUpperCase()}を保存しました`,'success');}catch(error){showToast(error instanceof Error?error.message:'出力できませんでした。もう一度お試しください。','error');}}
  private async printAsPng(){if(!(await this.checkBeforeOutput()))return;try{showToast('高品質PNGを作成しています…');await printPng(this.record,this.deps.context);showToast('PNG印刷画面を開きました','success');}catch(error){showToast(error instanceof Error?error.message:'PNGを印刷できませんでした。','error');}}
  private async print(){if(!(await this.checkBeforeOutput()))return;const style=document.createElement('style');style.id='tss-print-page';style.textContent=`@page{size:A4 ${this.record.orientation==='landscape'?'landscape':'portrait'};margin:0}`;document.head.append(style);document.body.classList.add('print-editor');window.print();window.setTimeout(()=>{document.body.classList.remove('print-editor');style.remove();},500);}
}

function placeCaretAtEnd(element:HTMLElement){const selection=window.getSelection();if(!selection)return;const range=document.createRange();range.selectNodeContents(element);range.collapse(false);selection.removeAllRanges();selection.addRange(range);}

async function hydrateMedia(record:FlyerRecord,session:AuthSession):Promise<FlyerRecord>{const next=structuredClone(record);await Promise.all(next.editorState.items.map(async(item)=>{if(item.media?.mediaId){try{item.media=await refreshMediaRef(session,item.media);}catch{/* signed URL refresh is best effort */}}}));return next;}
