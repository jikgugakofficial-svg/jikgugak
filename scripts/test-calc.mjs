// 계산 규칙 점검: npm test
import assert from 'node:assert/strict';
import { landedCost, judge, breakevenUsd, dutyFreeLimit, cartCost, cartTrim, cartByStore } from '../src/calc.js';

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

// 장바구니: 상품 하나면 단품 계산과 같아야 해요
const one = cartCost({ items: [{ price: 160, qty: 1, category: 'apparel' }], ship: 20, origin: 'other', method: 'express', fx });
assert.equal(one.total, jacket.total);
assert.equal(one.duty, jacket.duty);
// 합쳐서 한도를 넘으면 전체 과세, 영양제가 섞이면 미국발도 $150
const mix = cartCost({ items: [{ price: 90, qty: 1, category: 'it' }, { price: 30, qty: 2, category: 'supplement' }], ship: 0, origin: 'us', method: 'express', fx });
assert.equal(mix.limit, 150);
assert.equal(mix.mixedLimit, true);
assert.equal(mix.dutyFree, true); // 90 + 60 = 150 (한도 안)
const over = cartCost({ items: [{ price: 120, qty: 1, category: 'it' }, { price: 45, qty: 2, category: 'home' }], ship: 10, origin: 'us', method: 'express', fx });
assert.equal(over.limit, 200);
assert.equal(over.dutyFree, false); // 120 + 90 = 210
const trim = cartTrim({ items: [{ name: 'A', price: 120, qty: 1, category: 'it' }, { name: 'B', price: 45, qty: 2, category: 'home' }], ship: 10, origin: 'us', method: 'express', fx });
assert.equal(trim.name, 'B'); // B 1개(45달러)만 빼면 165달러로 면세
assert.equal(trim.after.dutyFree, true);
// 원화 결제(알리): 원화를 과세 환율로 달러로 바꿔 한도 판단, 결제액은 원화 그대로
const ali = cartCost({ items: [{ price: 120000, qty: 1, category: 'it', dom: 200000 }, { price: 90000, qty: 1, category: 'it', dom: 150000 }], currency: 'krw', ship: 0, origin: 'other', method: 'express', fx });
assert.equal(ali.dutyFree, false); // 210,000원 ≈ $157.9 > $150
assert.equal(ali.paid, 210000);
assert.equal(ali.vat, 21000); // IT 관세 0% → 부가세만
assert.equal(ali.verdict, 'good'); // 국내 350,000원 vs 231,000원
// 영양제 6병 넘으면 표시
assert.equal(cartCost({ items: [{ price: 10, qty: 7, category: 'supplement' }], origin: 'us', fx }).tooManyBottles, true);

// 쇼핑몰별 상자: 아마존 $180 + 알리 120,000원은 각자 한도 안이라 둘 다 면세(한 상자로 합치면 넘음)
const mixed = cartByStore({ items: [{ store: 'amazon', price: 180, qty: 1, category: 'it' }, { store: 'aliexpress', price: 120000, qty: 1, category: 'it' }], fx, payFx: fx });
assert.equal(mixed.boxes.length, 2);
assert.equal(mixed.taxed, 0);
assert.equal(mixed.duty + mixed.vat, 0);
// 아이허브는 40,000원 미만이면 배송비 6,000원 자동, 넘으면 0원
assert.equal(cartByStore({ items: [{ store: 'iherb', price: 15000, qty: 2, category: 'supplement' }], fx }).shipKrw, 6000);
assert.equal(cartByStore({ items: [{ store: 'iherb', price: 15000, qty: 3, category: 'supplement' }], fx }).shipKrw, 0);
