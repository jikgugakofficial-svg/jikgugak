// 아마존 상품 페이지: 사용자가 본 아마존 가격을 넣으면 바로 판정
// (아마존 가격은 API 승인 전까지 사이트에 표시하지 않고, 사용자가 직접 입력한 값만 계산합니다)
import { landedCost, judge, formatKrw as krw } from './calc.js';

const FX = Number(document.querySelector('meta[name="jg-fx"]')?.content) || 1347.03;

document.querySelectorAll('[data-mini-calc]').forEach((form) => {
  const d = form.dataset;
  const input = form.querySelector('input');
  const out = form.querySelector('.mc-out');
  form.addEventListener('submit', (e) => e.preventDefault());
  input.addEventListener('input', () => {
    const price = Number(input.value);
    if (!price) { out.textContent = ''; return; }
    const c = landedCost({ priceUsd: price, shipUsd: Number(d.ship), origin: d.origin, method: d.method, category: d.category, fx: FX });
    const j = judge(Number(d.domestic), c.total);
    const label = { good: '직구각', meh: '애매', bad: '국내가 나음' }[j.verdict];
    const why = j.verdict === 'bad' ? `국내가 ₩${krw(-j.diff)} 더 싸요` : `₩${krw(j.diff)} 아껴요`;
    out.innerHTML = '';
    const b = document.createElement('b');
    b.className = { good: 'v-good-text', meh: 'v-meh-text', bad: 'v-bad-text' }[j.verdict];
    b.textContent = label;
    out.append(b, ` · 최종 체감가 ₩${krw(c.total)} (${c.dutyFree ? '면세' : '관부가세 ₩' + krw(c.duty + c.vat) + ' 포함'}) · ${why}`);
  });
});
