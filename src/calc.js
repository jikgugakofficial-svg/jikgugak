// 직구각 계산 규칙. 사이트 빌드(Node)와 관세 계산기(브라우저)가 같은 파일을 씁니다.
// 근거: 관세법 시행규칙 제45조(물품가격 150달러), FTA관세특례법(미국발 특송 목록통관 200달러),
// 특송물품 고시 별표1(목록통관 배제 품목). 세율은 품목별 기본세율 예시라 실제와 다를 수 있습니다.

export const CATEGORIES = {
  it: { label: 'IT 액세서리·전자기기', sub: '관세 0% 예시', rate: 0, listClearance: true },
  home: { label: '주방·생활용품', sub: '관세 8% 예시', rate: 0.08, listClearance: true },
  apparel: { label: '의류·신발', sub: '관세 13%', rate: 0.13, listClearance: true },
  supplement: { label: '건강기능식품', sub: '관세 8% · 목록통관 배제', rate: 0.08, listClearance: false },
  book: { label: '도서', sub: '관세 0%', rate: 0, listClearance: true },
  audio: { label: '음향기기 (헤드폰·이어폰)', sub: '관세 8%', rate: 0.08, listClearance: true },
  toy: { label: '완구·레고', sub: '관세 8%', rate: 0.08, listClearance: true },
  food: { label: '식품·프로틴', sub: '관세 8% · 목록통관 배제', rate: 0.08, listClearance: false }
};

export const DEFAULT_RULE = { minSaveKrw: 10000, minSavePct: 0.2 };

// 원 미만 버림 (관세청 계산 방식과 같게)
const won = (n) => Math.floor(n);

export function dutyFreeLimit({ origin, method, category }) {
  const cat = CATEGORIES[category] || CATEGORIES.home;
  return origin === 'us' && method === 'express' && cat.listClearance ? 200 : 150;
}

// 해외 최종 체감가(원). 면세 판단은 국제 배송비를 뺀 물품가격으로, 과세는 배송비 포함 전체에.
// fx = 관세청 주간 과세환율(관세·부가세 계산용), payFx = 결제 환율(매매기준율, 달러 결제 금액 계산용).
// payFx를 안 주면 과세환율로 결제 금액도 계산해요.
export function landedCost({ priceUsd, shipUsd = 0, origin, method, category, fx, payFx }) {
  const pay = Number(payFx) || fx;
  const cat = CATEGORIES[category] || CATEGORIES.home;
  const limit = dutyFreeLimit({ origin, method, category });
  const price = Math.max(0, Number(priceUsd) || 0);
  const ship = Math.max(0, Number(shipUsd) || 0);
  // 목록통관 배제 품목(건강기능식품·식품)은 정식 수입신고라 '운송료를 합한 금액'으로 한도를 봐요(관세청 FAQ: 건강기능식품은
  // "운송료를 합한 물품가격이 미화 150불 이내" 면세). 그 외는 물품가격(국제 운송료 제외)으로 봐요.
  const dutyFree = (cat.listClearance ? price : price + ship) <= limit;
  // 과세가격은 달러 합계를 한 번에 원화로 바꿔요. 영수증 줄이 합계와 맞도록 배송비 줄은 차액으로 표시.
  const cif = won((price + ship) * fx); // 과세가격(관세청 환율)
  const paid = won((price + ship) * pay); // 실제 결제 금액(결제 환율)
  const goodsKrw = won(price * pay);
  const shipKrw = paid - goodsKrw;
  const duty = dutyFree ? 0 : won(cif * cat.rate);
  const vat = dutyFree ? 0 : won((cif + duty) * 0.1);
  const total = paid + duty + vat;
  let signal = 'green';
  if (!dutyFree) signal = 'red';
  else if ((cat.listClearance ? price : price + ship) > limit * 0.85) signal = 'yellow';
  return { limit, dutyFree, judgeUsd: cat.listClearance ? price : price + ship, shipCounts: !cat.listClearance, price, ship, goodsKrw, shipKrw, duty, vat, total, signal, rate: cat.rate };
}

// 판정: 20% 이상 그리고 10,000원 이상 싸면 직구각, 조금이라도 싸면 애매, 아니면 국내가 나음
export function judge(domesticKrw, totalKrw, rule = DEFAULT_RULE) {
  const dom = Number(domesticKrw) || 0;
  if (dom <= 0) return { verdict: 'none', diff: 0, pct: 0 };
  const diff = dom - totalKrw;
  const pct = diff / dom;
  if (diff >= rule.minSaveKrw && pct >= rule.minSavePct) return { verdict: 'good', diff, pct };
  if (diff > 0) return { verdict: 'meh', diff, pct };
  return { verdict: 'bad', diff, pct };
}

// 손익분기 상품가(달러): 이 가격 이하면 직구각. 어떤 가격이어도 안 되면 null.
export function breakevenUsd({ domesticKrw, shipUsd = 0, origin, method, category, fx, payFx }, rule = DEFAULT_RULE) {
  const pay = Number(payFx) || fx;
  const cat = CATEGORIES[category] || CATEGORIES.home;
  const limit = dutyFreeLimit({ origin, method, category });
  const dom = Number(domesticKrw) || 0;
  const ship = Math.max(0, Number(shipUsd) || 0);
  const target = Math.min(dom * (1 - rule.minSavePct), dom - rule.minSaveKrw);
  if (target <= 0) return null;
  const freeMax = target / pay - ship;
  if (freeMax <= 0) return null;
  // 면세로 남을 수 있는 최대 상품가: 영양제·식품은 운송료까지 합쳐 한도 안이어야 해요
  const freeLimit = cat.listClearance ? limit : limit - ship;
  if (freeMax <= freeLimit) return Math.floor(freeMax);
  // 과세: 결제액(결제 환율) + 관세·부가세(과세 환율) = (가격+배송비) × (pay + fx × (1.1 × (1 + 관세율) − 1))
  const taxedMax = target / (pay + fx * (1.1 * (1 + cat.rate) - 1)) - ship;
  return Math.floor(taxedMax > freeLimit ? taxedMax : freeLimit);
}

// ---------- 장바구니(여러 상품을 한 번에 받을 때) ----------
// 한 상자(같은 날 함께 들어오는 물건)로 보고 계산해요. 면세 판단은 국제 배송비를 뺀 물품가격 합계로,
// 넘으면 배송비 포함 전체에 품목별 세율로 과세(배송비는 물품가격 비율로 나눠 배정). 목록통관 배제 품목(영양제·식품)이
// 하나라도 섞이면 미국발이어도 상자 전체가 $150 기준이에요.
// items: [{ name, price, qty, category, dom }] · currency: 'usd'(달러 결제) | 'krw'(원화 결제, 알리·아이허브 한국)
// ship: 국제 배송비(같은 통화) · dom: 국내 최저가(원, 1개 값)
export const SUPPLEMENT_MAX_BOTTLES = 6;
export function cartCost({ items = [], currency = 'usd', ship = 0, origin = 'us', method = 'express', fx, payFx }, rule = DEFAULT_RULE) {
  const pay = Number(payFx) || fx;
  const krw = currency === 'krw';
  const rows = items
    .map((it) => ({ ...it, price: Math.max(0, Number(it.price) || 0), qty: Math.max(0, Math.floor(Number(it.qty) || 0)), dom: Math.max(0, Number(it.dom) || 0), cat: CATEGORIES[it.category] || CATEGORIES.home }))
    .filter((r) => r.price > 0 && r.qty > 0);
  const shipIn = Math.max(0, Number(ship) || 0);
  const goodsIn = rows.reduce((a, r) => a + r.price * r.qty, 0); // 입력 통화 합계
  const goodsUsd = krw ? goodsIn / fx : goodsIn;
  const allList = rows.every((r) => r.cat.listClearance);
  const limit = origin === 'us' && method === 'express' && allList ? 200 : 150;
  // 영양제·식품이 섞이면 상자 전체가 정식 수입신고라 운송료까지 합쳐서 한도를 봐요
  const shipUsd = krw ? shipIn / fx : shipIn;
  const judgeUsd = allList ? goodsUsd : goodsUsd + shipUsd;
  const dutyFree = judgeUsd <= limit;
  const goodsKrw = krw ? won(goodsIn) : won(goodsIn * pay);
  const paid = krw ? won(goodsIn + shipIn) : won((goodsIn + shipIn) * pay);
  const shipKrw = paid - goodsKrw;
  const cif = krw ? won(goodsIn + shipIn) : won((goodsIn + shipIn) * fx);
  let duty = 0;
  if (!dutyFree && goodsIn > 0) for (const r of rows) duty += won(cif * (r.price * r.qty / goodsIn) * r.cat.rate);
  const vat = dutyFree ? 0 : won((cif + duty) * 0.1);
  const total = paid + duty + vat;
  let signal = 'green';
  if (!dutyFree) signal = 'red';
  else if (judgeUsd > limit * 0.85) signal = 'yellow';
  const bottles = rows.filter((r) => r.category === 'supplement').reduce((a, r) => a + r.qty, 0);
  const hasDom = rows.length > 0 && rows.every((r) => r.dom > 0);
  const domTotal = rows.reduce((a, r) => a + r.dom * r.qty, 0);
  const verdict = hasDom ? judge(domTotal, total, rule) : { verdict: 'none', diff: 0, pct: 0 };
  return { rows: rows.length, limit, dutyFree, goodsUsd, judgeUsd, shipCounts: !allList, goodsKrw, shipKrw, paid, duty, vat, total, signal, mixedLimit: origin === 'us' && method === 'express' && !allList && rows.some((r) => r.cat.listClearance), bottles, tooManyBottles: bottles > SUPPLEMENT_MAX_BOTTLES, hasDom, domTotal, ...verdict };
}

// 한도를 넘었을 때 "이거 1개만 빼면 면세": 빼는 금액이 가장 작은 1개를 찾아요. 없으면 null.
export function cartTrim(input, rule = DEFAULT_RULE) {
  const now = cartCost(input, rule);
  if (now.dutyFree || !now.rows) return null;
  let best = null;
  input.items.forEach((it, i) => {
    if (!(Number(it.qty) > 0) || !(Number(it.price) > 0)) return;
    const items = input.items.map((x, j) => (j === i ? { ...x, qty: Math.floor(Number(x.qty)) - 1 } : x));
    const after = cartCost({ ...input, items }, rule);
    if (!after.dutyFree || !after.rows) return; // 빼면 상자가 비는 경우(상품 하나뿐)는 제안하지 않아요
    const removed = Number(it.price);
    if (!best || removed < best.removed) best = { index: i, name: it.name || `${i + 1}번 상품`, removed, taxSaved: now.duty + now.vat, after };
  });
  if (best) return best;
  const overUsd = now.judgeUsd - now.limit;
  return { index: -1, overUsd: Math.ceil(overUsd * 100) / 100, taxSaved: now.duty + now.vat };
}

// 쇼핑몰별 상자: 쇼핑몰이 다르면 따로 배송되고 면세 한도도 따로예요(합산과세는 같은 판매자·같은 날 또는 한 운송장일 때).
// currency: 그 쇼핑몰에서 결제하는 통화. freeShipKrw/shipKrw: 아이허브 한국은 40,000원 미만이면 배송비 6,000원.
export const CART_STORES = {
  aliexpress: { label: '알리익스프레스', sub: '중국 · 원화 결제', origin: 'other', currency: 'krw' },
  amazon: { label: '아마존 (미국)', sub: '달러 결제', origin: 'us', currency: 'usd' },
  iherb: { label: '아이허브', sub: '미국 · 원화 결제', origin: 'us', currency: 'krw', freeShipKrw: 40000, shipKrw: 6000 },
  us: { label: '기타 미국 쇼핑몰', sub: '달러 결제', origin: 'us', currency: 'usd' },
  other: { label: '기타 해외 쇼핑몰', sub: '일본·유럽 등 · 달러 결제', origin: 'other', currency: 'usd' }
};
// items[].store 로 상자를 나눠 각각 cartCost. ships: { 쇼핑몰: 배송비(그 쇼핑몰 통화) } — 아이허브는 비워 두면 규칙대로 자동.
export function cartByStore({ items = [], ships = {}, fx, payFx }, rule = DEFAULT_RULE) {
  const boxes = [];
  for (const [key, st] of Object.entries(CART_STORES)) {
    const its = items.filter((it) => (CART_STORES[it.store] ? it.store : 'aliexpress') === key);
    if (!its.length) continue;
    const priced = its.filter((it) => Number(it.price) > 0 && Number(it.qty) > 0);
    const goodsKrwRaw = st.currency === 'krw' ? priced.reduce((a, it) => a + Number(it.price) * Math.floor(Number(it.qty)), 0) : 0;
    let ship = ships[key];
    const autoShip = st.freeShipKrw && (ship === '' || ship == null);
    if (autoShip) ship = priced.length && goodsKrwRaw < st.freeShipKrw ? st.shipKrw : 0;
    const input = { items: its, currency: st.currency, ship: Number(ship) || 0, origin: st.origin, method: 'express', fx, payFx };
    const c = cartCost(input, rule);
    boxes.push({ store: key, ...st, input, autoShip, ship: Number(ship) || 0, ...c, trim: c.dutyFree ? null : cartTrim(input, rule) });
  }
  const live = boxes.filter((b) => b.rows);
  const sum = (k) => live.reduce((a, b) => a + b[k], 0);
  const total = sum('total');
  const allRows = items.filter((it) => Number(it.price) > 0 && Number(it.qty) > 0);
  const hasDom = allRows.length > 0 && allRows.every((it) => Number(it.dom) > 0);
  const domTotal = allRows.reduce((a, it) => a + (Number(it.dom) || 0) * Math.floor(Number(it.qty)), 0);
  const verdict = hasDom ? judge(domTotal, total, rule) : { verdict: 'none', diff: 0, pct: 0 };
  return { boxes, rows: allRows.length, goodsKrw: sum('goodsKrw'), shipKrw: sum('shipKrw'), duty: sum('duty'), vat: sum('vat'), total, taxed: live.filter((b) => !b.dutyFree).length, hasDom, domTotal, ...verdict };
}

export const formatKrw = (n) => Math.round(n).toLocaleString('ko-KR');
