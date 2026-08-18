import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPaper } from '../dist/features/editor/paper.js';
import { normalizeEditorState } from '../dist/utils/editorState.js';

const context={
  organization:{id:'org',name:'太陽シルバーサービス',logoPath:'logo.png',logoUrl:'blob:logo',phone:'',fax:'',address:''},
  offices:[{id:'office',organizationId:'org',name:'行橋営業所',address:'福岡県行橋市大字流末1327',phone:'0930-26-9640',fax:'0930-26-9641',isActive:true},{id:'office-kurume',organizationId:'org',name:'久留米営業所',address:'福岡県小郡市小郡97-19',phone:'0942-72-8822',fax:'0942-72-8833',isActive:true}],
  profiles:[{id:'user',organizationId:'org',officeId:'office',employeeId:'1001',displayName:'担当者',phone:'090',role:'employee',isActive:true}],
  categories:[]
};
function record(showLogo=true,fitMode='contain'){
  return {id:'f',organizationId:'org',officeId:'office',ownerId:'user',assigneeId:'user',title:'資料タイトル',categoryId:'c',shareScope:'private',orientation:'portrait',layoutCount:1,designStyle:'standard',mainColor:'#71431f',version:1,createdAt:'',updatedAt:'',deletedAt:null,
    editorState:{title:'資料タイトル',subtitle:'サブタイトル',eyebrow:'屋内編',eyebrowNote:'メモ',footerHeadline:'相談できます',footerNote:'注記',layoutCount:1,orientation:'portrait',display:{showLogo,showUnits:true,showBurden1:true,showBurden2:false,showBurden3:false},design:{style:'standard',color:'#71431f'},contact:{personName:'チラシ担当',mobilePhone:'090-1111-2222'},items:[{id:'i',number:1,title:'写真01',description:'説明文',productName:'手すり',productCode:'A-1',units:300,monthlyAmount:3000,media:{mediaId:'m',previewUrl:'photo.jpg',originalUrl:'photo.jpg',localBlobKey:null,fileName:'photo.jpg'},transform:{scale:100,x:50,y:50,rotation:0,fitMode}}]}
  };
}

test('logo visibility setting controls the A4 preview',()=>{
  assert.match(renderPaper(record(true),context),/class="company-logo"/);
  assert.doesNotMatch(renderPaper(record(false),context),/class="company-logo"/);
});

test('interactive A4 preview exposes direct-edit fields',()=>{
  const html=renderPaper(record(true),context,0,true);
  for(const field of ['document-title','document-subtitle','item-title','item-description','item-product','item-code','item-units','footer-headline','footer-note']){
    assert.match(html,new RegExp(`data-preview-field="${field}"`));
  }
  assert.match(html,/contenteditable="plaintext-only"/);
  assert.match(html,/data-preview-action="photo"/);
});

test('non-interactive A4 output contains no edit controls',()=>{
  const html=renderPaper(record(true),context,-1,false);
  assert.doesNotMatch(html,/contenteditable=/);
  assert.doesNotMatch(html,/data-preview-field=/);
});

test('photo fit mode is retained per photo in the A4 preview',()=>{
  assert.match(renderPaper(record(true,'contain'),context),/object-fit:contain/);
  assert.match(renderPaper(record(true,'cover'),context),/object-fit:cover/);
});

test('older saved state defaults logo display to on',()=>{
  const old=record(true).editorState;
  delete old.display.showLogo;
  const normalized=normalizeEditorState(old);
  assert.equal(normalized.display.showLogo,true);
});

test('remembered flyer contact is rendered independently from account assignee',()=>{
  const html=renderPaper(record(true),context,-1,false);
  // 会社情報はA4下部のフッターへ移動。担当と携帯の区切りは全角スペース。
  assert.match(html,/担当：チラシ担当[s　]090-1111-2222/);
  assert.match(html,/footer-contact/);
  assert.doesNotMatch(html,/担当：担当者 090/);
  assert.match(html,/福岡県行橋市大字流末1327/);
});

test('older saved state gets empty remembered-contact fields for compatibility',()=>{
  const old=record(true).editorState;
  delete old.contact;
  const normalized=normalizeEditorState(old);
  assert.deepEqual(normalized.contact,{personName:'',mobilePhone:''});
});


test('changing flyer office changes office name, address, TEL and FAX in the rendered A4',()=>{
  const r=record(true);
  r.officeId='office-kurume';
  const html=renderPaper(r,context,-1,false);
  assert.match(html,/久留米営業所/);
  assert.match(html,/福岡県小郡市小郡97-19/);
  assert.match(html,/TEL:0942-72-8822/);
  assert.match(html,/FAX:0942-72-8833/);
  assert.doesNotMatch(html,/0930-26-9640/);
});
