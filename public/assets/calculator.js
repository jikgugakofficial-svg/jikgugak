// 관세 계산기 화면
import { CATEGORIES, landedCost, judge, breakevenUsd, formatKrw as krw } from './calc.js';

const root = document.querySelector('[data-calc]');
const FX = Number(root.dataset.fx);
const RULE = { minSaveKrw: Number(root.dataset.minKrw), minSavePct: Number(root.dataset.minPct) };
const state = { origin: 'us', method: 'express', category: Object.keys(CATEGORIES)[0] };
const $ = (s) => root.querySelector(s);
const inputs = { price: $('#c-price'), ship: $('#c-ship'), dom: $('#c-dom') };

// 주소창에 값을 남겨 공유·새로고침해도 그대로 (예: ?price=119&dom=219000)
const qs = new URLSearchParams(location.search);
for (const k of ['origin', 'method', 'category']) if (qs.get(k)) state[k] = qs.get(k);
for (const k of ['price', 'ship', 'dom']) if (qs.get(k) != null) inputs[k].value = qs.get(k);
if (!CATEGORIES[state.category]) state.category = Object.keys(CATEGORIES)[0];
if (!['us', 'other'].includes(state.origin)) state.origin = 'us';
if (!['express', 'post'].includes(state.method)) state.method = 'express';

root.querySelectorAll('.seg').forEach((seg) => {
  const group = seg.dataset.group;
  seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    state[group] = b.dataset.val || b.dataset.cat;
    render();
  }));
});
Object.values(inputs).forEach((i) => i.addEventListener('input', render));

function setText(sel, t) { const el = root.querySelector(sel); if (el) el.textContent = t; }

function render() {
  root.querySelectorAll('.seg').forEach((seg) => {
    const v = state[seg.dataset.group];
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.val || b.dataset.cat) === v)));
  });
  const price = Number(inputs.price.value) || 0;
  const ship = Number(inputs.ship.value) || 0;
  const dom = Number(inputs.dom.value) || 0;
  const ctx = { origin: state.origin, method: state.method, category: state.category, fx: FX };
  const c = landedCost({ ...ctx, priceUsd: price, shipUsd: ship });
  const j = judge(dom, c.total, RULE);

  // 판정
  const hero = $('[data-out-verdict]');
  const V = { good: ['v-good', '직구각'], meh: ['v-meh', '애매'], bad: ['v-bad', '국내가 나음'], none: ['', '판정 대기'] }[j.verdict];
  hero.className = 'vhero ' + V[0];
  hero.querySelector('.vword').textContent = V[1];
  const pct = Math.round(Math.abs(j.pct) * 100);
  hero.querySelector('b').textContent =
    j.verdict === 'good' ? `국내보다 ${pct}% 싸요 · ₩${krw(j.diff)} 아껴요`
    : j.verdict === 'meh' ? `₩${krw(j.diff)} 싸지만 배송 기간·반품을 생각하면 애매해요`
    : j.verdict === 'bad' ? `국내가 ₩${krw(-j.diff)} 더 싸요`
    : '국내 최저가를 넣으면 판정해요';

  // 신호등
  const lights = root.querySelectorAll('[data-out-signal] i');
  lights.forEach((l) => (l.className = ''));
  const idx = { green: 0, yellow: 1, red: 2 }[c.signal];
  lights[idx].className = 'on-' + c.signal;
  const sig = root.querySelector('[data-out-signal] > span');
  sig.querySelector('b').textContent = c.signal === 'red' ? '면세 한도 초과' : c.signal === 'yellow' ? '면세 한도에 거의 다 찼어요' : '면세 한도 안이에요';
  sig.querySelector('small').textContent = c.dutyFree
    ? `한도 $${c.limit} 중 $${price.toFixed(2)} · 예상 세금 ₩0`
    : `한도 $${c.limit}을 넘어 배송비를 포함한 전체에 세금이 붙어요`;

  // 규칙 안내
  const note = $('[data-out-note]');
  let msg = '';
  if (state.origin === 'us' && !CATEGORIES[state.category].listClearance) msg = `${CATEGORIES[state.category].label}은 미국에서 보내도 $150 기준이에요. 다른 상품과 한 상자에 섞으면 상자 전체가 같은 기준을 받아요.`;
  else if (state.origin === 'us' && state.method === 'post') msg = '우편(EMS 등)으로 받으면 미국발이어도 $150 기준이에요.';
  note.hidden = !msg;
  note.textContent = msg;

  // 영수증
  setText('[data-r="goods"]', '₩' + krw(c.goodsKrw));
  setText('[data-r="ship"]', '₩' + krw(c.shipKrw));
  setText('[data-r="rate"]', `관세 ${Math.round(c.rate * 100)}%`);
  setText('[data-r="duty"]', '₩' + krw(c.duty));
  setText('[data-r="vat"]', '₩' + krw(c.vat));
  setText('[data-r="total"]', '₩' + krw(c.total));

  // 손익분기
  const beEl = $('[data-out-be]');
  if (dom > 0) {
    const be = breakevenUsd({ ...ctx, domesticKrw: dom, shipUsd: ship }, RULE);
    beEl.innerHTML = '';
    const small = document.createElement('small');
    small.textContent = '손익분기 가격';
    beEl.append(small);
    if (be == null) beEl.append('배송비 때문에 이 상품은 국내 구매가 나아요');
    else { const b = document.createElement('b'); b.textContent = `$${be} 이하`; beEl.append('상품가가 ', b, '면 직구각'); }
  } else beEl.textContent = '';

  const q = new URLSearchParams({ ...state, price: inputs.price.value, ship: inputs.ship.value, dom: inputs.dom.value });
  history.replaceState(null, '', '?' + q.toString());
}
render();
