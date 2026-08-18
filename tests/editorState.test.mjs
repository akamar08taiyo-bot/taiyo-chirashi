import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEditorStateForServer } from '../dist/utils/editorState.js';

function state() {
  return {
    title:'test',subtitle:'',layoutCount:1,orientation:'portrait',
    design:{style:'standard',color:'#71431f'},
    display:{showLogo:true,showUnits:true,showBurden1:true,showBurden2:false,showBurden3:false},
    items:[{id:'1',number:1,title:'写真01',description:'',productName:'',productCode:'',units:300,monthlyAmount:3000,transform:{scale:100,x:50,y:50,rotation:0},media:{mediaId:'media-1',previewUrl:'https://signed/preview',originalUrl:'https://signed/original',localBlobKey:'blob:key',fileName:'photo.jpg'}}]
  };
}

test('server persistence strips signed and local media references', () => {
  const input=state();
  const output=sanitizeEditorStateForServer(input);
  assert.equal(output.items[0].media.mediaId,'media-1');
  assert.equal(output.items[0].media.previewUrl,'');
  assert.equal(output.items[0].media.originalUrl,'');
  assert.equal(output.items[0].media.localBlobKey,null);
  assert.equal(input.items[0].media.previewUrl,'https://signed/preview');
});

test('consumables mode and product fields survive server sanitization', async () => {
  const { createDefaultEditorState } = await import('../dist/services/demoData.js');
  const input=createDefaultEditorState(1,'consumables');
  Object.assign(input.items[0],{consumableCategory:'紙製品・衛生紙',consumableType:'トイレットペーパー',productName:'業務用トイレットペーパー',productCode:'TP-01',specification:'ダブル 25m',packSize:'12ロール×8パック',priceYen:3980,showPrice:true});
  const output=sanitizeEditorStateForServer(input);
  assert.equal(output.mode,'consumables');
  assert.equal(output.items[0].consumableCategory,'紙製品・衛生紙');
  assert.equal(output.items[0].consumableType,'トイレットペーパー');
  assert.equal(output.items[0].productName,'業務用トイレットペーパー');
  assert.equal(output.items[0].specification,'ダブル 25m');
  assert.equal(output.items[0].packSize,'12ロール×8パック');
  assert.equal(output.items[0].priceYen,3980);
  assert.equal(output.items[0].showPrice,true);
  assert.equal(output.display.showUnits,false);
  assert.equal(output.display.showBurden1,false);
});
