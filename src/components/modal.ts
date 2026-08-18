import { icon } from './icons.js';
import { escapeAttr, escapeHtml } from '../utils/html.js';

export interface ModalOptions { title: string; bodyHtml: string; actions?: Array<{ label:string; value:string; kind?:'primary'|'secondary'|'danger' }>; wide?: boolean; dismissible?: boolean; }

export function showModal(options: ModalOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay=document.createElement('div'); overlay.className='modal-overlay';
    overlay.innerHTML=`<section class="modal ${options.wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${escapeAttr(options.title)}"><header><h2>${escapeHtml(options.title)}</h2>${options.dismissible===false?'':`<button class="icon-btn modal-close" aria-label="閉じる">${icon('close')}</button>`}</header><div class="modal-body">${options.bodyHtml}</div>${options.actions?.length?`<footer>${options.actions.map(a=>`<button class="btn ${a.kind??'secondary'}" data-modal-value="${escapeAttr(a.value)}">${escapeHtml(a.label)}</button>`).join('')}</footer>`:''}</section>`;
    const close=(value:string|null)=>{overlay.remove();resolve(value);};
    overlay.querySelector('.modal-close')?.addEventListener('click',()=>close(null));
    overlay.addEventListener('click',(e)=>{if(e.target===overlay&&options.dismissible!==false)close(null);});
    overlay.querySelectorAll<HTMLElement>('[data-modal-value]').forEach((button)=>button.addEventListener('click',()=>close(button.dataset.modalValue??null)));
    document.body.append(overlay);
    (overlay.querySelector('input,textarea,button') as HTMLElement|null)?.focus();
  });
}

export function promptText(title:string,label:string,initial='',submitLabel='決定',multiline=true):Promise<string|null>{
  return new Promise((resolve)=>{const overlay=document.createElement('div');overlay.className='modal-overlay';overlay.innerHTML=`<section class="modal" role="dialog" aria-modal="true"><header><h2>${escapeHtml(title)}</h2><button class="icon-btn close">${icon('close')}</button></header><div class="modal-body"><label class="modal-field">${escapeHtml(label)}${multiline?`<textarea id="modal-prompt-text" rows="5"></textarea>`:`<input type="text" id="modal-prompt-text" maxlength="60">`}</label></div><footer><button class="btn secondary cancel">キャンセル</button><button class="btn primary submit">${escapeHtml(submitLabel)}</button></footer></section>`;const area=overlay.querySelector<HTMLTextAreaElement|HTMLInputElement>('#modal-prompt-text');if(area)area.value=initial;const done=(v:string|null)=>{overlay.remove();resolve(v);};overlay.querySelector('.close')?.addEventListener('click',()=>done(null));overlay.querySelector('.cancel')?.addEventListener('click',()=>done(null));overlay.querySelector('.submit')?.addEventListener('click',()=>done(area?.value.trim()||''));if(!multiline)area?.addEventListener('keydown',(e)=>{if((e as KeyboardEvent).key==='Enter'){e.preventDefault();done(area.value.trim());}});document.body.append(overlay);area?.focus();});
}
