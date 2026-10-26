// 검색: 직구각이 판정한 상품을 먼저 보여 주고, 알리익스프레스 실시간 가격으로 '아무 상품이나' 판정
import { landedCost, judge, formatKrw as krw } from './calc.js';
import { parseShopLink } from './links.js';
import { variantMismatch } from './variants.js';

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

// ---------- 쿠팡 실시간 가격(/api/coupang, 쿠팡 파트너스 공식 검색 API) ----------
// 같은 검색어는 한 번만 불러요. 서버도 하루 동안 저장해 두고 1시간 횟수를 아껴 써요.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cpCache = new Map();
function fetchCoupang(term) {
  const k = term.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cpCache.has(k)) cpCache.set(k, fetch('/api/coupang?q=' + encodeURIComponent(k)).then((r) => r.json()).catch(() => ({ ok: false, reason: 'error' })));
  return cpCache.get(k);
}
const cpWhen = (at) => { try { const d = new Date(at); return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch { return ''; } };
// 쿠팡 상품 한 줄: 사진·이름·가격·로켓 + [고르기 버튼] + 쿠팡에서 보기(파트너스 링크)
function cpRow(c, pickLabel, onPick) {
  const li = document.createElement('li');
  li.className = 'cpl-item';
  li.innerHTML = `${c.image ? `<img class="cpl-img" src="${esc(c.image)}" alt="" loading="lazy" width="64" height="64">` : '<span class="cpl-img"></span>'}
  <div class="cpl-info"><span class="cpl-name">${esc(c.name)}</span>
  <div class="cpl-meta"><b class="cpl-price">₩${krw(c.price)}</b>${c.rocket ? '<span class="cpl-rocket">로켓배송</span>' : ''}${!c.rocket && c.freeShip ? '<span class="cpl-free">무료배송</span>' : ''}</div>
  <div class="cpl-btns"><button type="button" class="btn btn-ink small cpl-pick"></button><a class="btn btn-line small" href="${esc(c.url)}" target="_blank" rel="sponsored noopener">쿠팡에서 보기</a></div></div>`;
  li.querySelector('.cpl-pick').textContent = pickLabel;
  li.querySelector('.cpl-pick').addEventListener('click', () => onPick(c, li));
  return li;
}
const cpFail = (reason) => ({
  busy: '쿠팡 가격을 찾는 사람이 많아 잠시 쉬고 있어요. 조금 뒤 다시 보거나, 쿠팡에서 직접 검색해 주세요.',
  paused: '쿠팡 가격 검색을 잠시 멈췄어요. 쿠팡에서 직접 검색해 주세요.'
}[reason] || '');

// 국내 기준 가격: 쿠팡 결과에서 하나 고르면 알리 상품마다 그 가격과 비교한 판정을 바로 보여 줘요
let picked = null;
const pickBar = live.querySelector('[data-s-pick]');
function setPicked(c) {
  picked = c;
  if (pickBar) {
    pickBar.hidden = !c;
    if (c) pickBar.querySelector('.s-pick-txt').innerHTML = `<b>국내 기준 ₩${krw(c.price)}</b> <span>쿠팡 ${esc(c.name)}</span>`;
  }
  list.querySelectorAll('.s-item').forEach((li) => li.applyPick && li.applyPick(c));
  document.querySelectorAll('.cpl-item.picked').forEach((x) => x.classList.remove('picked'));
}
if (pickBar) pickBar.querySelector('[data-s-pick-clear]').addEventListener('click', () => setPicked(null));

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
            : ['not_found', 'bad_id', 'no_price'].includes(d.reason)
              ? '이 주소의 상품을 알리 제휴 정보에서 찾지 못했어요. 판매 종료됐거나 제휴 대상이 아닌 상품일 수 있어요. 상품명으로 검색해 보세요.'
              : '상품 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.';
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

  // 2) 쿠팡 실시간 가격(국내)
  const cpl = document.querySelector('[data-s-cpl]');
  if (cpl) {
    const cplList = cpl.querySelector('[data-s-cpl-list]');
    const cplStatus = cpl.querySelector('[data-s-cpl-status]');
    const cplMore = cpl.querySelector('[data-s-cpl-more]');
    cpl.hidden = false;
    cplStatus.textContent = '쿠팡 가격을 찾는 중이에요…';
    fetchCoupang(q).then((d) => {
      if (!d.ok) {
        const msg = cpFail(d.reason);
        if (msg) { cplStatus.innerHTML = `${esc(msg)} <a href="${coupangSearch(q)}" target="_blank" rel="noopener">쿠팡에서 검색</a>`; } else cpl.hidden = true;
        return;
      }
      if (!d.items.length) { cplStatus.textContent = '쿠팡에서 이 검색어로 찾은 상품이 없어요. 모델명으로 다시 검색해 보세요.'; return; }
      cplStatus.textContent = '';
      cpl.querySelector('[data-s-cpl-sub]').textContent = `쿠팡 파트너스 검색 결과 · ${cpWhen(d.at)} 기준${d.stale ? '(지난 결과)' : ''} · 옵션(색·용량)마다 가격이 달라요`;
      d.items.forEach((c, i) => {
        const li = cpRow(c, '국내 기준으로', (x, el) => { setPicked(x); el.classList.add('picked'); live.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        if (i >= 4) li.hidden = true;
        cplList.appendChild(li);
      });
      if (d.items.length > 4) {
        cplMore.hidden = false;
        cplMore.addEventListener('click', () => { cplList.querySelectorAll('li[hidden]').forEach((li) => { li.hidden = false; }); cplMore.hidden = true; });
      }
    });
  }

  // 3) 알리 실시간 가격
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

// 알리 카테고리(한국어로 와요)·상품명 → 직구각 품목 (대략, 사용자가 바꿀 수 있어요)
function guessCat(c = '', title = '') {
  const s = (c + ' ' + title).toLowerCase();
  if (/이어폰|헤드폰|헤드셋|이어버드|스피커|earphone|earbud|headphone|headset|speaker/.test(s)) return 'audio';
  if (/영양제|비타민|보충제|supplement|vitamin/.test(s)) return 'supplement';
  if (/장난감|완구|취미|레고|toy|hobb|lego/.test(s)) return 'toy';
  if (/의류|신발|가방|쥬얼리|주얼리|시계|가발|패션|cloth|apparel|shoe|bag|jewel|watch|wig/.test(s)) return 'apparel';
  if (/컴퓨터|오피스|사무|전자|휴대폰|핸드폰|가전|보안|자동차 전자|phone|computer|electronic|consumer|office|security/.test(s)) return 'it';
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
  // 국내 기준을 고르면 여기에 판정이 바로 보여요
  const quick = document.createElement('span');
  quick.className = 's-quick';
  quick.hidden = true;
  $('.s-meta').appendChild(quick);
  if (!it.comparable) {
    const lab = li.querySelector('.s-dom-in').closest('.field').querySelector('label');
    lab.textContent = lab.textContent.replace('국내 최저가', '비슷한 국내 상품 가격');
  }
  $('.s-buy').href = it.link;
  const domCp = $('.s-dom-coupang');
  if (domCp) domCp.href = coupangSearch(shortQuery(it.title));
  const cat = $('.s-cat');
  cat.value = guessCat(it.category, it.title);
  const result = $('.s-result');
  const domIn = $('.s-dom-in');
  const priceIn = $('.s-price-in');
  if (priceIn) priceIn.value = it.price;

  function compute() {
    const dom = Number(domIn.value);
    const price = (priceIn && Number(priceIn.value)) || it.price;
    const ship = Number($('.s-ship-in').value) || 0;
    const c = landedCost({ priceUsd: price / FX, shipUsd: ship / FX, origin: 'other', method: 'express', category: cat.value, fx: FX });
    const cif = Math.floor(price + ship);
    const duty = c.dutyFree ? 0 : Math.floor(cif * c.rate);
    const total = c.dutyFree ? cif : cif + duty + Math.floor((cif + duty) * 0.1);
    return { dom, c, cif, total, j: dom ? judge(dom, total, RULE) : null };
  }
  const V = (j) => {
    const pct = Math.round(Math.abs(j.pct) * 100);
    return { good: ['v-good', '직구각', `국내보다 ${pct}% 싸요 · ₩${krw(j.diff)} 아껴요`], meh: ['v-meh', '애매', `₩${krw(j.diff)} 싸지만 배송 기간·반품을 생각하면 애매해요`], bad: ['v-bad', '국내가 나음', `국내가 ₩${krw(-j.diff)} 더 싸요`] }[j.verdict] || ['', '-', ''];
  };
  function render() {
    const { dom, c, cif, total, j } = compute();
    const src = domIn.dataset.src ? `<small class="s-dom-src">국내가: 쿠팡 ${esc(domIn.dataset.src)} · 같은 모델·색·구성인지 확인하세요</small>` : '';
    if (!dom) {
      result.className = 's-result';
      result.innerHTML = `직구 최종가 <b>₩${krw(total)}</b> <small>(${c.dutyFree ? `면세 한도 $${c.limit} 안 · 관부가세 0원` : `한도 $${c.limit} 초과 · 관부가세 ₩${krw(total - cif)} 포함`})</small><span>${it.comparable ? '위 쿠팡 후보에서 같은 모델을 고르거나, 국내 최저가를 넣으면 판정해요.' : '노브랜드라 똑같은 국내 상품은 드물어요. 비슷한 국내 상품 가격을 넣으면 얼마나 아끼는지 보여 드려요.'}</span>`;
      quick.hidden = true;
      return;
    }
    const v = V(j);
    const warn = domIn.dataset.src && variantMismatch(it.title, domIn.dataset.src);
    result.className = 's-result ' + (warn ? 'v-warn' : v[0]);
    result.innerHTML = `${warn ? '<b class="s-warn">모델이 다를 수 있어요</b><span>알리와 쿠팡 상품 이름의 등급(Pro·Max·Plus·미니 등)이 달라요. 같은 모델을 다시 골라 주세요. 같다면 아래 판정을 참고하세요.</span>' : ''}<b class="s-vword">${v[1]}</b><span>${v[2]}</span><small>해외 체감가 ₩${krw(total)} (${c.dutyFree ? `면세 한도 $${c.limit} 안` : `한도 $${c.limit} 초과 · 관부가세 ₩${krw(total - cif)} 포함`})</small>${src}`;
    quick.className = 's-quick ' + (warn ? 'v-warn' : v[0]);
    quick.textContent = warn ? `모델이 다를 수 있어요 · 최종가 ₩${krw(total)}` : `${v[1]} · 최종가 ₩${krw(total)}`;
    quick.hidden = false;
  }
  function setDom(price, name) {
    domIn.value = price || '';
    if (name) domIn.dataset.src = name; else delete domIn.dataset.src;
    render();
  }
  // 위쪽 쿠팡 목록에서 '국내 기준'을 고르면: 직접 넣은 값이 없을 때만 채워요
  li.applyPick = (p) => {
    if (domIn.dataset.manual) return;
    if (p) setDom(p.price, p.name); else setDom('', '');
  };
  if (picked) li.applyPick(picked);

  // 판정을 열면 이 알리 상품의 모델명으로 쿠팡 후보를 불러와요(누르면 국내가에 들어가요)
  function loadCoupang() {
    const box = $('.s-cpc');
    if (!box || box.dataset.ready) return;
    box.dataset.ready = '1';
    const term = shortQuery(it.title);
    box.innerHTML = `<div class="s-cpc-head"><b>쿠팡에서 같은 모델 고르기</b><span class="muted small">'${esc(term)}' 검색 결과예요. 같은 모델·색·구성인 상품의 "이 가격 넣기"를 누르세요.</span></div><p class="s-status small">쿠팡 가격을 찾는 중이에요…</p><ol class="cpl-list"></ol><p class="muted small">이 영역은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>`;
    box.hidden = false;
    const st = box.querySelector('.s-status');
    const ol = box.querySelector('.cpl-list');
    fetchCoupang(term).then((d) => {
      if (!d.ok) {
        const msg = cpFail(d.reason);
        if (msg) st.innerHTML = `${esc(msg)} <a href="${coupangSearch(term)}" target="_blank" rel="noopener">쿠팡에서 검색</a>`; else box.hidden = true;
        return;
      }
      if (!d.items.length) { st.textContent = '쿠팡에서 같은 모델을 찾지 못했어요. 아래 칸에 국내 최저가를 직접 넣어 주세요.'; return; }
      st.textContent = `${cpWhen(d.at)} 기준${d.stale ? '(지난 결과)' : ''} 쿠팡 가격 · 옵션마다 가격이 달라요`;
      if (cp && li.contains(cp)) cp.hidden = true; // 쿠팡 후보가 보이면 검색어 복사용 위젯은 접어요
      d.items.slice(0, 5).forEach((c) => ol.appendChild(cpRow(c, '이 가격 넣기', (x, el) => {
        delete domIn.dataset.manual;
        setDom(x.price, x.name);
        ol.querySelectorAll('.picked').forEach((p) => p.classList.remove('picked'));
        el.classList.add('picked');
        result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      })));
    });
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
    if (willOpen) { render(); loadCoupang(); loadNaver(); li.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  li.closeJudge = () => toggle(false);
  li.openJudge = () => toggle(true);
  $('.s-open').addEventListener('click', () => toggle());
  // 사진·상품명을 눌러도 펼쳐져요
  for (const el of [$('.s-title'), li.querySelector('.s-img')]) if (el) { el.classList.add('s-tap'); el.addEventListener('click', () => toggle(true)); }
  // 국내 최저가 찾기: 네이버 쇼핑 검색 API는 2026-07-31 종료돼서, 같은 모델 검색어로 네이버쇼핑 검색 페이지를 열어 줘요.
  function loadNaver() {
    const box = $('.s-naver');
    if (!box || box.dataset.ready) return;
    box.dataset.ready = '1';
    const nq = shortQuery(it.title);
    box.innerHTML = '<div class="s-nv-head"><b>네이버쇼핑에서도 찾아보기</b><span class="muted small"></span></div><a class="btn btn-line small" target="_blank" rel="noopener"></a>';
    box.querySelector('span').textContent = `'${nq}'로 검색해요. 같은 모델·색·구성인 가장 싼 가격을 아래 국내 최저가 칸에 넣어 주세요.`;
    const a = box.querySelector('a');
    a.href = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(nq)}`;
    a.textContent = '네이버쇼핑 최저가 보기';
    box.hidden = false;
  }
  cat.addEventListener('change', render);
  domIn.addEventListener('input', () => { domIn.dataset.manual = '1'; delete domIn.dataset.src; render(); });
  $('.s-ship-in').addEventListener('input', render);
  if (priceIn) priceIn.addEventListener('input', render);
  return li;
}
