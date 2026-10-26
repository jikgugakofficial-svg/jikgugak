// 세일 딜 모음: 품목 버튼을 누르면 /api/search(알리 제휴 API)로 인기 상품을 불러와 관부가세 포함 최종가를 보여 줘요.
import { landedCost, formatKrw as krw } from './calc.js';

const box = document.querySelector('[data-deals]');
const FX = Number(box.dataset.fx);
const list = box.querySelector('[data-deal-list]');
const status = box.querySelector('[data-deal-status]');
const chips = [...box.querySelectorAll('[data-deal-q]')];
const cache = new Map();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function guessCat(c = '') {
  const s = c.toLowerCase();
  if (/phone|computer|electronic|consumer|office|security/.test(s)) return 'it';
  if (/toy|hobb/.test(s)) return 'toy';
  if (/cloth|apparel|shoe|bag|jewel|watch|wig/.test(s)) return 'apparel';
  return 'home';
}
function shortQuery(t) {
  const words = t.split(/[\s,()/]+/).filter(Boolean);
  const spec = /^\d+(\.\d+)?(w|hz|k|gb|tb|mah|mm|cm|ml|l|in|ft|m|g|kg|v|a|pcs)$|\d+(hz|gbps|mbps)/i;
  const model = words.filter((w) => /[A-Za-z]/.test(w) && /\d/.test(w) && !spec.test(w) && !/rj45|usb|pd\d/i.test(w)).slice(0, 2);
  return (model.length ? [words[0], ...model] : words.slice(0, 4)).join(' ');
}

function row(it) {
  const c = landedCost({ priceUsd: it.price / FX, shipUsd: 0, origin: 'other', method: 'express', category: guessCat(it.category), fx: FX });
  const cif = Math.floor(it.price);
  const total = c.dutyFree ? cif : cif + Math.floor(cif * c.rate) + Math.floor((cif + Math.floor(cif * c.rate)) * 0.1);
  const off = it.original > it.price ? Math.round((1 - it.price / it.original) * 100) : 0;
  return `<li class="deal">
    ${it.image ? `<img class="deal-img" src="${esc(it.image)}" alt="" loading="lazy">` : ''}
    <div class="deal-body">
      <div class="deal-title">${esc(it.title)}</div>
      <div class="deal-meta">${off ? `<span class="pct-down">${off}%</span> ` : ''}판매가 ${krw(it.price)}원${it.orders ? ` · ${krw(it.orders)}개 판매` : ''}${it.rating ? ` · 평점 ${esc(it.rating)}` : ''}</div>
      <div class="deal-total">최종가 <b>${krw(total)}원</b> <small>${c.dutyFree ? '면세 한도 안 · 관부가세 0원' : `한도 초과 · 관부가세 ${krw(total - cif)}원 포함`}</small></div>
      <div class="deal-btns">
        <a class="btn btn-point small" href="/search?q=${encodeURIComponent(shortQuery(it.title))}">국내가 넣고 판정</a>
        <a class="btn btn-line small" href="${esc(it.link)}" target="_blank" rel="sponsored noopener">알리에서 보기</a>
      </div>
    </div>
  </li>`;
}

async function load(q) {
  status.textContent = '알리 실시간 가격을 불러오는 중…';
  list.innerHTML = '';
  try {
    let d = cache.get(q);
    if (!d) { d = await fetch('/api/search?q=' + encodeURIComponent(q)).then((r) => r.json()); cache.set(q, d); }
    if (!d.ok) { status.textContent = '지금은 실시간 가격을 불러올 수 없어요. 잠시 뒤 다시 눌러 주세요.'; return; }
    const top = (d.items || []).filter((it) => it.comparable !== false && !it.accessory).sort((a, b) => (b.orders || 0) - (a.orders || 0)).slice(0, 8);
    if (!top.length) { status.textContent = '이 품목은 지금 보여 드릴 상품이 없어요.'; return; }
    status.textContent = `"${q}" 인기 상품 ${top.length}개 · 판매량순`;
    list.innerHTML = top.map(row).join('');
  } catch {
    status.textContent = '불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.';
  }
}
chips.forEach((b) => b.addEventListener('click', () => {
  chips.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  load(b.dataset.dealQ);
}));
if (chips[0]) load(chips[0].dataset.dealQ);
