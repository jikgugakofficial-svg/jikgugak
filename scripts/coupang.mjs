// 쿠팡 파트너스 API 작업 (GitHub Actions 'coupang' 워크플로가 돌려요. 키는 GitHub Secrets에만)
//   node scripts/coupang.mjs check                 → 연결 확인(딥링크 1번 호출, 검색 횟수 안 씀)
//   node scripts/coupang.mjs deeplink <쿠팡 일반 주소…> → 파트너스 링크 만들기(결과는 data/coupang-deeplinks.json)
//   node scripts/coupang.mjs prices [개수]          → 등록 상품 가격 자동 반영(10/27~). 쿠팡은 오래 확인 안 한 상품부터 검색해서
//                                                     같은 상품 번호(옵션 번호)면 products.json 국내가를 고치고, 알리는 상품 번호로 3개씩 해외가를 고쳐요.
//                                                     변화가 너무 크거나 판정이 바뀌면 data/price-alerts.json 에 남겨요(사람 확인).
//   node scripts/coupang.mjs report [일수]          → 클릭·주문·수익 리포트 → data/coupang-report.json
//   node scripts/coupang.mjs discover               → 자동 후보 발굴 1개: data/candidate-seeds.json 에서 검색어를 하나 꺼내
//                                                     알리(사이트 /api/search)·쿠팡(검색 1회) 가격을 받아 같은 모델끼리 짝지어
//                                                     data/candidates.json 에 남겨요. 사이트에 바로 올리지 않아요(확인 뒤 등록).
//   node scripts/coupang.mjs links <알리 상품번호·쿠팡 일반 주소…> → 새 상품 등록용 링크: 알리는 사이트 /api/item(제휴 링크·사진),
//                                                     쿠팡은 딥링크 → data/new-links.json (링크는 열지 않아요)
//   node scripts/coupang.mjs hourly                 → 예약 실행: discover 2개 + prices 5개(1시간 7회, 10/27 22시~)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { hasKeys, search, deeplink, report, productIdOf, searchBudgetLeft, readGuard } from './lib/coupang.mjs';
import { landedCost, judge } from '../src/calc.js';
import { variantMismatch } from '../src/variants.js';

const [modeArg = 'check', ...cliArgs] = process.argv.slice(2);
const mode = modeArg;
const args = cliArgs.length ? cliArgs : String(process.env.ARGS || '').split(/\s+/).filter(Boolean);
const readJson = (f, d) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d; } catch { return d; } };
const writeJson = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
const summary = (s, ok = true) => {
  console.log(s);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, s + '\n', { flag: 'a' });
  // 마지막 실행 결과를 저장소에 남겨요(Actions 기록을 못 열어도 매니저가 확인할 수 있게). 키·링크는 적지 않아요.
  writeFileSync('data/coupang-status.json', JSON.stringify({ at: new Date().toISOString(), mode, ok, message: s.split('\n')[0].slice(0, 300) }, null, 2) + '\n');
};
process.on('uncaughtException', (e) => { summary('실패: ' + String(e.message).slice(0, 280), false); process.exit(1); });
process.on('unhandledRejection', (e) => { summary('실패: ' + String(e?.message || e).slice(0, 280), false); process.exit(1); });

if (!hasKeys()) { summary('쿠팡 API 키가 아직 등록되지 않았어요. 아무것도 하지 않고 끝내요.', false); process.exit(0); }

const productsFile = 'data/products.json';
const raw = JSON.parse(readFileSync(productsFile, 'utf8'));
const products = Array.isArray(raw) ? raw : raw.products;
let productsChanged = false; // fillImages(매시간 맨 앞)·가격 반영이 같이 써요 — 먼저 선언(10/28 선언 전 사용 오류로 사진 1개만 채워졌던 문제)

if (mode === 'check') {
  const sample = products.find((p) => productIdOf(p.domesticCheckUrl))?.domesticCheckUrl;
  const out = await deeplink([sample]);
  summary(out.length && out[0].shortenUrl ? `연결 확인 성공: 딥링크 API가 응답했어요 (${out.length}개).` : '연결은 됐지만 딥링크 결과가 비었어요.');
}

if (mode === 'links') {
  const file = 'data/new-links.json';
  const prev = readJson(file, {});
  const cps = args.filter((u) => /^https:\/\/(www\.)?coupang\.com\//.test(u));
  const alis = args.filter((x) => /^\d{12,20}$/.test(x));
  if (cps.length) for (const r of await deeplink(cps)) prev[r.originalUrl] = { coupangLink: r.shortenUrl, at: new Date().toISOString() };
  for (const id of alis) {
    const d = await (await fetch('https://www.jikgugak.com/api/item?id=' + id)).json().catch(() => ({}));
    prev[id] = d.ok ? { aliLink: d.item.link, image: d.item.image, apiPrice: d.item.price, title: d.item.title, at: new Date().toISOString() } : { error: d.reason || 'fail' };
  }
  writeJson(file, prev);
  summary(`링크 만들기: 쿠팡 ${cps.length}개, 알리 ${alis.length}개 → data/new-links.json`);
}

if (mode === 'deeplink') {
  const urls = args.filter((u) => /^https:\/\/(www\.)?coupang\.com\//.test(u));
  if (!urls.length) { summary('쿠팡 일반 주소(https://www.coupang.com/…)를 넣어 주세요.'); process.exit(1); }
  const out = await deeplink(urls);
  const file = 'data/coupang-deeplinks.json';
  const prev = readJson(file, {});
  for (const r of out) prev[r.originalUrl] = { shortenUrl: r.shortenUrl, at: new Date().toISOString() };
  writeJson(file, prev);
  summary(out.map((r) => `${r.originalUrl}\n→ ${r.shortenUrl}`).join('\n'));
}

const out = [];
const budgetMsg = () => { const g = readGuard(); return g.stoppedAt ? `검색 멈춤 상태예요(${g.stopReason}). 사람이 확인한 뒤 data/coupang-guard.json 의 stoppedAt 을 지워야 다시 돌아요.` : '이번 1시간 검색 횟수를 다 썼어요.'; };

// ---------- 자동 후보 발굴 ----------
const settings = readJson('data/settings.json', {});
const FX = Number(settings.fx?.usdKrw) || 1330;
const RULE = { minSaveKrw: settings.rule?.minSaveKrw ?? 10000, minSavePct: settings.rule?.minSavePct ?? 0.2 };
const lc = (t) => String(t || '').toLowerCase().replace(/\s+/g, '');
// 브랜드·모델 단어가 '한 단어로' 들어 있어야 해요(Superlight 2 ≠ Superlight 2c, Band 11 ≠ Band 11 Active는 등급 비교가 걸러요)
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (title, w) => new RegExp(`(^|[^a-z0-9])${esc(String(w).toLowerCase())}($|[^a-z0-9])`).test(String(title).toLowerCase());
// 쿠팡 상품명은 브랜드를 한글로 쓰는 경우가 많아요
const BRAND_KO = { logitech: ['로지텍'], anker: ['앤커'], ugreen: ['유그린'], baseus: ['베이스어스'], xiaomi: ['샤오미'], redmi: ['레드미', '샤오미'], amazfit: ['어메이즈핏', '어매이즈핏'], soundcore: ['사운드코어', '앤커'], edifier: ['에디파이어'], qcy: ['큐씨와이'], aula: ['아울라'], naturehike: ['네이처하이크'], mchose: ['엠초즈'] };
const brandOk = (title, brand) => [brand, ...(BRAND_KO[String(brand).toLowerCase()] || []), ...(String(brand).toLowerCase() === 'soundcore' ? ['anker'] : [])].some((b) => hasWord(title, b));
const hasModel = (title, seed) => (brandOk(title, seed.brand) || (seed.brandKo && hasWord(title, seed.brandKo)) || (seed.brandKo && String(title).includes(seed.brandKo))) && String(seed.model).split(/\s+/).every((w) => hasWord(title, w)) && !variantMismatch(seed.q, title);
// 본품이 아닌 것(교체 부품·케이스·필름 등)은 빼요
const ACCESSORY = /(피트|스케이트|케이스|커버|파우치|필름|보호|스킨|그립|테이프|교체|호환|스트랩|밴드 줄|이어팁|이어패드|거치대|스탠드|키캡|리시버|동글|feet|skate|case|cover|pouch|film|protector|skin|grip|tape|replacement|compatible|strap|ear ?tips?|ear ?pads?|holder|stand|keycaps?|receiver|dongle)/i;
async function discover() {
  const seeds = readJson('data/candidate-seeds.json', { seeds: [] }).seeds || [];
  if (!seeds.length) { out.push('후보 검색어 목록(data/candidate-seeds.json)이 비어 있어요.'); return; }
  if (searchBudgetLeft() <= 0) { out.push('후보 발굴: ' + budgetMsg()); return; }
  const file = 'data/candidates.json';
  const state = readJson(file, { note: '자동 후보(보고용). 같은 모델·옵션 확인 전이라 사이트에 바로 올리지 않아요. 가격은 API 대표 옵션 값일 수 있어요.', items: {} });
  const registered = products.map((p) => lc(p.name));
  // 한 번도 안 찾은 것 → 3일 넘게 지난 것 순서
  const due = seeds.filter((s) => !registered.some((n) => n.includes(lc(s.model)) && n.includes(lc(s.brand))))
    .map((s) => ({ s, at: state.items[s.q]?.at || '' }))
    .filter((x) => !x.at || Date.now() - Date.parse(x.at) > 3 * 86400_000)
    .sort((a, b) => a.at.localeCompare(b.at));
  if (!due.length) { out.push('후보 발굴: 지금 다시 찾을 검색어가 없어요(3일 안에 다 찾음).'); return; }
  const seed = due[0].s;
  const item = { q: seed.q, brand: seed.brand, model: seed.model, cat: seed.cat, why: seed.why, at: new Date().toISOString(), status: 'new' };
  // 알리: 사이트 검색 API(알리 제휴 API, 키는 Vercel에만)
  let ali = [];
  try {
    const d = await (await fetch('https://www.jikgugak.com/api/search?q=' + encodeURIComponent(seed.q))).json();
    ali = (d.items || []).filter((x) => !x.accessory && !ACCESSORY.test(x.title) && hasModel(x.title, seed)).sort((a, b) => (b.orders || 0) - (a.orders || 0)).slice(0, 3)
      .map((x) => ({ id: x.id, title: x.title, price: x.price, orders: x.orders || 0, rating: x.rating || '', image: x.image || '', url: `https://ko.aliexpress.com/item/${x.id}.html` }));
  } catch (e) { item.aliError = String(e.message).slice(0, 120); }
  // 쿠팡: 공식 검색 API 1회
  let cp = [];
  try {
    const hits = await search(seed.q, 10);
    cp = hits.map((h) => h._item).filter((x) => !ACCESSORY.test(x.name) && hasModel(x.name, seed)).sort((a, b) => a.price - b.price).slice(0, 3)
      .map((x) => ({ id: x.id, name: x.name, price: x.price, rocket: x.rocket, image: x.image, url: `https://www.coupang.com/vp/products/${x.id}` }));
    item.coupangTop = hits.length;
  } catch (e) { item.coupangError = String(e.message).slice(0, 160); }
  // 알리가 쿠팡 최저가의 35%도 안 되면 본품이 아닐 가능성이 커서 빼요
  if (cp.length) ali = ali.filter((a) => a.price >= cp[0].price * 0.35);
  item.ali = ali; item.coupang = cp;
  if (ali.length && cp.length) {
    const a = ali[0], c = cp[0];
    const cost = landedCost({ priceUsd: a.price / FX, shipUsd: 0, origin: 'other', method: 'express', category: seed.cat || 'it', fx: FX });
    const cif = Math.floor(a.price);
    const total = cost.dutyFree ? cif : cif + Math.floor(cif * cost.rate) + Math.floor((cif + Math.floor(cif * cost.rate)) * 0.1);
    const j = judge(c.price, total, RULE);
    item.best = { aliId: a.id, coupangId: c.id, aliTotal: total, coupangPrice: c.price, verdict: j.verdict, diff: j.diff, pct: Math.round(j.pct * 100) };
  } else item.status = !ali.length && !cp.length ? 'none' : !ali.length ? 'no_ali' : 'no_coupang';
  state.items[seed.q] = item;
  state.updatedAt = new Date().toISOString();
  writeJson(file, state);
  const V = { good: '직구각', meh: '애매', bad: '국내가 나음' };
  out.push(`후보 발굴 '${seed.q}': ${item.best ? `${V[item.best.verdict]} (알리 최종 ${item.best.aliTotal.toLocaleString('ko-KR')}원 / 쿠팡 ${item.best.coupangPrice.toLocaleString('ko-KR')}원)` : { none: '알리·쿠팡 모두 같은 모델 못 찾음', no_ali: '알리에서 같은 모델 못 찾음', no_coupang: '쿠팡에서 같은 모델 못 찾음' }[item.status]}${item.coupangError ? ' · ' + item.coupangError : ''}`);
}

if (mode === 'discover') { await discover(); summary(out.join('\n')); }
// 사진 없는 등록 상품: 쿠팡 파트너스 검색 결과에서 같은 상품 번호의 제공 이미지(productImage)를 넣어요(절대 규칙 6). 매시간 후보 발굴보다 먼저, 최대 4개(없으면 0번)
async function fillImages(max = 2) {
  const need = products.filter((p) => !p.hidden && !p.image && !p.imageSkip && !(p.parts || []).some((x) => x.image) && productIdOf(p.domesticCheckUrl)).slice(0, max);
  for (const p of need) {
    if (searchBudgetLeft() <= 0) break;
    const id = productIdOf(p.domesticCheckUrl);
    const keyword = (p.coupangKeyword || p.name).replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
    try {
      const hit = (await search(keyword, 10)).find((h) => String(h.productId) === id && h.productImage);
      if (hit) { p.image = hit.productImage; productsChanged = true; out.push(`- 사진 추가: ${p.slug} (매니저가 사이트에서 사진이 비교 구성과 맞는지 확인, 안 맞으면 image 지우고 imageSkip에 이유)`); }
      else out.push(`- 사진 못 찾음: ${p.slug} (검색어 '${keyword}' 상위 10개에 같은 상품 번호 없음 → coupangKeyword 고치기)`);
    } catch (e) { out.push(`- 사진 확인 실패: ${p.slug} ${String(e.message).slice(0, 80)}`); break; }
  }
}
if (mode === 'images') {
  await fillImages(Number(args[0]) || 4);
  if (productsChanged) writeFileSync(productsFile, JSON.stringify(raw, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `products_changed=${productsChanged}\n`, { flag: 'a' });
  summary(out.join('\n'));
}
if (mode === 'hourly') { await fillImages(4); for (let i = 0; i < 2 && searchBudgetLeft() > 5; i++) await discover(); } // 10/27 22시 운영자: 후보는 웹 검색으로 먼저 찾고 API는 연결·가격 갱신에 → 후보 2개 + 등록 상품 가격 확인 5개

// ---------- 등록 상품 가격 자동 반영 (10/27 운영자 결정: API로 받은 가격은 자동으로 사이트에 반영) ----------
// 안전장치: ① 같은 상품 번호(쿠팡은 옵션 번호 itemId까지 기록돼 있으면 그것도)일 때만 ② 변화가 너무 크면(옵션이 다른 값일 수 있어서) 반영하지 않고 확인 목록에 남겨요
//          ③ 판정(직구각·애매·국내가 나음)이 바뀌는 변화는 반영하지 않고 data/price-alerts.json 에 남겨요(요약 문장과 어긋나지 않게).
const MAX_CHANGE = { withOption: 0.3, noOption: 0.15 }; // 옵션 번호까지 같으면 ±30%, 상품 번호만 같으면 ±15%까지 자동
const kstStamp = () => { const d = new Date(Date.now() + 9 * 3600_000); return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`; };
const itemIdOf = (u = '') => (String(u).match(/[?&]itemId=(\d+)/) || [])[1] || '';
function verdictOf(p) {
  if (p.priceKrw == null || !p.domesticKrw) return null; // 아마존(손익분기만)은 판정 단어가 없어요
  const ship = p.shipKrw || 0;
  const cost = landedCost({ priceUsd: p.priceKrw / FX, shipUsd: ship / FX, origin: p.origin, method: p.method, category: p.category, fx: FX });
  const cif = p.priceKrw + ship;
  const duty = cost.dutyFree ? 0 : Math.floor(cif * cost.rate);
  const total = cost.dutyFree ? cif : cif + duty + Math.floor((cif + duty) * 0.1);
  return judge(p.domesticKrw, total, RULE).verdict;
}
const V3 = { good: '직구각', meh: '애매', bad: '국내가 나음' };
const alertsFile = 'data/price-alerts.json';
const alerts = readJson(alertsFile, { note: '자동 가격 반영 중 사람이 볼 것: 판정이 바뀐 상품(요약 문장 확인) · 변화가 커서 반영 안 한 상품(옵션 확인). 처리하면 지워요.', items: {} });
function applyPrice(p, field, newKrw, source, allowPct) {
  // 국내가에 배송비가 따로 붙는 상품(domesticSource에 '+ 배송비 ₩…')은 API 상품가에 그 배송비를 더해서 비교해요.
  // 10/28 레고 10309: API 57,180원을 그대로 넣어 배송비 10,000원이 빠진 국내가(67,180→57,180)가 사이트에 나갔던 문제.
  const shipM = field === 'domesticKrw' && String(p.domesticSource || '').match(/배송비\s*₩\s*([\d,]+)/);
  if (shipM && newKrw) newKrw += Number(shipM[1].replace(/,/g, ''));
  const old = p[field];
  if (!newKrw || newKrw === old) return 'same';
  const change = Math.abs(newKrw - old) / old;
  if (change > allowPct) {
    alerts.items[`${p.slug}:${field}`] = { at: new Date().toISOString(), slug: p.slug, field, recorded: old, api: newKrw, change: Math.round(change * 100) + '%', reason: `변화가 커서(${Math.round(allowPct * 100)}% 넘음) 반영 안 함. 옵션·판매자 확인 필요`, source };
    return 'held';
  }
  const before = verdictOf(p);
  p[field] = newKrw;
  const after = verdictOf(p);
  // 판정 단어가 바뀌는 변화는 요약 문장과 어긋나니 자동으로 반영하지 않고 사람이 보게 해요(10/27 샤오미 밴드 사례)
  if (before && after && before !== after) {
    p[field] = old;
    alerts.items[`${p.slug}:verdict`] = { at: new Date().toISOString(), slug: p.slug, field, recorded: old, api: newKrw, from: V3[before], to: V3[after], source, reason: '반영하면 판정이 바뀌어요. 실물 확인 후 가격과 요약 문장을 같이 고쳐 주세요(자동 반영 안 함)' };
    return 'held';
  }
  p.checkedAt = `${kstStamp()} ${source} 자동`;
  (p.priceLog ||= []).push({ at: kstStamp(), field, from: old, to: newKrw, source });
  p.priceLog = p.priceLog.slice(-10);
  delete alerts.items[`${p.slug}:${field}`];
  // 요약·주의에 금액을 직접 쓴 문장이 있으면(배송비 6,000·기준 10,000·무료배송 40,000 같은 고정값 빼고) 고치라고 남겨요
  const fixed = /^(6,000|10,000|40,000)$/;
  const stale = [...(p.summary || []), ...(p.risks || [])].filter((t) => (String(t).match(/\d{1,3}(?:,\d{3})+(?=원)|(?<=₩)\d{1,3}(?:,\d{3})+/g) || []).some((n) => !fixed.test(n)));
  if (stale.length) alerts.items[`${p.slug}:text`] = { at: new Date().toISOString(), slug: p.slug, reason: '가격이 바뀌었는데 요약·주의 문장에 금액을 직접 쓴 곳이 있어요. 토큰({diff} 등)으로 바꾸거나 고쳐 주세요', lines: stale.map((t) => String(t).slice(0, 80)) };
  productsChanged = true;
  return 'applied';
}

if (mode === 'prices' || mode === 'hourly') {
  const want = Math.min(Number(args[0]) || 4, searchBudgetLeft());
  const file = 'data/coupang-prices.json';
  const state = readJson(file, { items: {} });
  state.note = '쿠팡 파트너스 검색 API로 등록 상품 국내가 확인. 같은 상품 번호면 자동 반영(큰 변화는 data/price-alerts.json).';
  const lines = [];
  const queue = want <= 0 ? [] : products
    .filter((p) => !p.hidden && productIdOf(p.domesticCheckUrl))
    .sort((a, b) => String(state.items[a.slug]?.at || '').localeCompare(String(state.items[b.slug]?.at || '')))
    .slice(0, want);
  if (want <= 0) lines.push('- 쿠팡: ' + budgetMsg());
  for (const p of queue) {
    const id = productIdOf(p.domesticCheckUrl);
    const wantItem = itemIdOf(p.domesticCheckUrl);
    const keyword = (p.coupangKeyword || p.name).replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
    const item = { productId: id, keyword, at: new Date().toISOString(), recordedKrw: p.domesticKrw };
    try {
      const hits = await search(keyword, 10);
      // productUrl 은 제휴 링크라 열지 않고, 주소 글자에서 옵션 번호(itemId)만 읽어요
      const same = hits.filter((h) => String(h.productId) === id);
      const hit = (wantItem && same.find((h) => itemIdOf(h.productUrl) === wantItem)) || (!wantItem && same[0]) || null;
      // 사진이 없는 상품은 같은 상품 번호의 쿠팡 파트너스 제공 이미지(productImage)를 넣어요(절대 규칙 6: 제휴 프로그램이 주는 사진만). 10/28 아이허브 신규 4개
      const imgHit = same.find((h) => h.productImage);
      if (imgHit && !p.image && !p.imageSkip && !(p.parts || []).some((x) => x.image)) { p.image = imgHit.productImage; productsChanged = true; item.imageAdded = true; }
      if (hit) {
        Object.assign(item, { found: true, apiPrice: hit.productPrice, isRocket: hit.isRocket, diff: hit.productPrice - p.domesticKrw });
        item.result = applyPrice(p, 'domesticKrw', hit.productPrice, '쿠팡', wantItem ? MAX_CHANGE.withOption : MAX_CHANGE.noOption);
      } else Object.assign(item, { found: false, note: same.length ? '같은 상품 번호는 있지만 옵션 번호가 달라요(다른 색·구성일 수 있어 반영 안 함)' : `검색 상위 ${hits.length}개에 같은 상품 번호가 없어요. coupangKeyword 를 더 정확하게` });
    } catch (e) {
      item.error = String(e.message).slice(0, 200);
      state.items[p.slug] = item; lines.push(`- ${p.slug}: ${item.error}`);
      break;
    }
    state.items[p.slug] = item;
    const R = { applied: '사이트 반영', same: '변동 없음', held: '변화 커서 보류' };
    lines.push(`- 쿠팡 ${p.slug}: ${item.found ? `${item.apiPrice.toLocaleString('ko-KR')}원 (기록 ${item.recordedKrw.toLocaleString('ko-KR')}원) ${R[item.result]}` : item.note}`);
  }
  state.updatedAt = new Date().toISOString();
  writeJson(file, state);

  // 알리: 등록 상품 번호로 제휴 API 가격 확인(사이트 /api/item, 쿠팡 검색 횟수와 무관). 오래 확인 안 한 것부터 3개씩
  const aliFile = 'data/ali-prices.json';
  const aliState = readJson(aliFile, { note: '알리 제휴 API로 등록 상품 해외가 확인. 같은 상품 번호면 자동 반영(대표 옵션 값이라 ±15% 넘으면 보류).', items: {} });
  const aliQueue = products
    .filter((p) => !p.hidden && p.store === 'aliexpress' && p.priceKrw != null && /item\/(\d+)\.html/.test(p.overseasCheckUrl || ''))
    .sort((a, b) => String(aliState.items[a.slug]?.at || '').localeCompare(String(aliState.items[b.slug]?.at || '')))
    .slice(0, 3);
  for (const p of aliQueue) {
    const id = p.overseasCheckUrl.match(/item\/(\d+)\.html/)[1];
    const item = { itemId: id, at: new Date().toISOString(), recordedKrw: p.priceKrw };
    try {
      const d = await (await fetch('https://www.jikgugak.com/api/item?id=' + id)).json();
      if (d.ok && d.item.price) {
        Object.assign(item, { found: true, apiPrice: Math.round(d.item.price) });
        // 알리 API 가격은 대표(가장 싼) 옵션 값이라 ±15% 안에서만 자동
        item.result = applyPrice(p, 'priceKrw', item.apiPrice, '알리', MAX_CHANGE.noOption);
      } else Object.assign(item, { found: false, note: d.reason || '응답 없음' });
    } catch (e) { item.error = String(e.message).slice(0, 160); }
    aliState.items[p.slug] = item;
    lines.push(`- 알리 ${p.slug}: ${item.found ? `${item.apiPrice.toLocaleString('ko-KR')}원 (기록 ${item.recordedKrw.toLocaleString('ko-KR')}원) ${{ applied: '사이트 반영', same: '변동 없음', held: '변화 커서 보류' }[item.result]}` : item.note || item.error}`);
  }
  aliState.updatedAt = new Date().toISOString();
  writeJson(aliFile, aliState);

  alerts.updatedAt = new Date().toISOString();
  writeJson(alertsFile, alerts);
  if (productsChanged) writeFileSync(productsFile, JSON.stringify(raw, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `products_changed=${productsChanged}\n`, { flag: 'a' });

  // 인기 검색어 미리 찾아 두기: 사이트 /api/coupang 을 불러요(사이트가 하루 저장·1시간 횟수를 관리해서 쿠팡을 더 부르지 않아요)
  try {
    const t = await (await fetch('https://www.jikgugak.com/api/trending')).json();
    for (const x of (t.items || []).slice(0, 2)) {
      const w = await (await fetch('https://www.jikgugak.com/api/coupang?q=' + encodeURIComponent(x.q))).json().catch(() => ({}));
      lines.push(`- 인기 검색어 '${x.q}': ${w.ok ? `쿠팡 ${w.items.length}개${w.stale ? '(지난 결과)' : ''}` : w.reason || '실패'}`);
    }
  } catch { lines.push('- 인기 검색어 미리 찾기 실패'); }
  const n = Object.keys(alerts.items).length;
  out.push(`가격 확인 쿠팡 ${queue.length}개·알리 ${aliQueue.length}개${productsChanged ? ' (사이트 가격 바뀜)' : ''}${n ? ` · 확인할 것 ${n}개(price-alerts)` : ''}`, ...lines);
  summary(out.join('\n'));
}

if (mode === 'report') {
  // 저장소가 공개라서 주문번호·상품명 같은 상세는 저장하지 않고, 날짜별 합계만 남겨요.
  const days = Number(args[0]) || 7;
  const end = new Date(Date.now() + 9 * 3600_000 - 86400_000); // 어제(KST)
  const start = new Date(end.getTime() - (days - 1) * 86400_000);
  const startDate = ymd(start), endDate = ymd(end);
  const raw = {};
  for (const kind of ['clicks', 'orders', 'commission']) {
    try { raw[kind] = await report(kind, startDate, endDate); } catch (e) { raw[kind] = []; raw.error = String(e.message).slice(0, 200); }
  }
  const byDay = {};
  const day = (d) => (byDay[d] ||= { clicks: 0, orders: 0, gmv: 0, commission: 0 });
  for (const r of raw.clicks || []) day(r.date).clicks += Number(r.click) || 0;
  for (const r of raw.orders || []) { day(r.date).orders += 1; day(r.date).gmv += Number(r.gmv) || 0; }
  for (const r of raw.commission || []) day(r.date).commission += Number(r.commission) || 0;
  const total = Object.values(byDay).reduce((t, d) => ({ clicks: t.clicks + d.clicks, orders: t.orders + d.orders, gmv: t.gmv + d.gmv, commission: t.commission + d.commission }), { clicks: 0, orders: 0, gmv: 0, commission: 0 });
  const file = 'data/coupang-report.json';
  const prev = readJson(file, {});
  const daily = { ...(prev.daily || {}), ...byDay };
  writeJson(file, { note: '쿠팡 파트너스 실적 날짜별 합계(주문 상세는 저장 안 함)', at: new Date().toISOString(), lastWindow: { startDate, endDate, ...total }, daily, ...(raw.error ? { error: raw.error } : {}) });
  summary(`쿠팡 실적 ${startDate}~${endDate}: 클릭 ${total.clicks} · 주문 ${total.orders}건 · 수익 ${total.commission.toLocaleString('ko-KR')}원`, !raw.error);
}
