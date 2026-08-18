import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultEditorState, createDemoContext } from '../dist/services/demoData.js';
import { normalizeEditorState } from '../dist/utils/editorState.js';
import { renderPaper } from '../dist/features/editor/paper.js';
import { validateEditorState } from '../dist/utils/validation.js';
import { layoutProductName } from '../dist/utils/productName.js';
import { CONSUMABLE_GROUPS, getConsumableTypes } from '../dist/features/editor/consumableCatalog.js';

function recordFor(state){return {id:'x',organizationId:'org-tss',officeId:'office-yukuhashi',ownerId:'u',assigneeId:'user-kubo',title:state.title,categoryId:'cat-consumables',shareScope:'private',orientation:state.orientation,layoutCount:state.layoutCount,designStyle:state.design.style,mainColor:state.design.color,editorState:state,version:1,createdAt:'',updatedAt:'',deletedAt:null};}

test('consumables mode disables welfare-only unit and burden display',()=>{
  const state=createDefaultEditorState(6,'consumables');
  assert.equal(state.mode,'consumables');assert.equal(state.display.showUnits,false);assert.equal(state.display.showBurden1,false);assert.equal(state.display.showBurden2,false);assert.equal(state.display.showBurden3,false);assert.equal(state.display.showPrices,true);
});

test('consumables catalog has broad grouped options and remains data-driven',()=>{
  assert.ok(CONSUMABLE_GROUPS.length>=10);
  assert.ok(CONSUMABLE_GROUPS.reduce((n,g)=>n+g.types.length,0)>=100);
  assert.ok(getConsumableTypes('紙製品・衛生紙').some(v=>v.includes('トイレットペーパー')));
  assert.ok(getConsumableTypes('手袋・感染対策').some(v=>v.includes('プラスチック手袋')));
});

test('consumables A4 renders category, product, specification, pack and yen price without units',()=>{
  const state=createDefaultEditorState(1,'consumables');const item=state.items[0];
  item.consumableCategory='紙製品・衛生紙';item.consumableType='ペーパータオル（中判）';item.productName='業務用 ペーパータオル 中判 200枚';item.specification='220×230mm';item.packSize='200枚×30袋';item.priceYen=1980;item.showPrice=true;item.description='施設向けの商品です。';
  const html=renderPaper(recordFor(state),createDemoContext(),0,false);
  assert.match(html,/紙製品・衛生紙/);assert.match(html,/ペーパータオル/);assert.match(html,/220×230mm/);assert.match(html,/200枚×30袋/);assert.match(html,/1,980/);assert.doesNotMatch(html,/単位／月/);assert.doesNotMatch(html,/1割負担/);
});

test('global and per-item price switches both hide consumable price',()=>{
  const state=createDefaultEditorState(1,'consumables');const item=state.items[0];item.productName='商品';item.priceYen=1234;
  state.display.showPrices=false;assert.doesNotMatch(renderPaper(recordFor(state),createDemoContext(),0,false),/1,234/);
  state.display.showPrices=true;item.showPrice=false;assert.doesNotMatch(renderPaper(recordFor(state),createDemoContext(),0,false),/1,234/);
});

test('long product names prefer meaningful split and avoid splitting inside parentheses',()=>{
  const layout=layoutProductName('業務用 ペーパータオル（中判サイズ） 200枚×30袋 ケース販売',18);
  assert.equal(layout.lines.length,2);assert.equal(layout.autoWrapped,true);
  const first=layout.lines[0],second=layout.lines[1];assert.ok(!first.endsWith('（'));assert.ok(!second.startsWith('）'));
});

test('manual product-name line break is preserved instead of being reflowed',()=>{
  const layout=layoutProductName('業務用ペーパータオル\n中判 200枚×30袋',12);
  assert.deepEqual(layout.lines,['業務用ペーパータオル','中判 200枚×30袋']);assert.equal(layout.autoWrapped,false);
});

test('consumables validation requires a product name but missing photo is only warning',()=>{
  const state=createDefaultEditorState(1,'consumables');const issues=validateEditorState(state);
  assert.ok(issues.some(i=>i.code==='product_required_0'&&i.severity==='error'));
  assert.ok(issues.some(i=>i.code==='photo_0'&&i.severity==='warning'));
});

test('older editor state normalizes safely to cases mode and gets consumable defaults',()=>{
  const state=createDefaultEditorState(1,'cases');delete state.mode;delete state.display.showPrices;delete state.items[0].consumableCategory;delete state.items[0].priceYen;delete state.items[0].showPrice;
  const normalized=normalizeEditorState(state);assert.equal(normalized.mode,'cases');assert.equal(normalized.display.showPrices,true);assert.equal(normalized.items[0].consumableCategory,'');assert.equal(normalized.items[0].priceYen,0);assert.equal(normalized.items[0].showPrice,true);
});

// Extra regression coverage added after consumables-mode integration.
test('automatic product-name wrapping preserves visible punctuation separators',()=>{
  const layout=layoutProductName('業務用ペーパータオル／中判サイズ 200枚×30袋',16);
  assert.match(layout.lines.join('\n'),/／/);
});

test('every supported consumables layout renders without welfare pricing labels',()=>{
  for (const count of [1,2,3,4,6,9]) {
    const state=createDefaultEditorState(count,'consumables');
    state.items.forEach((item,index)=>{item.productName=`商品${index+1}`;item.priceYen=1000+index;});
    const html=renderPaper(recordFor(state),createDemoContext(),0,false);
    assert.doesNotMatch(html,/単位／月/,`layout ${count}`);
    assert.doesNotMatch(html,/[123]割負担/,`layout ${count}`);
    assert.match(html,/円/,`layout ${count}`);
  }
});

test('shared consumables presentation keeps preview and export rules aligned', async()=>{
  const { getConsumablePresentation } = await import('../dist/features/editor/consumablePresentation.js');
  const state=createDefaultEditorState(4,'consumables');
  const item=state.items[0];
  item.consumableCategory='清掃・洗剤';
  item.consumableType='塩素系漂白剤';
  item.productName='業務用 塩素系漂白剤／厨房・施設向け 5kg';
  item.specification='5kg';
  item.packSize='3本／ケース';
  item.priceYen=2480;
  item.showPrice=true;
  const presentation=getConsumablePresentation(item,4,true);
  assert.equal(presentation.categoryLabel,'清掃・洗剤 › 塩素系漂白剤');
  assert.equal(presentation.specificationLabel,'5kg ／ 3本／ケース');
  assert.equal(presentation.priceLabel,'2,480円');
  assert.equal(presentation.showPrice,true);
  assert.ok(presentation.productLayout.lines.length<=2);
});

test('shared consumables presentation suppresses price when either switch is off', async()=>{
  const { getConsumablePresentation } = await import('../dist/features/editor/consumablePresentation.js');
  const state=createDefaultEditorState(1,'consumables');const item=state.items[0];item.productName='商品';item.priceYen=900;item.showPrice=false;
  assert.equal(getConsumablePresentation(item,1,true).showPrice,false);
  item.showPrice=true;
  assert.equal(getConsumablePresentation(item,1,false).showPrice,false);
});
