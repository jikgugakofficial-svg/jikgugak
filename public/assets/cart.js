// 관세 계산기: 단품/장바구니 탭 + 장바구니 합산 계산
import { cartByStore, CART_STORES, formatKrw as krw } from './calc.js';
import { parseShopLink } from './links.js';

// ---------- 탭 (주소 끝 #cart 로 장바구니 탭이 바로 열려요) ----------
const tabs = [...document.querySelectorAll('[data-tab]')];
function showTab(name, push) {
  for (const t of tabs) {
    const on = t.dataset.tab === name;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    const panel = document.querySelector(`[data-panel="${t.dataset.tab}"]`);
    if (panel) panel.hidden = !on;
  }
  if (push) history.replaceState(null, '', location.pathname + location.search + (name === 'cart' ? '#cart' : ''));
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => showTab(t.dataset.tab, true));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus(); showTab(next.dataset.tab, true);
  });
});
showTab(location.hash === '#cart' ? 'cart' : 'single', false);

// ---------- 장바구니 (쇼핑몰별 상자) ----------
const root = document.querySelector('[data-cart]');
if (root) {
  const FX = Number(root.dataset.fx);
  const PAYFX = Number(root.dataset.payfx) || FX;
  const RULE = { minSaveKrw: Number(root.dataset.minKrw), minSavePct: Number(root.dataset.minPct) };
  const KEY = 'jg-cart-v2';
  const $ = (s) => root.querySelector(s);
  const list = $('[data-cart-list]');
  const catOptions = $('[data-cat-options]').innerHTML;
  const storeOptions = $('[data-store-options]').innerHTML;
  let lastStore = 'aliexpress';
  const blankItem = (o = {}) => ({ name: '', store: lastStore, price: '', qty: 1, category: 'it', dom: '', ...o });

  let state = { ships: {}, items: [blankItem()] };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.items) && saved.items.length) state = { ships: saved.ships || {}, items: saved.items.map((it) => ({ ...it, store: CART_STORES[it.store] ? it.store : 'aliexpress' })) };
    else {
      // 예전(한 상자) 장바구니를 옮겨 와요
      const old = JSON.parse(localStorage.getItem('jg-cart-v1') || 'null');
      if (old && Array.isArray(old.items) && old.items.some((x) => x.name || x.price)) {
        const store = old.origin === 'other' ? (old.currency === 'krw' ? 'aliexpress' : 'other') : old.currency === 'krw' ? 'iherb' : 'amazon';
        state = { ships: { [store]: old.ship || '' }, items: old.items.map((it) => ({ ...it, store })) };
      }
      localStorage.removeItem('jg-cart-v1');
    }
  } catch {}
  if (state.items.length) lastStore = state.items[state.items.length - 1].store || lastStore;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  // 상품 이름으로 종류 짐작(바꿀 수 있어요)
  const guessCat = (t = '') => {
    const s = t.toLowerCase();
    if (/영양제|비타민|오메가|마그네슘|유산균|프로바이오|아연|밀크씨슬|콜라겐|supplement|vitamin|omega|magnesium|probiotic/.test(s)) return 'supplement';
    if (/프로틴|단백질|웨이|크레아틴|간식|커피|차\b|protein|whey|snack/.test(s)) return 'food';
    if (/이어폰|헤드폰|헤드셋|스피커|버즈|earbud|headphone|headset|speaker/.test(s)) return 'audio';
    if (/티셔츠|셔츠|자켓|재킷|바지|신발|운동화|양말|후드|모자|clog|shoe|sneaker|shirt|jacket|hoodie/.test(s)) return 'apparel';
    if (/레고|lego|장난감|피규어|toy/.test(s)) return 'toy';
    if (/텀블러|컵|주방|그라인더|냄비|팬|청소|tumbler|kitchen|grinder/.test(s)) return 'home';
    if (/책|도서|book/.test(s)) return 'book';
    return 'it';
  };
  const curOf = (store) => (CART_STORES[store]?.currency === 'krw' ? '원' : '달러');
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function rowHtml(it, i) {
    const step = curOf(it.store) === '원' ? '10' : '0.01';
    return `<li class="cart-row" data-i="${i}">
  <div class="cr-top"><label class="sr-only" for="cr-n${i}">상품 이름</label><input id="cr-n${i}" data-k="name" type="text" placeholder="상품 이름 (예: 비타민 D)" value="${esc(it.name)}">
  <button type="button" class="cr-del" data-del aria-label="${esc(it.name || i + 1 + '번 상품')} 빼기">×</button></div>
  <div class="cr-grid">
    <label class="cr-store"><span>쇼핑몰</span><select data-k="store">${storeOptions}</select></label>
    <label><span data-unit>가격 (${curOf(it.store)}, 1개)</span><input data-k="price" type="number" inputmode="decimal" min="0" step="${step}" value="${esc(it.price)}"></label>
    <label><span>수량</span><input data-k="qty" type="number" inputmode="numeric" min="1" step="1" value="${esc(it.qty)}"></label>
    <label><span>종류</span><select data-k="category">${catOptions}</select></label>
    <label><span>국내가 (원, 1개 · 선택)</span><input data-k="dom" type="number" inputmode="numeric" min="0" step="100" value="${esc(it.dom)}" placeholder="쿠팡 등 최저가"></label>
  </div>
</li>`;
  }
  function renderList() {
    list.innerHTML = state.items.map(rowHtml).join('');
    list.querySelectorAll('.cart-row').forEach((li) => {
      const it = state.items[li.dataset.i];
      li.querySelector('[data-k=category]').value = it.category || 'it';
      li.querySelector('[data-k=store]').value = it.store || 'aliexpress';
    });
  }

  list.addEventListener('input', (e) => {
    const li = e.target.closest('.cart-row'); const k = e.target.dataset.k;
    if (!li || !k || e.target.tagName === 'SELECT') return;
    state.items[li.dataset.i][k] = e.target.value;
    calc();
  });
  list.addEventListener('change', (e) => {
    if (e.target.tagName !== 'SELECT') return;
    const it = state.items[e.target.closest('.cart-row').dataset.i];
    const k = e.target.dataset.k;
    if (k === 'store') {
      // 결제 통화가 바뀌면 넣은 가격도 결제 환율로 바꿔 줘요
      const from = CART_STORES[it.store]?.currency; const to = CART_STORES[e.target.value]?.currency;
      if (from !== to && it.price !== '' && it.price != null) it.price = to === 'krw' ? Math.round(Number(it.price) * PAYFX) : Math.round((Number(it.price) / PAYFX) * 100) / 100;
      it.store = lastStore = e.target.value;
      renderList();
    } else it[k] = e.target.value;
    calc();
  });
  list.addEventListener('click', (e) => {
    if (!e.target.closest('[data-del]')) return;
    state.items.splice(Number(e.target.closest('.cart-row').dataset.i), 1);
    if (!state.items.length) state.items.push(blankItem());
    renderList(); calc();
  });
  $('[data-cart-blank]').addEventListener('click', () => {
    state.items.push(blankItem()); renderList(); calc();
    list.querySelector('.cart-row:last-child input')?.focus();
  });
  $('[data-cart-clear]').addEventListener('click', () => { state = { ships: {}, items: [blankItem()] }; renderList(); calc(); });

  // 쇼핑몰별 배송비 칸(담긴 쇼핑몰만). 다시 그리면 입력 중 커서가 날아가서, 쇼핑몰 구성이 바뀔 때만 다시 그려요.
  const shipsBox = $('[data-cart-ships]');
  let shipKeys = '';
  function renderShips(boxes) {
    const keys = boxes.map((b) => b.store).join(',');
    if (keys !== shipKeys) {
      shipKeys = keys;
      shipsBox.innerHTML = boxes.length ? `<b class="cs-title">쇼핑몰별 국제 배송비</b>` + boxes.map((b) => `<label class="field cs-row"><span>${esc(b.label)} · ${curOf(b.store)}</span><input data-ship="${b.store}" type="number" inputmode="decimal" min="0" step="${curOf(b.store) === '원' ? 100 : 0.01}" value="${esc(state.ships[b.store] ?? '')}" placeholder="${b.freeShipKrw ? '비우면 자동' : '무료면 0'}"><small data-ship-note="${b.store}"></small></label>`).join('') : '';
    }
    for (const b of boxes) {
      const n = shipsBox.querySelector(`[data-ship-note="${b.store}"]`);
      if (n) n.textContent = b.autoShip ? `40,000원 미만이라 6,000원 자동 (${b.ship ? '붙어요' : '지금은 무료'})` : '결제 화면에 따로 적힌 배송비';
    }
  }
  shipsBox.addEventListener('input', (e) => { const k = e.target.dataset.ship; if (!k) return; state.ships[k] = e.target.value; calc(); });

  // 담기: 쇼핑몰 링크를 알아보고 쇼핑몰 칸을 맞춰요. 알리는 사이트 /api/item(알리 제휴 API)으로 이름·원화 가격까지.
  const msg = $('[data-cart-msg]');
  const say = (t) => { msg.textContent = t; msg.hidden = !t; };
  const addItem = (it) => {
    const empty = state.items.findIndex((x) => !x.name && !x.price);
    if (empty >= 0) state.items[empty] = it; else state.items.push(it);
    lastStore = it.store;
    renderList(); calc();
  };
  const focusLastPrice = () => list.querySelector('.cart-row:last-child [data-k="price"]')?.focus();
  $('[data-cart-add]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#cart-q'); const q = input.value.trim();
    if (!q) return;
    const link = parseShopLink(q);
    say('');
    if (link && link.store === 'aliexpress' && link.id) {
      say('알리에서 가격을 가져오는 중이에요…');
      try {
        const d = await (await fetch('/api/item?id=' + link.id)).json();
        if (!d.ok) throw new Error();
        addItem(blankItem({ store: 'aliexpress', name: String(d.item.title || '').slice(0, 60), price: Math.round(d.item.price), category: guessCat(d.item.title) }));
        say('담았어요. 가격은 대표 옵션 값이라, 고른 색·옵션 가격과 다르면 고쳐 주세요.');
      } catch { addItem(blankItem({ store: 'aliexpress', name: '알리 상품' })); say('가격을 못 가져왔어요. 가격을 직접 넣어 주세요.'); focusLastPrice(); }
    } else if (link && link.store === 'aliexpress') {
      say('앱 공유용 짧은 주소는 열지 않아요. 상품 페이지 주소(…/item/숫자.html)를 넣어 주세요.'); return;
    } else if (link && link.store === 'coupang') {
      say('쿠팡은 국내 쇼핑몰이에요. 쿠팡 가격은 상품 줄의 "국내가" 칸에 넣어 주세요.'); return;
    } else if (link && (link.store === 'amazon' || link.store === 'iherb')) {
      addItem(blankItem({ store: link.store, name: link.name || (link.store === 'amazon' ? '아마존 상품' : '아이허브 상품'), category: link.store === 'iherb' ? (guessCat(link.name) === 'food' ? 'food' : 'supplement') : guessCat(link.name) }));
      say(`이름만 채웠어요. 결제 화면의 가격을 ${link.store === 'amazon' ? '달러' : '원화'}로 넣어 주세요.`);
      focusLastPrice();
    } else if (link) {
      addItem(blankItem({ store: 'us', name: '해외 쇼핑몰 상품' }));
      say('처음 보는 쇼핑몰이라 "기타 미국 쇼핑몰"로 넣었어요. 일본·유럽이면 쇼핑몰 칸을 "기타 해외 쇼핑몰"로 바꿔 주세요.');
      focusLastPrice();
    } else {
      addItem(blankItem({ name: q.slice(0, 60), category: guessCat(q) }));
      say(`"${CART_STORES[lastStore].label}"로 넣었어요. 다른 쇼핑몰이면 쇼핑몰 칸을 바꿔 주세요.`);
      focusLastPrice();
    }
    input.value = '';
  });

  const money = (n) => '₩' + krw(n);
  const usd = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

  function calc() {
    save();
    const r = cartByStore({ items: state.items, ships: state.ships, fx: FX, payFx: PAYFX }, RULE);
    const live = r.boxes.filter((b) => b.rows);
    renderShips(r.boxes);
    const count = state.items.reduce((a, it) => a + (Number(it.price) > 0 ? Math.max(0, Math.floor(Number(it.qty) || 0)) : 0), 0);

    // 판정
    const hero = $('[data-c-verdict]');
    const V = { good: ['v-good', '직구각'], meh: ['v-meh', '애매'], bad: ['v-bad', '국내가 나음'], none: ['', r.rows ? '판정 대기' : '담은 상품 없음'] }[r.verdict];
    hero.className = 'vhero ' + V[0];
    hero.querySelector('.vword').textContent = V[1];
    const pct = Math.round(Math.abs(r.pct) * 100);
    hero.querySelector('b').textContent = !r.rows ? '상품과 가격을 넣으면 쇼핑몰별로 계산해요'
      : r.verdict === 'good' ? `장바구니 전체가 국내보다 ${pct}% 싸요 · ${money(r.diff)} 아껴요`
      : r.verdict === 'meh' ? `${money(r.diff)} 싸지만 배송 기간·반품을 생각하면 애매해요`
      : r.verdict === 'bad' ? `국내에서 사는 게 ${money(-r.diff)} 더 싸요`
      : '상품마다 국내가를 넣으면 장바구니 전체를 판정해요';

    // 전체 신호등: 한 상자라도 넘으면 빨강
    const signal = !live.length ? 'green' : live.some((b) => !b.dutyFree) ? 'red' : live.some((b) => b.signal === 'yellow') ? 'yellow' : 'green';
    const lights = root.querySelectorAll('[data-c-signal] i');
    lights.forEach((l) => (l.className = ''));
    lights[{ green: 0, yellow: 1, red: 2 }[signal]].className = 'on-' + signal;
    const sig = root.querySelector('[data-c-signal] > span');
    sig.querySelector('b').textContent = signal === 'red' ? `${r.taxed}개 쇼핑몰이 면세 한도 초과` : signal === 'yellow' ? '면세 한도에 거의 다 찬 쇼핑몰이 있어요' : '모든 쇼핑몰이 면세 한도 안이에요';
    sig.querySelector('small').textContent = live.length ? `쇼핑몰 ${live.length}곳 · 예상 세금 ${money(r.duty + r.vat)}` : '-';

    // 쇼핑몰별 상자
    $('[data-c-boxes]').innerHTML = live.map((b) => {
      const tag = !b.dutyFree ? ['cb-red', '한도 초과'] : b.signal === 'yellow' ? ['cb-yellow', '거의 다 참'] : ['cb-green', '면세'];
      return `<li class="${tag[0]}"><div class="cb-head"><b>${esc(b.label)}</b><span class="cb-tag">${tag[1]}</span></div>
<span class="cb-line">한도 $${b.limit} 중 ${usd(b.judgeUsd)}${b.shipCounts ? '(배송비 포함)' : ''} · ${b.dutyFree ? '세금 ₩0' : `세금 ${money(b.duty + b.vat)}`} · 체감가 ${money(b.total)}</span></li>`;
    }).join('');

    // 안내
    const notes = [];
    for (const b of live) {
      if (!b.dutyFree && b.trim) {
        if (b.trim.index >= 0) notes.push(['good', `${esc(b.label)}: <b>${esc(String(b.trim.name).slice(0, 30))}</b> 1개만 빼면 면세예요. 세금 ${money(b.trim.taxSaved)}이 사라져요.`]);
        else if (b.rows === 1 && b.input.items.filter((it) => Number(it.price) > 0).length === 1 && Math.floor(Number(b.input.items.find((it) => Number(it.price) > 0).qty)) === 1) notes.push(['warn', `${esc(b.label)}: 이 상품 하나만으로 면세 한도($${b.limit})를 넘어서 세금 ${money(b.duty + b.vat)}이 붙어요. 체감가에 이미 넣었어요.`]);
        else notes.push(['warn', `${esc(b.label)}: 면세가 되려면 물품가를 ${usd(b.trim.overUsd)} 넘게 줄여야 해요.`]);
      } else if (b.signal === 'yellow') notes.push(['warn', `${esc(b.label)}: 한도까지 ${usd(b.limit - b.judgeUsd)} 남았어요.`]);
      if (b.mixedLimit) notes.push(['info', `${esc(b.label)}: 영양제·식품이 섞여서 이 상자는 배송비까지 합쳐 $150 기준이에요. 영양제·식품이 없으면 미국 특송은 물품가 $200 기준이에요.`]);
      if (b.tooManyBottles) notes.push(['warn', `${esc(b.label)}: 건강기능식품은 한 번에 6병까지만 자가사용으로 인정돼요. 지금 ${b.bottles}병이라 통관이 막힐 수 있어요.`]);
    }
    if (live.length > 1) notes.push(['info', '쇼핑몰마다 따로 배송돼서 면세 한도를 각각 따져요. 같은 날 도착해도 판매자가 다르면 합치지 않아요.']);
    if (r.rows && !r.hasDom) notes.push(['info', '상품마다 국내가를 넣으면 장바구니 전체를 직구각/애매/국내가 나음으로 판정해요.']);
    $('[data-c-notes]').innerHTML = notes.map(([k, t]) => `<li class="cn-${k}">${t}</li>`).join('');

    // 영수증
    const set = (k, v) => { const el = root.querySelector(`[data-cr="${k}"]`); if (el) el.textContent = v; };
    set('count', `물품가 합계 (${count}개)`);
    set('goods', money(r.goodsKrw));
    set('ship', money(r.shipKrw));
    set('duty', money(r.duty));
    set('vat', money(r.vat));
    set('total', money(r.total));
    $('[data-cr-domrow]').hidden = !r.hasDom;
    set('dom', money(r.domTotal));
  }

  renderList();
  calc();
}
