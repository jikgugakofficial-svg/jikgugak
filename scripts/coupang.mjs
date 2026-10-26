// 쿠팡 파트너스 API 작업 (GitHub Actions 'coupang' 워크플로가 돌려요. 키는 GitHub Secrets에만)
//   node scripts/coupang.mjs check                 → 연결 확인(딥링크 1번 호출, 검색 횟수 안 씀)
//   node scripts/coupang.mjs deeplink <쿠팡 일반 주소…> → 파트너스 링크 만들기(결과는 data/coupang-deeplinks.json)
//   node scripts/coupang.mjs prices [개수]          → 가격 대조(보고만). 오래 확인 안 한 상품부터 몇 개씩 검색해서
//                                                     data/coupang-prices.json 에 API 가격과 사이트 기록값 차이를 남겨요.
//                                                     products.json 은 고치지 않아요(사람이 보고 반영).
//   node scripts/coupang.mjs report [일수]          → 클릭·주문·수익 리포트 → data/coupang-report.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { hasKeys, search, deeplink, report, productIdOf, searchBudgetLeft, readGuard } from './lib/coupang.mjs';

const [mode = 'check', ...cliArgs] = process.argv.slice(2);
const args = cliArgs.length ? cliArgs : String(process.env.ARGS || '').split(/\s+/).filter(Boolean);
const readJson = (f, d) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d; } catch { return d; } };
const writeJson = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
const summary = (s) => { console.log(s); if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, s + '\n', { flag: 'a' }); };

if (!hasKeys()) { summary('쿠팡 API 키가 아직 등록되지 않았어요. 아무것도 하지 않고 끝내요.'); process.exit(0); }

const productsFile = 'data/products.json';
const raw = JSON.parse(readFileSync(productsFile, 'utf8'));
const products = Array.isArray(raw) ? raw : raw.products;

if (mode === 'check') {
  const sample = products.find((p) => productIdOf(p.domesticCheckUrl))?.domesticCheckUrl;
  const out = await deeplink([sample]);
  summary(out.length && out[0].shortenUrl ? `연결 확인 성공: 딥링크 API가 응답했어요 (${out.length}개).` : '연결은 됐지만 딥링크 결과가 비었어요.');
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

if (mode === 'prices') {
  const want = Math.min(Number(args[0]) || 4, searchBudgetLeft());
  if (want <= 0) { const g = readGuard(); summary(g.stoppedAt ? `검색 멈춤 상태예요(${g.stopReason}). 사람이 확인한 뒤 data/coupang-guard.json 의 stoppedAt 을 지워야 다시 돌아요.` : '이번 1시간 검색 횟수를 다 썼어요.'); process.exit(0); }
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
  summary(`가격 대조 ${queue.length}개 (보고만, 사이트 반영 안 함)\n` + lines.join('\n'));
}

if (mode === 'report') {
  const days = Number(args[0]) || 7;
  const end = new Date(Date.now() + 9 * 3600_000 - 86400_000); // 어제(KST)
  const start = new Date(end.getTime() - (days - 1) * 86400_000);
  const out = { at: new Date().toISOString(), startDate: ymd(start), endDate: ymd(end) };
  for (const kind of ['clicks', 'orders', 'commission']) {
    try { out[kind] = await report(kind, out.startDate, out.endDate); } catch (e) { out[kind] = { error: String(e.message).slice(0, 200) }; }
  }
  writeJson('data/coupang-report.json', out);
  const sum = (arr, k) => (Array.isArray(arr) ? arr.reduce((s, r) => s + (Number(r[k]) || 0), 0) : 0);
  summary(`쿠팡 실적 ${out.startDate}~${out.endDate}: 클릭 ${sum(out.clicks, 'click')} · 주문 ${Array.isArray(out.orders) ? out.orders.length : '?'}건 · 수익 ${sum(out.commission, 'commission').toLocaleString('ko-KR')}원`);
}
