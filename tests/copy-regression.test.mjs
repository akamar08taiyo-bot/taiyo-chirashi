import test from 'node:test';
import assert from 'node:assert/strict';
import { COPY_SAMPLES } from '../dist/features/editor/copySamples.js';

test('copy library remains broad and includes many consumables examples',()=>{
  assert.ok(COPY_SAMPLES.length>=200,`copy samples: ${COPY_SAMPLES.length}`);
  const consumables=COPY_SAMPLES.filter((sample)=>sample.group==='消耗品');
  assert.ok(consumables.length>=40,`consumables samples: ${consumables.length}`);
  assert.ok(consumables.some((sample)=>sample.field==='documentTitle'));
  assert.ok(consumables.some((sample)=>sample.field==='description'));
});
