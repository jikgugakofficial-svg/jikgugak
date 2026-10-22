// 검색: 직구각이 판정한 상품을 먼저 보여 주고, 알리익스프레스 실시간 가격으로 '아무 상품이나' 판정
import { landedCost, judge, formatKrw as krw } from './calc.js';

const q = (new URLSearchParams(location.search).get('q') || '').trim();
const live = document.querySelector('[data-s-live]');
const FX = Number(live.dataset.fx);
const RULE = { minSaveKrw: Number(live.dataset.minKrw), minSavePct: Number(live.dataset.minPct) };
const statusEl = live.querySelector('[data-s-status]');
const list = live.querySelector('[data-s-list]');
const tpl = document.getElementById('s-row');
const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
const coupangSearch = (t) => `https://www.coupang.com/np/search?q=${encodeURIComponent(t)}`;

document.getElementById('sq').value = q;
const headerQ = document.getElementById('q');
if (headerQ) headerQ.value = q;

if (q) {
  document.title = `'${q}' 직구각 검색 | 직구각`;
  document.querySelector('[data-s-title]').textContent = `'${q}' 직구각 검색`;

  // 1) 이미 판정한 상품
  const words = q.split(/\s+/).map(norm).filter(Boolean);
  let hit = 0;
  for (const c of document.querySelectorAll('[data-s-curated] .card')) {
    const name = norm(c.dataset.name);
    const ok = words.every((w) => name.includes(w)) || name.includes(norm(q));
    c.hidden = !ok;
    if (ok) hit++;
  }
  document.querySelector('[data-s-curated]').hidden = hit === 0;

  // 2) 알리 실시간 가격
  live.hidden = false;
  const more = live.querySelector('[data-s-more]');
  live.querySelector('[data-s-coupang]').href = coupangSearch(q);
  live.querySelector('[data-s-naver]').href = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`;
  more.hidden = false;
  const amz = live.querySelector('[data-s-amazon]');
  if (amz) {
    amz.href = `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${encodeURIComponent(amz.dataset.tag)}`;
    live.querySelector('[data-s-amazon-wrap]').hidden = false;
  }
  statusEl.textContent = '알리익스프레스 가격을 찾는 중이에요…';
  fetch('/api/search?q=' + encodeURIComponent(q))
    .then((r) => r.json().catch(() => ({ ok: false })))
    .then((d) => {
      if (!d.ok) {
        statusEl.innerHTML = d.reason === 'not_configured'
          ? '실시간 가격 검색은 곧 열려요. 지금은 <a href="/calculator">관세 계산기</a>에 가격을 직접 넣어 판정할 수 있어요.'
          : '가격을 불러오지 못했어요. 잠시 뒤 다시 검색해 주세요.';
        return;
      }
      if (!d.items.length) { statusEl.textContent = '알리익스프레스에서 상품을 찾지 못했어요. 영어나 다른 이름으로 검색해 보세요.'; return; }
      statusEl.textContent = '';
      d.items.forEach((it) => list.appendChild(row(it)));
    })
    .catch(() => { statusEl.textContent = '가격을 불러오지 못했어요. 잠시 뒤 다시 검색해 주세요.'; });
} else {
  document.getElementById('sq').focus();
}

// 알리 카테고리 → 직구각 품목 (대략)
function guessCat(c = '') {
  const s = c.toLowerCase();
  if (/phone|computer|electronic|consumer|office|security/.test(s)) return 'it';
  if (/toy|hobb/.test(s)) return 'toy';
  if (/cloth|apparel|shoe|bag|jewel|watch|wig/.test(s)) return 'apparel';
  if (/beauty|health/.test(s)) return 'home';
  return 'home';
}
// 쿠팡 검색어: 영문·숫자 모델명 위주로 짧게
function shortQuery(t) {
  const words = t.split(/[\s,()/]+/).filter(Boolean);
  const spec = /^\d+(\.\d+)?(w|hz|k|gb|tb|mah|mm|cm|ml|l|in|ft|m|g|kg|v|a|pcs)$|\d+(hz|gbps|mbps)/i;
  const model = words.filter((w) => /[A-Za-z]/.test(w) && /\d/.test(w) && !spec.test(w) && !/rj45|usb|pd\d/i.test(w)).slice(0, 2);
  return (model.length ? [words[0], ...model] : words.slice(0, 4)).join(' ');
}

function row(it) {
  const li = tpl.content.firstElementChild.cloneNode(true);
  const $ = (s) => li.querySelector(s);
  const img = $('.s-img');
  if (it.image) img.src = it.image; else img.remove();
  $('.s-title').textContent = it.title;
  $('.s-price').textContent = '₩' + krw(it.price);
  if (it.original > it.price) $('.s-orig').textContent = '₩' + krw(it.original); else $('.s-orig').remove();
  $('.s-mall').textContent = [it.accessory ? '액세서리일 수 있어요' : '', it.orders ? `${krw(it.orders)}개 판매` : '', it.rating ? `평점 ${it.rating}` : ''].filter(Boolean).join(' · ');
  $('.s-buy').href = it.link;
  $('.s-dom-coupang').href = coupangSearch(shortQuery(it.title));
  const cat = $('.s-cat');
  cat.value = guessCat(it.category);
  const result = $('.s-result');

  function render() {
    const dom = Number($('.s-dom-in').value);
    const ship = Number($('.s-ship-in').value) || 0;
    if (!dom) { result.className = 's-result'; result.innerHTML = `국내 최저가를 넣으면 알리 가격 <b>₩${krw(it.price)}</b>와 비교해요.`; return; }
    const c = landedCost({ priceUsd: it.price / FX, shipUsd: ship / FX, origin: 'other', method: 'express', category: cat.value, fx: FX });
    const cif = Math.floor(it.price + ship);
    const duty = c.dutyFree ? 0 : Math.floor(cif * c.rate);
    const total = c.dutyFree ? cif : cif + duty + Math.floor((cif + duty) * 0.1);
    const j = judge(dom, total, RULE);
    const pct = Math.round(Math.abs(j.pct) * 100);
    const V = { good: ['v-good', '직구각', `국내보다 ${pct}% 싸요 · ₩${krw(j.diff)} 아껴요`], meh: ['v-meh', '애매', `₩${krw(j.diff)} 싸지만 배송 기간·반품을 생각하면 애매해요`], bad: ['v-bad', '국내가 나음', `국내가 ₩${krw(-j.diff)} 더 싸요`] }[j.verdict] || ['', '-', ''];
    result.className = 's-result ' + V[0];
    result.innerHTML = `<b class="s-vword">${V[1]}</b><span>${V[2]}</span><small>해외 체감가 ₩${krw(total)} (${c.dutyFree ? `면세 한도 $${c.limit} 안` : `한도 $${c.limit} 초과 · 관부가세 ₩${krw(total - cif)} 포함`})</small>`;
  }

  $('.s-open').addEventListener('click', () => {
    const j = $('.s-judge');
    j.hidden = !j.hidden;
    $('.s-open').textContent = j.hidden ? '국내가 넣고 판정' : '판정 닫기';
    if (!j.hidden) { render(); $('.s-dom-in').focus(); }
  });
  cat.addEventListener('change', render);
  $('.s-dom-in').addEventListener('input', render);
  $('.s-ship-in').addEventListener('input', render);
  return li;
}
