import type { AppContext, FlyerRecord } from '../../types.js';
import { escapeAttr, escapeHtml } from '../../utils/html.js';
import { calculateBurdenAmounts, formatYen } from '../../utils/pricing.js';
import { getConsumablePresentation } from './consumablePresentation.js';

function editableAttrs(field:string,maxLength:number,interactive:boolean):string{
  return interactive ? ` contenteditable="plaintext-only" spellcheck="false" data-preview-field="${field}" data-preview-maxlength="${maxLength}" title="クリックして直接編集"` : '';
}

export function renderPaper(record: FlyerRecord, context: AppContext, selectedIndex = -1, interactive = true): string {
  const state=record.editorState; const office=context.offices.find((o)=>o.id===record.officeId)??context.offices[0]; const assignee=context.profiles.find((p)=>p.id===record.assigneeId);
  const contactName=state.contact?.personName||assignee?.flyerContactName||assignee?.displayName||'';
  const mobilePhone=state.contact?.mobilePhone||assignee?.mobilePhone||assignee?.phone||'';
  const items=state.items.slice(0,state.layoutCount);
  const showLogo=state.display.showLogo!==false;
  const mode=state.mode??'cases';
  return `<article class="paper a4-${state.orientation} style-${state.design.style} mode-${mode}${interactive?' paper-editable':''}" id="flyer-paper" style="--accent:${escapeAttr(state.design.color)}" data-orientation="${state.orientation}" data-flyer-mode="${mode}">
    <header class="flyer-head"><div class="flyer-title-area"><div class="eyeline"><strong${editableAttrs('eyebrow',24,interactive)}>${escapeHtml(state.eyebrow)}</strong><span${editableAttrs('eyebrow-note',60,interactive)}>${escapeHtml(state.eyebrowNote)}</span></div><h1${editableAttrs('document-title',80,interactive)}>${escapeHtml(state.title)}</h1><p${editableAttrs('document-subtitle',220,interactive)}>${escapeHtml(state.subtitle)}</p></div>
    <div class="company-block head-logo-only">${showLogo&&context.organization.logoUrl?`<img class="company-logo" src="${escapeAttr(context.organization.logoUrl)}" alt="会社ロゴ">`:''}</div></header>
    <div class="head-rule"></div>
    <div class="case-grid layout-${state.layoutCount}">${items.map((item,index)=>renderCard(record,index,selectedIndex,interactive)).join('')}</div>
    <footer class="flyer-footer"><div><strong${editableAttrs('footer-headline',100,interactive)}>${escapeHtml(state.footerHeadline)}</strong><small${editableAttrs('footer-note',220,interactive)}>${escapeHtml(state.footerNote)}</small></div><div class="footer-contact"><strong class="footer-company">${escapeHtml(context.organization.name)}　${escapeHtml(office?.name??'')}</strong>${office?.address?`<span class="footer-address">${escapeHtml(office.address)}</span>`:''}<span class="footer-tel">TEL:${escapeHtml(office?.phone??'')}　FAX:${escapeHtml(office?.fax??'')}</span>${contactName||mobilePhone?`<span class="footer-person">担当：${escapeHtml(contactName)}${mobilePhone?`　${escapeHtml(mobilePhone)}`:''}</span>`:''}</div></footer>
  </article>`;
}

function renderCard(record: FlyerRecord, index:number, selectedIndex:number, interactive:boolean):string {
  return record.editorState.mode==='consumables'?renderConsumableCard(record,index,selectedIndex,interactive):renderWelfareCard(record,index,selectedIndex,interactive);
}

function photoHtml(record:FlyerRecord,index:number):string{
  const item=record.editorState.items[index];if(!item)return'';const fitMode=item.transform.fitMode??'cover';
  return item.media?.previewUrl?`<img src="${escapeAttr(item.media.previewUrl)}" alt="" data-fit-mode="${fitMode}" style="object-fit:${fitMode};object-position:${item.transform.x}% ${item.transform.y}%;transform:scale(${item.transform.scale/100}) rotate(${item.transform.rotation}deg)">`:`<div class="photo-empty"><span>＋</span>写真を追加</div>`;
}

function renderWelfareCard(record: FlyerRecord,index:number,selectedIndex:number,interactive:boolean):string{
  const state=record.editorState; const item=state.items[index]; if(!item)return''; const burden=calculateBurdenAmounts(item.monthlyAmount);
  const burdens=[state.display.showBurden1?`<span>1割負担 <b>${formatYen(burden.burden1)}</b></span>`:'',state.display.showBurden2?`<span>2割負担 <b>${formatYen(burden.burden2)}</b></span>`:'',state.display.showBurden3?`<span>3割負担 <b>${formatYen(burden.burden3)}</b></span>`:''].join('');
  const descriptionClass=item.description.length>90?' tight':item.description.length>60?' compact':'';
  const product=item.productName?`<div class="case-product">商品：<span${editableAttrs('item-product',50,interactive)}>${escapeHtml(item.productName)}</span>${item.productCode?` <span>（<span${editableAttrs('item-code',30,interactive)}>${escapeHtml(item.productCode)}</span>）</span>`:''}</div>`:'';
  const badge=item.equipmentCategory?`<div class="equip-badge">${escapeHtml(item.equipmentCategory)}</div>`:'';
  const metaParts=[item.maker?escapeHtml(item.maker):'',item.taisCode?`TAIS ${escapeHtml(item.taisCode)}`:''].filter(Boolean);
  const meta=metaParts.length?`<div class="equip-meta">${metaParts.join('　')}</div>`:'';
  return `<article class="case-card${index===selectedIndex?' selected':''}" data-item-index="${index}" ${interactive?'draggable="true"':''}><div class="case-photo" data-preview-action="photo" title="写真をクリックして調整">${photoHtml(record,index)}</div><div class="case-copy">${badge}<div class="case-title"${editableAttrs('item-title',40,interactive)}>${escapeHtml(item.title)}</div><div class="case-desc${descriptionClass}"${editableAttrs('item-description',180,interactive)}>${escapeHtml(item.description)}</div>${product}${meta}${state.display.showUnits?`<div class="unit-line"><span>単位数</span><span><strong${editableAttrs('item-units',8,interactive)}>${Math.max(0,item.units).toLocaleString('ja-JP')}</strong> 単位／月</span></div>`:''}<div class="burden-line" data-preview-action="cost" title="料金は右側の基本情報で編集">${burdens}</div></div></article>`;
}

function renderConsumableCard(record: FlyerRecord,index:number,selectedIndex:number,interactive:boolean):string{
  const state=record.editorState;const item=state.items[index];if(!item)return'';
  const descriptionClass=item.description.length>95?' tight':item.description.length>65?' compact':'';
  const presentation=getConsumablePresentation(item,state.layoutCount,state.display.showPrices!==false);
  const productLines=presentation.productLayout.lines.map(escapeHtml).join('<br>');
  const category=escapeHtml(presentation.categoryLabel);
  const spec=escapeHtml(presentation.specificationLabel);
  return `<article class="case-card consumable-card${index===selectedIndex?' selected':''}" data-item-index="${index}" ${interactive?'draggable="true"':''}><div class="case-photo" data-preview-action="photo" title="写真をクリックして調整">${photoHtml(record,index)}</div><div class="case-copy consumable-copy">${category?`<div class="consumable-category">${category}</div>`:''}<div class="consumable-product-name ${presentation.productLayout.className}"${editableAttrs('item-product',80,interactive)}>${productLines}</div>${item.productCode?`<div class="consumable-code">品番：<span${editableAttrs('item-code',30,interactive)}>${escapeHtml(item.productCode)}</span></div>`:''}${spec?`<div class="consumable-spec">${spec}</div>`:''}<div class="case-title consumable-catch"${editableAttrs('item-title',50,interactive)}>${escapeHtml(item.title)}</div><div class="case-desc${descriptionClass}"${editableAttrs('item-description',180,interactive)}>${escapeHtml(item.description)}</div>${presentation.showPrice?`<div class="consumable-price" data-preview-action="cost"><strong>${escapeHtml(presentation.priceLabel.replace(/円$/,''))}</strong><span>円</span></div>`:''}</div></article>`;
}

export function findOverflowIndexes(paper: HTMLElement): number[] {
  const result:number[]=[];
  paper.querySelectorAll<HTMLElement>('.case-card').forEach((card)=>{
    const index=Number(card.dataset.itemIndex); const copy=card.querySelector<HTMLElement>('.case-copy'); const desc=card.querySelector<HTMLElement>('.case-desc');const product=card.querySelector<HTMLElement>('.consumable-product-name');
    if ((copy && copy.scrollHeight > copy.clientHeight + 2) || (desc && desc.scrollHeight > desc.clientHeight + 2) || (product && (product.scrollHeight>product.clientHeight+2 || product.scrollWidth>product.clientWidth+2))) result.push(index);
  });
  return result;
}
