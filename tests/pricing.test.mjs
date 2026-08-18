import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBurdenAmounts, roundBurdenAmount } from '../dist/utils/pricing.js';

test('monthly 3000 yen produces 1/2/3 burden amounts',()=>{
  assert.deepEqual(calculateBurdenAmounts(3000),{burden1:300,burden2:600,burden3:900});
});
test('negative and invalid amounts never produce negative charges',()=>{
  assert.deepEqual(calculateBurdenAmounts(-1),{burden1:0,burden2:0,burden3:0});
  assert.equal(roundBurdenAmount(-10),0);
});
test('rounding rule is centralized and rounds to nearest yen',()=>{
  assert.equal(roundBurdenAmount(100.49),100);
  assert.equal(roundBurdenAmount(100.5),101);
});
