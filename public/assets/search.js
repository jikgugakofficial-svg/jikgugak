// 검색: 직구각이 판정한 상품을 먼저 보여 주고, 알리익스프레스 실시간 가격으로 '아무 상품이나' 판정
import { landedCost, judge, formatKrw as krw } from './calc.js';
import { parseShopLink } from './links.js';

const q = (new URLSearchParams(location.search).get('q') || '').trim();
const live = document.querySelector('[data-s-live]');
const FX = Number(live.dataset.fx);
const RULE = { minSaveKrw: Number(live.dataset.minKrw), minSavePct: Number(live.dataset.minPct) };
const statusEl = live.querySelector('[data-s-status]');
const list = live.querySelector('[data-s-list]');
const tpl = document.getElementById('s-row');
const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
const coupangSearch = (t) => `https://www.coupang.com/np/search?q=${encodeURIComponent(t)}`;

// 쿠팡 검색 위젯(파트너스 공식 위젯): 위젯 안에는 글자를 넣을 수 없어서 검색어를 복사해 붙여 넣게 도와요
const cp = live.querySelector('[data-s-cp]');
function setCpQuery(t) {
  if (!cp) return;
  cp.querySelector('[data-s-cp-q]').textContent = t;
  const plain = cp.querySelector('[data-s-cp-plain]');
  if (plain) plain.href = `https://www.coupang.com/np/search?q=${encodeURIComponent(t)}`;
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok;
  }
}
async function copyForCoupang(t) {
  setCpQuery(t);
  const ok = await copyText(t);
  cp.querySelector('[data-s-cp-msg]').textContent = ok ? '복사했어요! 아래 쿠팡 검색창에 붙여 넣으세요.' : '복사가 안 되면 검색어를 길게 눌러 복사해 주세요.';
  cp.classList.add('flash'); setTimeout(() => cp.classList.remove('flash'), 1200);
}
if (cp) cp.querySelector('[data-s-cp-copy]').addEventListener('click', () => copyForCoupang(cp.querySelector('[data-s-cp-q]').textContent));
// 펼친 상품 아래로 쿠팡 위젯을 옮겨요(위젯은 하나만 두고 위치만 바꿔요)
function attachCp(li, query) {
  if (!cp) return;
  li.querySelector('.s-cp-slot').appendChild(cp);
  cp.hidden = false;
  setCpQuery(query);
  cp.querySelector('[data-s-cp-msg]').textContent = '';
}

document.getElementById('sq').value = q;
const headerQ = document.getElementById('q');
if (headerQ) headerQ.value = q;

const link = parseShopLink(q);
if (q && link) {
  // 붙여 넣은 상품 주소: 알리면 그 상품 하나를 바로 판정, 다른 쇼핑몰은 안내
  document.title = '붙여 넣은 상품 직구각 판정 | 직구각';
  document.querySelector('[data-s-title]').textContent = '붙여 넣은 상품 판정';
  live.hidden = false;
  live.querySelector('[data-s-live-title]').textContent = '붙여 넣은 알리익스프레스 상품';
  if (link.store === 'aliexpress' && link.id) {
    statusEl.textContent = '알리익스프레스 상품 정보를 불러오는 중이에요…';
    fetch('/api/item?id=' + link.id)
      .then((r) => r.json().catch(() => ({ ok: false })))
      .then((d) => {
        if (!d.ok) {
          statusEl.innerHTML = d.reason === 'not_configured'
            ? '상품 주소 판정은 곧 열려요. 지금은 <a href="/calculator">관세 계산기</a>에 가격을 직접 넣어 판정할 수 있어요.'
            : '이 주소의 상품을 알리 제휴 정보에서 찾지 못했어요. 판매 종료됐거나 제휴 대상이 아닌 상품일 수 있어요. 상품명으로 검색해 보세요.';
          return;
        }
        statusEl.textContent = '';
        const li = row(d.item);
        list.appendChild(li);
        li.openJudge();
      })
      .catch(() => { statusEl.textContent = '상품 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'; });
  } else if (link.store === 'aliexpress') {
    statusEl.innerHTML = '이 알리 주소에서는 상품 번호를 찾지 못했어요. 앱 공유 주소(a.aliexpress.com)라면 앱에서 <b>브라우저로 열기</b>를 누른 뒤 주소창의 주소(…/item/숫자.html)를 붙여 넣어 주세요. 상품명으로 검색해도 돼요.';
  } else {
    const name = { coupang: '쿠팡', amazon: '아마존', iherb: '아이허브' }[link.store] || '이 쇼핑몰';
    statusEl.innerHTML = `지금은 <b>알리익스프레스 상품 주소</b>만 바로 판정해요. ${name} 상품은 상품명이나 모델명으로 검색하거나, 가격을 <a href="/calculator">관세 계산기</a>에 넣어 판정해 주세요.`;
  }
} else if (q) {
  document.title = `'${q}' 직구각 검색 | 직구각`;
  document.querySelector('[data-s-title]').textContent = `'${q}' 직구각 검색`;

  // 1) 이미 판정한 상품
  const words = q.split(/\s+/).map(norm).filter(Boolean);
  let hit = 0;
  for (const c of document.querySelectorAll('[data-s-curated] [data-s-item]')) {
    const name = norm(c.dataset.name);
    const ok = words.every((w) => name.includes(w)) || name.includes(norm(q));
    c.hidden = !ok;
    if (ok) hit++;
  }
  document.querySelector('[data-s-curated]').hidden = hit === 0;
  const none = document.querySelector('[data-s-none]');
  if (none) none.hidden = hit > 0;

  // 인기 검색어 집계(같은 검색어는 이 탭에서 한 번만 세요)
  try {
    const k = 'jg_sq_' + norm(q);
    if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); fetch('/api/trending', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q }), keepalive: true }).catch(() => {}); }
  } catch { /* 저장 안 돼도 검색은 그대로 */ }

  // 2) 알리 실시간 가격
  live.hidden = false;
  const more = live.querySelector('[data-s-more]');
  const cpLink = live.querySelector('[data-s-coupang]');
  if (cpLink) cpLink.href = coupangSearch(q);
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
      if (!d.items.length) { statusEl.textContent = '알리익스프레스에서 이 상품을 찾지 못했어요. 모델명이나 영어 이름으로 검색해 보세요.'; return; }
      statusEl.textContent = d.mainFound === false
        ? '알리익스프레스에는 이 상품 본품이 거의 없고 액세서리·호환품만 보여요. 정품은 쿠팡·아마존 가격과 비교해 보세요.'
        : '';
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
  $('.s-mall').textContent = [it.note || (it.accessory ? '액세서리일 수 있어요' : ''), it.orders ? `${krw(it.orders)}개 판매` : '', it.rating ? `평점 ${it.rating}` : ''].filter(Boolean).join(' · ');
  // 국내에 같은 상품이 있을지: 브랜드·모델명이 있으면 비교 가능, 노브랜드면 '비슷한 상품'으로
  const tag = document.createElement('span');
  tag.className = 's-cmp ' + (it.comparable ? 'yes' : 'no');
  const ident = [it.brand ? (/[a-z]/.test(it.brand) ? it.brand.toUpperCase() : it.brand) : '', it.model ? it.model.toUpperCase() : ''].filter(Boolean).join(' ');
  tag.textContent = it.comparable ? `국내 비교 가능${ident ? ' · ' + ident : ''}` : '노브랜드 · 국내 같은 상품이 드물어요';
  $('.s-meta').appendChild(tag);
  if (!it.comparable) {
    const lab = li.querySelector('.s-dom-in').closest('.field').querySelector('label');
    lab.textContent = lab.textContent.replace('국내 최저가', '비슷한 국내 상품 가격');
  }
  $('.s-buy').href = it.link;
  const domCp = $('.s-dom-coupang');
  if (domCp) domCp.href = coupangSearch(shortQuery(it.title));
  const cat = $('.s-cat');
  cat.value = guessCat(it.category);
  const result = $('.s-result');

  function render() {
    const dom = Number($('.s-dom-in').value);
    const ship = Number($('.s-ship-in').value) || 0;
    const c = landedCost({ priceUsd: it.price / FX, shipUsd: ship / FX, origin: 'other', method: 'express', category: cat.value, fx: FX });
    const cif = Math.floor(it.price + ship);
    const duty = c.dutyFree ? 0 : Math.floor(cif * c.rate);
    const total = c.dutyFree ? cif : cif + duty + Math.floor((cif + duty) * 0.1);
    if (!dom) {
      result.className = 's-result';
      result.innerHTML = `직구 최종가 <b>₩${krw(total)}</b> <small>(${c.dutyFree ? `면세 한도 $${c.limit} 안 · 관부가세 0원` : `한도 $${c.limit} 초과 · 관부가세 ₩${krw(total - cif)} 포함`})</small><span>${it.comparable ? '쿠팡에서 같은 모델 가격을 찾아 넣으면 판정해요.' : '노브랜드라 똑같은 국내 상품은 드물어요. 비슷한 국내 상품 가격을 넣으면 얼마나 아끼는지 보여 드려요.'}</span>`;
      return;
    }
    const j = judge(dom, total, RULE);
    const pct = Math.round(Math.abs(j.pct) * 100);
    const V = { good: ['v-good', '직구각', `국내보다 ${pct}% 싸요 · ₩${krw(j.diff)} 아껴요`], meh: ['v-meh', '애매', `₩${krw(j.diff)} 싸지만 배송 기간·반품을 생각하면 애매해요`], bad: ['v-bad', '국내가 나음', `국내가 ₩${krw(-j.diff)} 더 싸요`] }[j.verdict] || ['', '-', ''];
    result.className = 's-result ' + V[0];
    result.innerHTML = `<b class="s-vword">${V[1]}</b><span>${V[2]}</span><small>해외 체감가 ₩${krw(total)} (${c.dutyFree ? `면세 한도 $${c.limit} 안` : `한도 $${c.limit} 초과 · 관부가세 ₩${krw(total - cif)} 포함`})</small>`;
  }

  function toggle(open) {
    const j = $('.s-judge');
    const willOpen = open ?? j.hidden;
    if (willOpen) {
      // 다른 펼친 상품은 닫아요(쿠팡 위젯이 한 곳에만 있도록)
      list.querySelectorAll('.s-item.open').forEach((o) => { if (o !== li) o.closeJudge(); });
      attachCp(li, shortQuery(it.title));
    }
    j.hidden = !willOpen;
    li.classList.toggle('open', willOpen);
    $('.s-open').textContent = willOpen ? '판정 닫기' : '국내가 넣고 판정';
    if (willOpen) { render(); loadNaver(); li.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  li.closeJudge = () => toggle(false);
  li.openJudge = () => toggle(true);
  $('.s-open').addEventListener('click', () => toggle());
  // 사진·상품명을 눌러도 펼쳐져요
  for (const el of [$('.s-title'), li.querySelector('.s-img')]) if (el) { el.classList.add('s-tap'); el.addEventListener('click', () => toggle(true)); }
  // 국내 최저가 후보: 네이버 쇼핑 검색 API(키가 없으면 이 칸은 안 보여요). 자동 검색이라 같은 모델인지 사람이 확인해야 해요.
  let naverLoaded = false;
  function loadNaver() {
    const box = $('.s-naver');
    if (!box || naverLoaded) return;
    naverLoaded = true;
    const nq = shortQuery(it.title);
    fetch(`/api/naver?q=${encodeURIComponent(nq)}&model=${encodeURIComponent(it.model || '')}`)
      .then((r) => r.json().catch(() => ({ ok: false })))
      .then((d) => {
        if (!d.ok || !d.items || !d.items.length) return;
        const top = d.items.slice(0, 4);
        box.innerHTML = `<div class="s-nv-head"><b>국내 최저가 후보 · 네이버쇼핑</b><span class="muted small">자동 검색 결과예요. 같은 모델·색·구성인지 꼭 확인하고 골라 주세요.</span></div>`;
        const ul = document.createElement('ul'); ul.className = 's-nv-list';
        for (const n of top) {
          const row = document.createElement('li');
          row.innerHTML = `<div class="s-nv-t"><a target="_blank" rel="noopener"></a><small></small></div><b></b><button type="button" class="btn btn-line small">이 가격으로 판정</button>`;
          const a = row.querySelector('a'); a.href = n.link; a.textContent = n.title;
          row.querySelector('small').textContent = [n.mall || '네이버쇼핑', n.modelMatch ? '모델명 일치' : (it.model ? '모델명 다름·확인 필요' : '')].filter(Boolean).join(' · ');
          row.querySelector('b').textContent = '₩' + krw(n.price);
          row.querySelector('button').addEventListener('click', () => { $('.s-dom-in').value = n.price; render(); });
          if (n.modelMatch) row.classList.add('match');
          ul.appendChild(row);
        }
        box.appendChild(ul);
        const src = document.createElement('a');
        src.className = 'small'; src.target = '_blank'; src.rel = 'noopener';
        src.href = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(nq)}`;
        src.textContent = '네이버쇼핑에서 더 보기';
        box.appendChild(src);
        box.hidden = false;
        // 모델명이 일치하는 가장 싼 상품이 있으면 미리 넣어 두고 알려요(바꿀 수 있어요)
        const first = top.find((n) => n.modelMatch);
        if (first && !$('.s-dom-in').value) { $('.s-dom-in').value = first.price; render(); box.querySelector('.s-nv-head span').textContent = `모델명(${(it.model || '').toUpperCase()})이 들어간 가장 싼 상품 가격을 넣어 뒀어요. 색·구성이 같은지 확인하고, 다르면 다른 후보를 골라 주세요.`; }
      })
      .catch(() => {});
  }
  cat.addEventListener('change', render);
  $('.s-dom-in').addEventListener('input', render);
  $('.s-ship-in').addEventListener('input', render);
  return li;
}
