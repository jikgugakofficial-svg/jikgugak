// 계산 규칙 점검: npm test
import assert from 'node:assert/strict';
import { landedCost, judge, breakevenUsd, dutyFreeLimit } from '../src/calc.js';

const fx = 1347.03;

// 면세 한도
assert.equal(dutyFreeLimit({ origin: 'us', method: 'express', category: 'it' }), 200);
assert.equal(dutyFreeLimit({ origin: 'us', method: 'post', category: 'it' }), 150);
assert.equal(dutyFreeLimit({ origin: 'us', method: 'express', category: 'supplement' }), 150);
assert.equal(dutyFreeLimit({ origin: 'other', method: 'express', category: 'it' }), 150);

// 면세 안: 배송비만 더함 (원 미만 버림)
const vit = landedCost({ priceUsd: 22.4, shipUsd: 3.9, origin: 'us', method: 'express', category: 'supplement', fx });
assert.equal(vit.goodsKrw, 30173);
assert.equal(vit.shipKrw, 5253);
assert.equal(vit.total, 35426);
assert.equal(judge(54900, vit.total).verdict, 'good');

// 한도 초과: 배송비 포함 전체에 관세·부가세 (관세청 예시와 같은 값)
const jacket = landedCost({ priceUsd: 160, shipUsd: 20, origin: 'other', method: 'express', category: 'apparel', fx });
assert.equal(jacket.dutyFree, false);
assert.equal(jacket.goodsKrw + jacket.shipKrw, 242465);
assert.equal(jacket.duty, 31520);
assert.equal(jacket.vat, 27398);

// 판정 규칙
assert.equal(judge(12900, 4027).verdict, 'meh');
assert.equal(judge(24900, 26671).verdict, 'bad');
assert.equal(judge(0, 1000).verdict, 'none');

// 손익분기
assert.equal(breakevenUsd({ domesticKrw: 219000, shipUsd: 10, origin: 'us', method: 'express', category: 'it', fx }), 120);
assert.equal(breakevenUsd({ domesticKrw: 89000, shipUsd: 10, origin: 'us', method: 'express', category: 'home', fx }), 42);
assert.equal(breakevenUsd({ domesticKrw: 21000, shipUsd: 10, origin: 'us', method: 'express', category: 'book', fx }), null);

// 결제 환율이 다르면: 결제액은 결제 환율, 세금은 과세 환율
const two = landedCost({ priceUsd: 160, shipUsd: 20, origin: 'other', method: 'express', category: 'apparel', fx, payFx: 1400 });
assert.equal(two.goodsKrw + two.shipKrw, 252000);
assert.equal(two.duty, 31520);
assert.equal(two.vat, 27398);
assert.equal(two.total, 252000 + 31520 + 27398);
// 결제 환율을 안 주면 예전과 같아요
assert.equal(landedCost({ priceUsd: 22.4, shipUsd: 3.9, origin: 'us', method: 'express', category: 'supplement', fx }).total, 35426);
// 손익분기도 결제 환율 반영 (면세 구간): 219000×0.8=175200 / 1400 − 10 = 115.1 → 115
assert.equal(breakevenUsd({ domesticKrw: 219000, shipUsd: 10, origin: 'us', method: 'express', category: 'it', fx, payFx: 1400 }), 115);

console.log('계산 규칙 점검 통과');
