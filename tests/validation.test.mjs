import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEditorState, mergeDomOverflowIssues } from '../dist/utils/validation.js';

function state(){return{title:'テスト',subtitle:'',eyebrow:'',eyebrowNote:'',footerHeadline:'',footerNote:'',layoutCount:1,orientation:'portrait',display:{showLogo:true,showUnits:true,showBurden1:true,showBurden2:false,showBurden3:false},design:{style:'standard',color:'#71431f'},items:[{id:'1',number:1,title:'短いタイトル',description:'説明',productName:'',productCode:'',units:0,monthlyAmount:0,media:null,transform:{scale:100,x:50,y:50,rotation:0}}]};}
test('missing photo is a warning, not a hard output error',()=>{
  const issues=validateEditorState(state());assert.equal(issues.length,1);assert.equal(issues[0].severity,'warning');
});
test('missing flyer title is a hard error',()=>{
  const s=state();s.title='';assert.ok(validateEditorState(s).some(i=>i.code==='title_required'&&i.severity==='error'));
});
test('overflow reports the concrete photo number',()=>{
  const issues=mergeDomOverflowIssues([], [0]);assert.match(issues[0].message,/写真01/);assert.equal(issues[0].severity,'error');
});

test('consumables overflow identifies the concrete product number',()=>{
  const issues=mergeDomOverflowIssues([], [2], 'consumables');
  assert.match(issues[0].message,/商品03/);assert.equal(issues[0].severity,'error');
});
