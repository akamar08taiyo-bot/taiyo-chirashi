import test from 'node:test';
import assert from 'node:assert/strict';
import { demoOffices } from '../dist/services/demoData.js';
import { COPY_SAMPLES, getCopySamples } from '../dist/features/editor/copySamples.js';

test('all 19 Taiyo Silver Service sales offices are selectable in local mode',()=>{
  assert.equal(demoOffices.length,19);
  assert.equal(new Set(demoOffices.map(o=>o.name)).size,19);
  const yukuhashi=demoOffices.find(o=>o.name==='行橋営業所');
  assert.ok(yukuhashi);
  assert.equal(yukuhashi.address,'福岡県行橋市大字流末1327');
  assert.equal(yukuhashi.phone,'0930-26-9640');
  assert.equal(yukuhashi.fax,'0930-26-9641');
});

test('copy library contains many reusable flyer phrases while fields remain editable',()=>{
  assert.ok(COPY_SAMPLES.length>=170,`expected at least 170 samples, got ${COPY_SAMPLES.length}`);
  assert.ok(getCopySamples('documentTitle').length>=20);
  assert.ok(getCopySamples('description').length>=50);
  assert.ok(getCopySamples('itemTitle').length>=40);
  assert.ok(getCopySamples('footerNote').length>=10);
});

test('office master matches the 2026 official 19-office contact master',()=>{
  const expected = [
    ['小倉営業所','福岡県北九州市小倉北区重住3丁目11-21','093-952-1616','093-952-1627'],
    ['小倉南営業所','福岡県北九州市小倉南区田原新町1丁目3-34','093-474-5670','093-474-5671'],
    ['八幡西営業所','福岡県北九州市八幡西区本城東2丁目4-8','093-603-3512','093-601-3593'],
    ['八幡東営業所','福岡県北九州市八幡東区山路松尾町14-6','093-654-8515','093-654-8516'],
    ['行橋営業所','福岡県行橋市大字流末1327','0930-26-9640','0930-26-9641'],
    ['田川営業所','福岡県田川市川宮1200','0947-44-1895','0947-44-2372'],
    ['飯塚営業所','福岡県飯塚市枝国510番地7','0948-52-6360','0948-52-6362'],
    ['福岡南営業所','福岡県大野城市御笠川2丁目10-15','092-504-9810','092-504-9811'],
    ['福岡西営業所','福岡県福岡市早良区小田部4丁目11-31','092-833-0131','092-833-0132'],
    ['福岡東営業所','福岡県福岡市東区松田3丁目25-2','092-627-1150','092-627-1151'],
    ['久留米営業所','福岡県小郡市小郡97-19','0942-72-8822','0942-72-8833'],
    ['大牟田営業所','福岡県大牟田市大字歴木446-1','0944-59-1488','0944-59-1481'],
    ['佐賀営業所','佐賀県佐賀市鍋島5丁目4-15','0952-34-1224','0952-34-1225'],
    ['長崎営業所','長崎県長崎市界2-2-4','095-834-0535','095-834-0536'],
    ['大村営業所','長崎県大村市溝陸町643-1','0957-49-6222','0957-49-6333'],
    ['壱岐営業所','長崎県壱岐市郷ノ浦町田中触1078','0920-47-9005','0920-47-9006'],
    ['熊本営業所','熊本県熊本市東区画図町大字下無田1432-22','096-377-7630','096-377-7631'],
    ['熊本北営業所','熊本県熊本市北区鶴羽田1丁目10番7号','096-341-5765','096-341-5766'],
    ['大分営業所','大分県大分市下郡東1-4-35','097-504-8001','097-504-8002']
  ];
  const actual = demoOffices.map(o=>[o.name,o.address,o.phone,o.fax]);
  assert.deepEqual(actual, expected);
});
