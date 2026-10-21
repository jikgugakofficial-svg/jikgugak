// 검색: 직구각이 판정한 상품을 먼저 보여 주고, 네이버쇼핑 실시간 국내 최저가로 '아무 상품이나' 판정
import { landedCost, judge, formatKrw as krw } from './calc.js';

const q = (new URLSearchParams(location.search).get('q') || '').trim();
const live = document.querySelector('[data-s-live]');
const FX = Number(live.dataset.fx);
const RULE = { minSaveKrw: Number(live.dataset.minKrw), minSavePct: Number(live.dataset.minPct) };
const AMZ_TAG = live.dataset.amzTag;
const statusEl = live.querySelector('[data-s-status]');
const list = live.querySelector('[data-s-list]');
const tpl = document.getElementById('s-row');
const norm = (s) => s.toLowerCase().replace(/\s+/g, '');

document.getElementById('sq').value = q;
const headerQ = document.getElementById('q');
if (headerQ) headerQ.value = q;

if (q) {
  document.title = `'${q}' 직구각 검색 | 직구각`;
  document.querySelector('[data-s-title]').textContent = `'${q}' 직구각 검색`;

  // 1) 이미 판정한 상품 (단어마다 하나라도 맞으면)
  const words = q.split(/\s+/).map(norm).filter(Boolean);
  const cards = [...document.querySelectorAll('[data-s-curated] .card')];
  let hit = 0;
  for (const c of cards) {
    const name = norm(c.dataset.name);
    const ok = words.every((w) => name.includes(w)) || name.includes(norm(q));
    c.hidden = !ok;
    if (ok) hit++;
  }
  document.querySelector('[data-s-curated]').hidden = hit === 0;

  // 2) 네이버쇼핑 실시간 국내 최저가
  live.hidden = false;
  statusEl.textContent = '국내 최저가를 찾는 중이에요…';
  fetch('/api/search?q=' + encodeURIComponent(q))
    .then((r) => r.json().catch(() => ({ ok: false })))
    .then((d) => {
      if (!d.ok) {
        statusEl.innerHTML = d.reason === 'not_configured'
          ? '실시간 국내 최저가 검색은 곧 열려요. 지금은 <a href="/calculator">관세 계산기</a>에 가격을 직접 넣어 판정할 수 있어요.'
          : '국내 최저가를 불러오지 못했어요. 잠시 뒤 다시 검색해 주세요.';
        return;
      }
      if (!d.items.length) { statusEl.textContent = '국내 판매 상품을 찾지 못했어요. 검색어를 바꿔 보세요.'; return; }
      statusEl.textContent = '';
      d.items.forEach((it) => list.appendChild(row(it)));
    })
    .catch(() => { statusEl.textContent = '국내 최저가를 불러오지 못했어요. 잠시 뒤 다시 검색해 주세요.'; });
} else {
  document.getElementById('sq').focus();
}

// 네이버 카테고리 → 직구각 품목
function guessCat(cat) {
  const [c1 = '', c2 = ''] = cat;
  if (c1 === '디지털/가전') return 'it';
  if (c1 === '식품' || c2.includes('건강')) return 'supplement';
  if (c1.startsWith('패션')) return 'apparel';
  if (c1 === '도서') return 'book';
  return 'home';
}
// 해외 검색어: 영문·숫자 단어(브랜드·모델명)가 있으면 그것만
function overseasQuery(it) {
  const ascii = it.title.match(/[A-Za-z0-9][A-Za-z0-9.+\-]*/g) || [];
  const base = ascii.filter((w) => w.length > 1).slice(0, 6).join(' ');
  return base.length >= 3 ? base : it.title;
}

function row(it) {
  const li = tpl.content.firstElementChild.cloneNode(true);
  const $ = (s) => li.querySelector(s);
  const img = $('.s-img');
  if (it.image) img.src = it.image; else img.remove();
  $('.s-title').textContent = it.title;
  $('.s-title').href = it.link;
  $('.s-price').textContent = '₩' + krw(it.price);
  $('.s-mall').textContent = it.mall;

  const oq = encodeURIComponent(overseasQuery(it));
  $('.s-ali').href = `https://ko.aliexpress.com/wholesale?SearchText=${oq}`;
  $('.s-iherb').href = `https://kr.iherb.com/search?kw=${oq}`;
  $('.s-amz').href = `https://www.amazon.com/s?k=${oq}${AMZ_TAG ? '&tag=' + encodeURIComponent(AMZ_TAG) : ''}`;

  const st = { cur: 'krw', origin: 'other', cat: guessCat(it.cat || []) };
  $('.s-cat').value = st.cat;
  const result = $('.s-result');

  function render() {
    li.querySelectorAll('[data-cur]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cur === st.cur)));
    li.querySelectorAll('[data-origin]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.origin === st.origin)));
    const raw = Number($('.s-price-in').value);
    const ship = Number($('.s-ship-in').value) || 0;
    if (!raw) { result.className = 's-result'; result.innerHTML = `해외 가격을 넣으면 국내 최저가 <b>₩${krw(it.price)}</b>와 비교해요.`; return; }
    const toUsd = (v) => (st.cur === 'krw' ? v / FX : v);
    const c = landedCost({ priceUsd: toUsd(raw), shipUsd: toUsd(ship), origin: st.origin, method: 'express', category: st.cat, fx: FX });
    let total = c.total;
    if (st.cur === 'krw') { // 원화 결제는 낸 금액 그대로
      const cif = Math.floor(raw + ship);
      total = c.dutyFree ? cif : cif + Math.floor(cif * c.rate) + Math.floor((cif + Math.floor(cif * c.rate)) * 0.1);
    }
    const j = judge(it.price, total, RULE);
    const pct = Math.round(Math.abs(j.pct) * 100);
    const V = { good: ['v-good', '직구각', `국내보다 ${pct}% 싸요 · ₩${krw(j.diff)} 아껴요`], meh: ['v-meh', '애매', `₩${krw(j.diff)} 싸지만 배송 기간·반품을 생각하면 애매해요`], bad: ['v-bad', '국내가 나음', `국내가 ₩${krw(-j.diff)} 더 싸요`] }[j.verdict] || ['', '-', ''];
    result.className = 's-result ' + V[0];
    result.innerHTML = `<b class="s-vword">${V[1]}</b><span>${V[2]}</span><small>해외 체감가 ₩${krw(total)} (${c.dutyFree ? `면세 한도 $${c.limit} 안` : `한도 $${c.limit} 초과 · 관부가세 ₩${krw(total - Math.floor(st.cur === 'krw' ? raw + ship : c.goodsKrw + c.shipKrw))} 포함`})</small>`;
  }

  $('.s-open').addEventListener('click', () => {
    const j = $('.s-judge');
    j.hidden = !j.hidden;
    $('.s-open').textContent = j.hidden ? '해외 가격 넣고 판정하기' : '판정 닫기';
    if (!j.hidden) { render(); $('.s-price-in').focus(); }
  });
  li.querySelectorAll('[data-cur]').forEach((b) => b.addEventListener('click', () => { st.cur = b.dataset.cur; render(); }));
  li.querySelectorAll('[data-origin]').forEach((b) => b.addEventListener('click', () => {
    st.origin = b.dataset.origin;
    if (st.origin === 'us' && st.cur === 'krw' && !$('.s-price-in').value) st.cur = 'usd';
    render();
  }));
  $('.s-cat').addEventListener('change', (e) => { st.cat = e.target.value; render(); });
  $('.s-price-in').addEventListener('input', render);
  $('.s-ship-in').addEventListener('input', render);
  return li;
}
