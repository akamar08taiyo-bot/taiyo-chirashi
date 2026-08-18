import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPngPrintDocument } from '../dist/utils/pngPrint.js';

test('PNG print document uses full A4 portrait dimensions with zero page margin',()=>{
  const html=buildPngPrintDocument('blob:test-image','portrait','テストチラシ');
  assert.match(html,/@page\{size:A4 portrait;margin:0\}/);
  assert.match(html,/width:210mm;height:297mm/);
  assert.match(html,/class="print-image" src="blob:test-image"/);
  assert.match(html,/object-fit:contain/);
});

test('PNG print document uses full A4 landscape dimensions',()=>{
  const html=buildPngPrintDocument('blob:test-image','landscape','横チラシ');
  assert.match(html,/@page\{size:A4 landscape;margin:0\}/);
  assert.match(html,/width:297mm;height:210mm/);
});
