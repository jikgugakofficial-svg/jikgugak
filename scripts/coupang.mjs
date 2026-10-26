// 쿠팡 파트너스 API 작업 (GitHub Actions 'coupang' 워크플로가 돌려요. 키는 GitHub Secrets에만)
//   node scripts/coupang.mjs check                 → 연결 확인(딥링크 1번 호출, 검색 횟수 안 씀)
//   node scripts/coupang.mjs deeplink <쿠팡 일반 주소…> → 파트너스 링크 만들기(결과는 data/coupang-deeplinks.json)
//   node scripts/coupang.mjs prices [개수]          → 가격 대조(보고만). 오래 확인 안 한 상품부터 몇 개씩 검색해서
//                                                     data/coupang-prices.json 에 API 가격과 사이트 기록값 차이를 남겨요.
//                                                     products.json 은 고치지 않아요(사람이 보고 반영).
//   node scripts/coupang.mjs report [일수]          → 클릭·주문·수익 리포트 → data/coupang-report.json
//   node scripts/coupang.mjs discover               → 자동 후보 발굴 1개: data/candidate-seeds.json 에서 검색어를 하나 꺼내
//                                                     알리(사이트 /api/search)·쿠팡(검색 1회) 가격을 받아 같은 모델끼리 짝지어
//                                                     data/candidates.json 에 남겨요. 사이트에 바로 올리지 않아요(확인 뒤 등록).
//   node scripts/coupang.mjs links <알리 상품번호·쿠팡 일반 주소…> → 새 상품 등록용 링크: 알리는 사이트 /api/item(제휴 링크·사진),
//                                                     쿠팡은 딥링크 → data/new-links.json (링크는 열지 않아요)
//   node scripts/coupang.mjs hourly                 → 예약 실행: discover 6개 + prices 남은 횟수(1시간 7회)
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
if (mode === 'hourly') { for (let i = 0; i < 6 && searchBudgetLeft() > 1; i++) await discover(); } // 후보 6개 + 남은 1회로 가격 대조

if (mode === 'prices' || mode === 'hourly') {
  const want = Math.min(Number(args[0]) || 4, searchBudgetLeft());
  if (want <= 0) { out.push('가격 대조: ' + budgetMsg()); summary(out.join('\n')); process.exit(0); }
  const file = 'data/coupang-prices.json';
  const state = readJson(file, { note: '쿠팡 파트너스 검색 API 대조 결과(보고용). 사이트 가격은 products.json 이 기준이에요.', items: {} });
  const queue = products
    .filter((p) => !p.hidden && productIdOf(p.domesticCheckUrl))
    .sort((a, b) => String(state.items[a.slug]?.at || '').localeCompare(String(state.items[b.slug]?.at || '')))
    .slice(0, want);
  const lines = [];
  for (const p of queue) {
    const id = productIdOf(p.domesticCheckUrl);
    const keyword = (p.coupangKeyword || p.name).replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
    let item = { productId: id, keyword, at: new Date().toISOString(), recordedKrw: p.domesticKrw };
    try {
      const hits = await search(keyword, 10);
      const hit = hits.find((h) => String(h.productId) === id);
      if (hit) Object.assign(item, { found: true, apiPrice: hit.productPrice, isRocket: hit.isRocket, diff: hit.productPrice - p.domesticKrw });
      else Object.assign(item, { found: false, note: `검색 상위 ${hits.length}개에 같은 상품 번호가 없어요. coupangKeyword 를 더 정확하게` });
    } catch (e) {
      item.error = String(e.message).slice(0, 200);
      state.items[p.slug] = item; lines.push(`- ${p.slug}: ${item.error}`);
      break;
    }
    state.items[p.slug] = item;
    lines.push(`- ${p.slug}: ${item.found ? `API ${item.apiPrice.toLocaleString('ko-KR')}원 / 기록 ${p.domesticKrw.toLocaleString('ko-KR')}원 (${item.diff >= 0 ? '+' : ''}${item.diff.toLocaleString('ko-KR')})` : item.note}`);
  }
  state.updatedAt = new Date().toISOString();
  writeJson(file, state);
  // 인기 검색어 미리 찾아 두기: 사이트 /api/coupang 을 불러요(사이트가 하루 저장·1시간 횟수를 관리해서 쿠팡을 더 부르지 않아요)
  try {
    const t = await (await fetch('https://www.jikgugak.com/api/trending')).json();
    for (const x of (t.items || []).slice(0, 2)) {
      const w = await (await fetch('https://www.jikgugak.com/api/coupang?q=' + encodeURIComponent(x.q))).json().catch(() => ({}));
      lines.push(`- 인기 검색어 '${x.q}': ${w.ok ? `쿠팡 ${w.items.length}개${w.stale ? '(지난 결과)' : ''}` : w.reason || '실패'}`);
    }
  } catch { lines.push('- 인기 검색어 미리 찾기 실패'); }
  out.push(`가격 대조 ${queue.length}개 (보고만, 사이트 반영 안 함)`, ...lines);
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
