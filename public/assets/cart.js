// 관세 계산기: 단품/장바구니 탭 + 장바구니 합산 계산
import { cartCost, cartTrim, CATEGORIES, formatKrw as krw } from './calc.js';
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

// ---------- 장바구니 ----------
const root = document.querySelector('[data-cart]');
if (root) {
  const FX = Number(root.dataset.fx);
  const PAYFX = Number(root.dataset.payfx) || FX;
  const RULE = { minSaveKrw: Number(root.dataset.minKrw), minSavePct: Number(root.dataset.minPct) };
  const KEY = 'jg-cart-v1';
  const $ = (s) => root.querySelector(s);
  const list = $('[data-cart-list]');
  const catOptions = $('[data-cat-options]').innerHTML;
  const blankItem = (o = {}) => ({ name: '', price: '', qty: 1, category: 'it', dom: '', ...o });

  let state = { origin: 'us', method: 'express', currency: 'usd', ship: 0, items: [blankItem()] };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.items)) state = { ...state, ...saved, items: saved.items.length ? saved.items : [blankItem()] };
  } catch {}
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
  const cur = () => (state.currency === 'krw' ? '원' : '달러');
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function rowHtml(it, i) {
    const step = state.currency === 'krw' ? '10' : '0.01';
    return `<li class="cart-row" data-i="${i}">
  <div class="cr-top"><label class="sr-only" for="cr-n${i}">상품 이름</label><input id="cr-n${i}" data-k="name" type="text" placeholder="상품 이름 (예: 비타민 D)" value="${esc(it.name)}">
  <button type="button" class="cr-del" data-del aria-label="${esc(it.name || i + 1 + '번 상품')} 빼기">×</button></div>
  <div class="cr-grid">
    <label><span>가격 (${cur()}, 1개)</span><input data-k="price" type="number" inputmode="decimal" min="0" step="${step}" value="${esc(it.price)}"></label>
    <label><span>수량</span><input data-k="qty" type="number" inputmode="numeric" min="1" step="1" value="${esc(it.qty)}"></label>
    <label><span>종류</span><select data-k="category">${catOptions}</select></label>
    <label><span>국내가 (원, 1개 · 선택)</span><input data-k="dom" type="number" inputmode="numeric" min="0" step="100" value="${esc(it.dom)}" placeholder="쿠팡 등 최저가"></label>
  </div>
</li>`;
  }
  function renderList() {
    list.innerHTML = state.items.map(rowHtml).join('');
    list.querySelectorAll('.cart-row').forEach((li) => { li.querySelector('select').value = state.items[li.dataset.i].category || 'it'; });
  }

  list.addEventListener('input', (e) => {
    const li = e.target.closest('.cart-row'); const k = e.target.dataset.k;
    if (!li || !k) return;
    state.items[li.dataset.i][k] = e.target.value;
    calc();
  });
  list.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') { state.items[e.target.closest('.cart-row').dataset.i].category = e.target.value; calc(); } });
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
  $('[data-cart-clear]').addEventListener('click', () => {
    state.items = [blankItem()]; state.ship = 0; $('[data-cart-ship]').value = 0; renderList(); calc();
  });
  $('[data-cart-ship]').value = state.ship;
  $('[data-cart-ship]').addEventListener('input', (e) => { state.ship = e.target.value; calc(); });

  root.querySelectorAll('[data-cgroup]').forEach((seg) => {
    const g = seg.dataset.cgroup;
    seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (state[g] === b.dataset.val) return;
      // 통화를 바꾸면 이미 넣은 가격도 결제 환율로 바꿔 줘요
      if (g === 'currency') {
        const toKrw = b.dataset.val === 'krw';
        const conv = (v) => (v === '' || v == null ? v : toKrw ? Math.round(Number(v) * PAYFX) : Math.round((Number(v) / PAYFX) * 100) / 100);
        state.items = state.items.map((it) => ({ ...it, price: conv(it.price) }));
        state.ship = conv(state.ship); $('[data-cart-ship]').value = state.ship;
      }
      state[g] = b.dataset.val; renderList(); calc();
    }));
  });

  // 담기: 알리 링크는 사이트 /api/item(알리 제휴 API)으로 이름·원화 가격을 받아요
  const msg = $('[data-cart-msg]');
  const say = (t) => { msg.textContent = t; msg.hidden = !t; };
  const addItem = (it) => {
    const empty = state.items.findIndex((x) => !x.name && !x.price);
    if (empty >= 0) state.items[empty] = it; else state.items.push(it);
    renderList(); calc();
  };
  $('[data-cart-add]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#cart-q'); const q = input.value.trim();
    if (!q) return;
    const link = parseShopLink(q);
    say('');
    // 장바구니가 비어 있으면 쇼핑몰에 맞게 보내는 곳·결제 통화를 맞춰 줘요(알리 → 그 외·원화, 아마존 → 미국·달러, 아이허브 한국 → 미국·원화)
    const fresh = !state.items.some((x) => Number(x.price) > 0);
    const preset = link && { aliexpress: { origin: 'other', currency: 'krw' }, amazon: { origin: 'us', currency: 'usd' }, iherb: { origin: 'us', currency: 'krw' } }[link.store];
    if (preset && fresh) { Object.assign(state, preset, { method: 'express' }); renderList(); calc(); }
    if (link && link.store === 'aliexpress' && link.id) {
      say('알리에서 가격을 가져오는 중이에요…');
      try {
        const d = await (await fetch('/api/item?id=' + link.id)).json();
        if (!d.ok) throw new Error();
        let price = Math.round(d.item.price);
        if (state.currency === 'usd') price = Math.round((price / PAYFX) * 100) / 100;
        const name = String(d.item.title || '').slice(0, 60);
        addItem(blankItem({ name, price, category: guessCat(d.item.title) }));
        say(state.origin === 'us' ? '담았어요. 알리는 보통 중국에서 보내요. 위에서 "그 외"를 고르면 면세 한도($150)가 맞게 계산돼요.' : state.currency === 'usd' ? '담았어요. 알리는 원화 결제라 위에서 "원화"를 고르면 더 정확해요.' : '담았어요. 가격은 대표 옵션 값이라, 고른 색·옵션 가격과 다르면 고쳐 주세요.');
      } catch { addItem(blankItem({ name: '알리 상품' })); say('가격을 못 가져왔어요. 가격을 직접 넣어 주세요.'); }
    } else if (link && link.store === 'aliexpress') {
      say('앱 공유용 짧은 주소는 열지 않아요. 상품 페이지 주소(…/item/숫자.html)를 넣어 주세요.'); return;
    } else if (link && link.store === 'coupang') {
      say('쿠팡은 국내 쇼핑몰이에요. 쿠팡 가격은 상품 줄의 "국내가" 칸에 넣어 주세요.'); return;
    } else if (link) {
      addItem(blankItem({ name: link.name || ({ amazon: '아마존 상품', iherb: '아이허브 상품' }[link.store] || '상품'), category: link.store === 'iherb' ? 'supplement' : guessCat(link.name) }));
      say('이름만 채웠어요. 결제 화면의 가격을 넣어 주세요.');
      list.querySelector('.cart-row:last-child [data-k="price"]')?.focus();
    } else {
      addItem(blankItem({ name: q.slice(0, 60), category: guessCat(q) }));
      list.querySelector('.cart-row:last-child [data-k="price"]')?.focus();
    }
    input.value = '';
  });

  const money = (n) => '₩' + krw(n);
  const usd = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

  function calc() {
    save();
    root.querySelectorAll('[data-cgroup]').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.val === state[seg.dataset.cgroup]))));
    root.querySelectorAll('[data-cur]').forEach((el) => (el.textContent = cur()));
    const input = { items: state.items, currency: state.currency, ship: state.ship, origin: state.origin, method: state.method, fx: FX, payFx: PAYFX };
    const c = cartCost(input, RULE);
    const count = state.items.reduce((a, it) => a + (Number(it.price) > 0 ? Math.max(0, Math.floor(Number(it.qty) || 0)) : 0), 0);

    // 판정
    const hero = $('[data-c-verdict]');
    const V = { good: ['v-good', '직구각'], meh: ['v-meh', '애매'], bad: ['v-bad', '국내가 나음'], none: ['', c.rows ? '판정 대기' : '담은 상품 없음'] }[c.verdict];
    hero.className = 'vhero ' + V[0];
    hero.querySelector('.vword').textContent = V[1];
    const pct = Math.round(Math.abs(c.pct) * 100);
    hero.querySelector('b').textContent = !c.rows ? '상품과 가격을 넣으면 합계를 계산해요'
      : c.verdict === 'good' ? `장바구니 전체가 국내보다 ${pct}% 싸요 · ${money(c.diff)} 아껴요`
      : c.verdict === 'meh' ? `${money(c.diff)} 싸지만 배송 기간·반품을 생각하면 애매해요`
      : c.verdict === 'bad' ? `국내에서 사는 게 ${money(-c.diff)} 더 싸요`
      : '상품마다 국내가를 넣으면 장바구니 전체를 판정해요';

    // 면세 신호등
    const lights = root.querySelectorAll('[data-c-signal] i');
    lights.forEach((l) => (l.className = ''));
    lights[{ green: 0, yellow: 1, red: 2 }[c.signal]].className = 'on-' + c.signal;
    const sig = root.querySelector('[data-c-signal] > span');
    sig.querySelector('b').textContent = c.signal === 'red' ? '면세 한도 초과' : c.signal === 'yellow' ? '면세 한도에 거의 다 찼어요' : '면세 한도 안이에요';
    sig.querySelector('small').textContent = c.dutyFree
      ? `한도 $${c.limit} 중 ${usd(c.goodsUsd)} · 예상 세금 ₩0`
      : `한도 $${c.limit} 중 ${usd(c.goodsUsd)} · 배송비 포함 전체에 세금 ${money(c.duty + c.vat)}`;

    // 안내
    const notes = [];
    if (!c.dutyFree && c.rows) {
      const t = cartTrim(input, RULE);
      if (t && t.index >= 0) notes.push(['good', `<b>${esc(t.name.slice(0, 30))}</b> 1개만 빼면 면세예요. 세금 ${money(t.taxSaved)}이 사라져요.`]);
      else if (t) notes.push(['warn', `면세가 되려면 물품가를 ${usd(t.overUsd)} 넘게 줄여야 해요. 지금 그대로면 세금이 ${money(t.taxSaved)} 붙어요.`]);
    } else if (c.signal === 'yellow') notes.push(['warn', `한도까지 ${usd(c.limit - c.goodsUsd)} 남았어요. 하나 더 담으면 넘을 수 있어요.`]);
    if (c.mixedLimit) notes.push(['info', '영양제·식품이 섞여서 상자 전체가 $150 기준이에요. 영양제·식품이 없으면 미국 특송은 $200 기준이에요.']);
    if (state.origin === 'us' && state.method === 'post') notes.push(['info', '우편(EMS 등)으로 받으면 미국발이어도 $150 기준이에요.']);
    if (c.tooManyBottles) notes.push(['warn', `건강기능식품은 한 번에 6병까지만 자가사용으로 인정돼요. 지금 ${c.bottles}병이라 통관이 막힐 수 있어요.`]);
    if (state.currency === 'krw' && state.origin === 'us' && c.rows && c.goodsKrw < 40000) notes.push(['info', '아이허브(한국)라면 40,000원 미만 주문은 배송비 6,000원이 붙어요. 배송비 칸에 넣어 주세요.']);
    if (c.rows && !c.hasDom) notes.push(['info', '상품마다 국내가를 넣으면 장바구니 전체를 직구각/애매/국내가 나음으로 판정해요.']);
    $('[data-c-notes]').innerHTML = notes.map(([k, t]) => `<li class="cn-${k}">${t}</li>`).join('');

    // 영수증
    const set = (k, v) => { const el = root.querySelector(`[data-cr="${k}"]`); if (el) el.textContent = v; };
    set('count', `물품가 합계 (${count}개)`);
    set('goods', money(c.goodsKrw));
    set('ship', money(c.shipKrw));
    set('duty', money(c.duty));
    set('vat', money(c.vat));
    set('total', money(c.total));
    $('[data-cr-domrow]').hidden = !c.hasDom;
    set('dom', money(c.domTotal));
  }

  renderList();
  calc();
}
