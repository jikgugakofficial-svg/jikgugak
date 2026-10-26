// 검색: 직구각이 판정한 상품을 먼저 보여 주고, 알리익스프레스 실시간 가격으로 '아무 상품이나' 판정
import { landedCost, judge, formatKrw as krw } from './calc.js';
import { parseShopLink } from './links.js';
import { variantMismatch, sameModel } from './variants.js';
import { analyze, comparability, ACCESSORY_WORDS } from './rank.js';

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
function fetchAli(term) {
  return fetch('/api/search?q=' + encodeURIComponent(term)).then((r) => r.json()).catch(() => ({ ok: false, reason: 'error' }));
}
const cpWhen = (at) => { try { const d = new Date(at); return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch { return ''; } };
// 쿠팡 상품 한 줄(판정 칸 안의 '같은 모델 고르기' 목록)
function cpRow(c, pickLabel, onPick) {
  const li = document.createElement('li');
  li.className = 'cpl-item';
  li.innerHTML = `${c.image ? `<img class="cpl-img" src="${esc(c.image)}" alt="" loading="lazy" width="72" height="72">` : '<span class="cpl-img"></span>'}
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

// 알리 상품 하나의 직구 최종가(관부가세·배송비 포함)
function aliTotal(price, ship, cat) {
  const c = landedCost({ priceUsd: price / FX, shipUsd: ship / FX, origin: 'other', method: 'express', category: cat, fx: FX });
  const cif = Math.floor(price + ship);
  const duty = c.dutyFree ? 0 : Math.floor(cif * c.rate);
  const total = c.dutyFree ? cif : cif + duty + Math.floor((cif + duty) * 0.1);
  return { total, cif, c };
}
const VERD = (j) => {
  const pct = Math.round(Math.abs(j.pct) * 100);
  return { good: ['v-good', '직구각', `알리가 ₩${krw(j.diff)}(${pct}%) 싸요`], meh: ['v-meh', '애매', `알리가 ₩${krw(j.diff)} 싸지만 배송 1~2주를 생각하면 애매해요`], bad: ['v-bad', '국내가 나음', `쿠팡이 ₩${krw(-j.diff)} 더 싸요`] }[j.verdict] || ['', '-', ''];
};

// ---------- 같은 제품 비교 카드(알리 + 쿠팡을 한 카드에) ----------
function pairCard(ali, cpi) {
  const li = document.createElement('li');
  li.className = 'pc';
  const cat = guessCat(ali.category, ali.title);
  const img = cpi.image || ali.image;
  li.innerHTML = `
  <div class="pc-head">${img ? `<img class="pc-img" src="${esc(img)}" alt="" loading="lazy" width="120" height="120">` : '<span class="pc-img"></span>'}
    <div class="pc-info"><span class="pc-tag">같은 제품 비교</span><span class="pc-name">${esc(cpi.name)}</span><span class="pc-verdict"></span></div></div>
  <div class="pc-rows">
    <div class="pc-row"><span class="pc-store">쿠팡</span><span class="pc-val"><b class="pc-cp">₩${krw(cpi.price)}</b><small>${cpi.rocket ? '로켓배송' : cpi.freeShip ? '무료배송' : '배송비 별도일 수 있어요'}</small></span><a class="btn btn-line small" href="${esc(cpi.url)}" target="_blank" rel="sponsored noopener">쿠팡에서 보기</a></div>
    <div class="pc-row"><span class="pc-store">알리</span><span class="pc-val"><b class="pc-ali"></b><small class="pc-ali-sub"></small></span><a class="btn btn-line small" href="${esc(ali.link)}" target="_blank" rel="sponsored noopener">알리에서 보기</a></div>
  </div>
  <details class="pc-more"><summary>옵션 가격으로 다시 계산</summary>
    <p class="muted small">알리 상품: ${esc(ali.title)}</p>
    <div class="s-grid">
      <div class="field"><label>쿠팡 가격 (원)</label><input class="pc-cp-in" type="number" inputmode="numeric" min="0" step="10" value="${cpi.price}"></div>
      <div class="field"><label>알리 가격 (원)</label><input class="pc-ali-in" type="number" inputmode="numeric" min="0" step="10" value="${ali.price}"><small>고른 색·용량 옵션의 가격으로 바꿔 주세요</small></div>
      <div class="field"><label>국제 배송비 (원)</label><input class="pc-ship-in" type="number" inputmode="numeric" min="0" step="100" value="0"></div>
      <div class="field"><label>품목</label><select class="pc-cat">${document.querySelector('.s-cat') ? '' : ''}</select></div>
    </div>
  </details>
  <p class="pc-note muted small">이름·모델 번호가 같은 상품끼리 자동으로 묶었어요. 색·용량·구성이 같은지 한 번 더 확인하세요.</p>`;
  // 품목 선택지는 템플릿의 것을 복사해요
  const tplSel = tpl.content.querySelector('.s-cat');
  const sel = li.querySelector('.pc-cat');
  sel.innerHTML = tplSel.innerHTML; sel.value = cat;
  const $ = (x) => li.querySelector(x);
  function render() {
    const cpPrice = Number($('.pc-cp-in').value) || cpi.price;
    const aliPrice = Number($('.pc-ali-in').value) || ali.price;
    const ship = Number($('.pc-ship-in').value) || 0;
    const { total, cif, c } = aliTotal(aliPrice, ship, sel.value);
    const j = judge(cpPrice, total, RULE);
    const v = VERD(j);
    $('.pc-cp').textContent = '₩' + krw(cpPrice);
    $('.pc-ali').textContent = '₩' + krw(total);
    $('.pc-ali-sub').textContent = c.dutyFree ? `최종가 · 면세 한도 $${c.limit} 안` : `최종가 · 관부가세 ₩${krw(total - cif)} 포함`;
    const pv = $('.pc-verdict');
    pv.className = 'pc-verdict ' + v[0];
    pv.innerHTML = `<b>${v[1]}</b> ${esc(v[2])}`;
  }
  li.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', render));
  render();
  return li;
}

// 쿠팡에만 있는 상품(알리에서 같은 모델을 못 찾음)
function cpCard(cpi) {
  const li = document.createElement('li');
  li.className = 'pc pc-one';
  li.innerHTML = `
  <div class="pc-head">${cpi.image ? `<img class="pc-img" src="${esc(cpi.image)}" alt="" loading="lazy" width="120" height="120">` : '<span class="pc-img"></span>'}
    <div class="pc-info"><span class="pc-tag cp">쿠팡</span><span class="pc-name">${esc(cpi.name)}</span>
    <div class="pc-line"><b>₩${krw(cpi.price)}</b>${cpi.rocket ? '<span class="cpl-rocket">로켓배송</span>' : ''}</div>
    <div class="s-btns"><a class="btn btn-line small" href="${esc(cpi.url)}" target="_blank" rel="sponsored noopener">쿠팡에서 보기</a><a class="btn btn-ink small" href="/search?q=${encodeURIComponent(shortQuery(cpi.name))}">이 모델로 직구가 찾기</a></div></div></div>`;
  return li;
}

// ---------- 검색어와 얼마나 비슷한지(알리·쿠팡 결과를 한 줄로 세울 때) ----------
function score(title, term) {
  const a = analyze({ title }, term);
  if (!a.relevant) return -1;
  return a.coverage * 3 + (a.full ? 1 : 0) + (comparability(title).comparable ? 0.5 : 0) - (a.accessory ? 3 : 0) - (a.compat ? 0.5 : 0);
}
// 알리·쿠팡 결과를 같은 모델끼리 묶고, 비슷한 순서로 한 목록을 만들어요
function merge(aliItems, cpItems, term, pinnedAli) {
  const A = aliItems.map((it) => ({ it, s: score(it.title, term) })).filter((x) => x.s >= 0 || x.it === pinnedAli);
  const seenCp = new Set();
  const C = cpItems.filter((it) => { const k = it.name + '|' + it.price; return !seenCp.has(k) && seenCp.add(k); }).map((it) => ({ it, s: score(it.name, term) })).filter((x) => x.s >= 0 && !ACCESSORY_WORDS.some((w) => x.it.name.toLowerCase().includes(w) && !term.toLowerCase().includes(w)));
  const usedA = new Set(); const units = [];
  for (const c of [...C].sort((x, y) => y.s - x.s)) {
    const cand = A.filter((a) => !usedA.has(a) && !a.it.accessory && a.it.price >= c.it.price * 0.35 && sameModel(a.it.title, c.it.name)).sort((x, y) => y.s - x.s)[0];
    if (cand) { usedA.add(cand); units.push({ kind: 'pair', ali: cand.it, cp: c.it, s: Math.max(c.s, cand.s) + 1 + (cand.it === pinnedAli ? 10 : 0) }); c.paired = true; }
  }
  for (const a of A) if (!usedA.has(a)) units.push({ kind: 'ali', ali: a.it, s: a.s - (a.it.accessory ? 1 : 0) + (a.it === pinnedAli ? 10 : 0) });
  for (const c of C) if (!c.paired) units.push({ kind: 'cp', cp: c.it, s: c.s - 0.2 });
  return units.sort((x, y) => y.s - x.s);
}

// 결과를 그려요: 같은 제품 비교 → 알리만 → 쿠팡만이 비슷한 순서대로 섞여요
function show(units, { openFirstAli = false, limit = 14 } = {}) {
  list.innerHTML = '';
  let opened = false;
  units.slice(0, limit).forEach((u) => {
    if (u.kind === 'pair') list.appendChild(pairCard(u.ali, u.cp));
    else if (u.kind === 'ali') { const li = row(u.ali); list.appendChild(li); if (openFirstAli && !opened) { li.openJudge(); opened = true; } }
    else list.appendChild(cpCard(u.cp));
  });
  const pairs = units.filter((u) => u.kind === 'pair').length;
  const sub = live.querySelector('[data-s-live-sub]');
  if (sub) sub.textContent = pairs ? `알리·쿠팡에서 같은 제품 ${pairs}개를 찾아 나란히 비교했어요 · 검색어와 비슷한 순서` : '검색어와 비슷한 순서 · 알리 가격은 관부가세 포함 최종가로 판정해요';
}

// 알리·쿠팡을 함께 찾아서 한 목록으로
async function searchBoth(term, { pinnedAli = null, label = '' } = {}) {
  live.hidden = false;
  statusEl.textContent = '알리익스프레스·쿠팡 가격을 함께 찾는 중이에요…';
  const [a, c] = await Promise.all([pinnedAli ? Promise.resolve({ ok: true, items: [] }) : fetchAli(term), fetchCoupang(term)]);
  const aliItems = [...(pinnedAli ? [pinnedAli] : []), ...(a.ok ? a.items : [])];
  const cpItems = c.ok ? c.items : [];
  const units = merge(aliItems, cpItems, term, pinnedAli);
  const notes = [];
  if (label) notes.push(label);
  if (!c.ok && cpFail(c.reason)) notes.push(cpFail(c.reason));
  if (!a.ok && !pinnedAli) notes.push(a.reason === 'not_configured' ? '알리 실시간 가격은 곧 열려요.' : '알리 가격을 불러오지 못했어요.');
  if (!units.length) {
    statusEl.innerHTML = `${notes.map(esc).join(' ')} <b>이 제품은 찾기가 힘들어요.</b> 직구각과 연결된 쇼핑몰(알리익스프레스·쿠팡)에서 같은 상품을 찾지 못했어요. 브랜드와 모델명으로 다시 검색하거나, 가격을 알고 있다면 <a href="/calculator">관세 계산기</a>로 판정할 수 있어요.`;
    return units;
  }
  if (a.ok && a.mainFound === false && !units.some((u) => u.kind !== 'cp')) notes.push('알리에는 이 상품 본품이 거의 없고 액세서리·호환품만 보여요.');
  statusEl.textContent = notes.join(' ');
  show(units, { openFirstAli: Boolean(pinnedAli) && !units.some((u) => u.kind === 'pair') });
  return units;
}

document.getElementById('sq').value = q;
const headerQ = document.getElementById('q');
if (headerQ) headerQ.value = q;

// 등록 상품(이미 판정한 것) 걸러 보이기
function showCurated(test) {
  let hit = 0;
  for (const c of document.querySelectorAll('[data-s-curated] [data-s-item]')) { const ok = test(c); c.hidden = !ok; if (ok) hit++; }
  document.querySelector('[data-s-curated]').hidden = hit === 0;
  return hit;
}
function setMore(term) {
  const more = live.querySelector('[data-s-more]');
  live.querySelector('[data-s-naver]').href = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(term)}`;
  const cpLink = live.querySelector('[data-s-coupang]');
  if (cpLink) cpLink.href = coupangSearch(term);
  more.hidden = false;
  const amz = live.querySelector('[data-s-amazon]');
  if (amz) { amz.href = `https://www.amazon.com/s?k=${encodeURIComponent(term)}&tag=${encodeURIComponent(amz.dataset.tag)}`; live.querySelector('[data-s-amazon-wrap]').hidden = false; }
}
const STORE_KO = { aliexpress: '알리익스프레스', coupang: '쿠팡', amazon: '아마존', iherb: '아이허브' };

const link = parseShopLink(q);
if (q && link) {
  // 붙여 넣은 상품 주소: 쇼핑몰마다 알 수 있는 만큼 읽어서 같은 제품을 찾아요(주소의 페이지는 열지 않아요)
  document.title = '붙여 넣은 상품 직구각 판정 | 직구각';
  document.querySelector('[data-s-title]').textContent = `붙여 넣은 ${STORE_KO[link.store] || ''} 상품 판정`.replace('  ', ' ');
  live.hidden = false;
  const none = document.querySelector('[data-s-none]');
  if (none) none.hidden = true;
  const curatedBy = (re) => showCurated((c) => re.test(c.dataset.urls || ''));
  if (link.store === 'aliexpress' && link.id) {
    statusEl.textContent = '알리익스프레스 상품 정보를 불러오는 중이에요…';
    curatedBy(new RegExp(link.id));
    fetch('/api/item?id=' + link.id)
      .then((r) => r.json().catch(() => ({ ok: false })))
      .then((d) => {
        if (!d.ok) {
          statusEl.innerHTML = d.reason === 'not_configured'
            ? '상품 주소 판정은 곧 열려요. 지금은 <a href="/calculator">관세 계산기</a>에 가격을 직접 넣어 판정할 수 있어요.'
            : ['not_found', 'bad_id', 'no_price'].includes(d.reason)
              ? '<b>이 제품은 찾기가 힘들어요.</b> 알리 제휴 정보에 없는 상품이에요(판매 종료·제휴 제외일 수 있어요). 상품명으로 검색해 보세요.'
              : '상품 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.';
          return;
        }
        const term = shortQuery(d.item.title);
        setMore(term);
        searchBoth(term, { pinnedAli: d.item, label: `붙여 넣은 알리 상품과 같은 모델을 쿠팡에서 '${term}'(으)로 찾았어요.` });
      })
      .catch(() => { statusEl.textContent = '상품 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'; });
  } else if (link.store === 'aliexpress') {
    statusEl.innerHTML = '이 알리 주소에서는 상품 번호를 찾지 못했어요. 앱 공유 주소(a.aliexpress.com)라면 앱에서 <b>브라우저로 열기</b>를 누른 뒤 주소창의 주소(…/item/숫자.html)를 붙여 넣어 주세요. 상품명으로 검색해도 돼요.';
  } else if (link.store === 'coupang') {
    const hit = link.id ? curatedBy(new RegExp('products/' + link.id + '(\\D|$)')) : 0;
    statusEl.innerHTML = hit
      ? '직구각이 이미 판정한 상품이에요. 아래에서 해외 최종가와 비교해 보세요.'
      : `<b>쿠팡 주소만으로는 상품 이름을 알 수 없어서 찾기가 힘들어요.</b> ${link.id ? '' : '단축 주소(link.coupang.com)는 열지 않아요. '}상품명이나 모델명(예: QCY T13)으로 검색하면 알리 직구가와 바로 비교해 드려요.`;
  } else if ((link.store === 'amazon' || link.store === 'iherb') ) {
    const hit = link.id ? curatedBy(new RegExp(link.store === 'amazon' ? '/dp/' + link.id : '/' + link.id + '(\\D|$)', 'i')) : 0;
    if (hit) statusEl.textContent = '직구각이 이미 판정한 상품이에요. 아래에서 국내 최저가와 비교해 보세요.';
    else if (link.name) {
      setMore(link.name);
      searchBoth(link.name, { label: `${STORE_KO[link.store]} 주소에서 상품 이름('${link.name}')을 읽어 알리·쿠팡에서 찾았어요. ${link.store === 'amazon' ? '아마존 가격은 아마존에서 확인한 뒤 계산기에 넣어 주세요.' : '아이허브 가격은 아이허브에서 확인한 뒤 계산기에 넣어 주세요.'}` });
    } else statusEl.innerHTML = `<b>이 ${STORE_KO[link.store]} 주소로는 상품을 찾기가 힘들어요.</b> 상품명이나 모델명으로 검색해 주세요.`;
  } else {
    statusEl.innerHTML = '<b>이 쇼핑몰은 아직 직구각과 연결되지 않아 찾기가 힘들어요.</b> 지금은 알리익스프레스·쿠팡·아마존·아이허브 주소를 읽을 수 있어요. 상품명이나 모델명으로 검색해 주세요.';
  }
} else if (q) {
  document.title = `'${q}' 직구각 검색 | 직구각`;
  document.querySelector('[data-s-title]').textContent = `'${q}' 직구각 검색`;
  // 1) 이미 판정한 상품
  const words = q.split(/\s+/).map(norm).filter(Boolean);
  const hit = showCurated((c) => { const name = norm(c.dataset.name); return words.every((w) => name.includes(w)) || name.includes(norm(q)); });
  const none = document.querySelector('[data-s-none]');
  if (none) none.hidden = hit > 0;
  // 인기 검색어 집계(같은 검색어는 이 탭에서 한 번만 세요)
  try {
    const k = 'jg_sq_' + norm(q);
    if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); fetch('/api/trending', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q }), keepalive: true }).catch(() => {}); }
  } catch { /* 저장 안 돼도 검색은 그대로 */ }
  // 2) 알리·쿠팡 실시간 가격을 한 목록으로
  setMore(q);
  searchBoth(q);
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
