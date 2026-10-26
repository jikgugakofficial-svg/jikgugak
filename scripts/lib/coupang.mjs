// 쿠팡 파트너스 공식 Open API — GitHub Actions 스크립트용(서명·호출은 api/_lib/coupang.js 를 같이 써요)
// 키는 환경 변수 COUPANG_ACCESS_KEY · COUPANG_SECRET_KEY 에만 둬요. 저장소·글·채팅에 적지 않아요.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PATHS, coupangKeys, coupangCall, toCoupangItem } from '../../api/_lib/coupang.js';

// 검색 횟수: 쿠팡 제한은 1시간 10회. 사이트 실시간 검색(api/coupang.js)이 4회, 이 스크립트가 2회 → 합쳐 6회.
// 한 번이라도 403/429가 나면 data/coupang-guard.json 에 멈춤 표시를 남기고, 사람이 지울 때까지 검색을 안 해요.
export const SEARCH_PER_HOUR = 2;
const GUARD = 'data/coupang-guard.json';

export const hasKeys = () => Boolean(coupangKeys());

export function readGuard() {
  try { return existsSync(GUARD) ? JSON.parse(readFileSync(GUARD, 'utf8')) : { calls: [] }; } catch { return { calls: [] }; }
}
function writeGuard(g) { writeFileSync(GUARD, JSON.stringify(g, null, 2) + '\n'); }

export function searchBudgetLeft(now = Date.now()) {
  const g = readGuard();
  if (g.stoppedAt) return 0;
  const recent = (g.calls || []).filter((t) => now - Date.parse(t) < 3600_000);
  return Math.max(0, SEARCH_PER_HOUR - recent.length);
}

async function call(method, path, opts) {
  const keys = coupangKeys();
  if (!keys) throw new Error('쿠팡 API 키가 없어요 (COUPANG_ACCESS_KEY·COUPANG_SECRET_KEY)');
  const r = await coupangCall(method, path, opts, keys);
  if (r.blocked) {
    const g = readGuard(); g.stoppedAt = new Date().toISOString(); g.stopReason = `${r.status} ${r.message}`.trim(); writeGuard(g);
    throw new Error(`쿠팡 API가 거부했어요(${r.status}). 안전을 위해 검색을 멈췄어요: data/coupang-guard.json 확인`);
  }
  if (!r.ok) throw new Error(`쿠팡 API 오류 ${r.status}: ${r.message || JSON.stringify(r.json).slice(0, 200)}`);
  return r.json;
}

// 상품 검색: 결과 최대 10개. productUrl 은 제휴 링크라 열지 않아요.
export async function search(keyword, limit = 10) {
  if (searchBudgetLeft() <= 0) throw new Error('이번 1시간 검색 횟수를 다 썼거나 멈춤 상태예요');
  const g = readGuard(); g.calls = [...(g.calls || []).filter((t) => Date.now() - Date.parse(t) < 3600_000), new Date().toISOString()]; writeGuard(g);
  const json = await call('GET', PATHS.search, { query: `keyword=${encodeURIComponent(keyword)}&limit=${limit}` });
  return (json.data?.productData || []).map((p) => ({ ...p, productPrice: Number(p.productPrice) || 0, _item: toCoupangItem(p) }));
}

// 쿠팡 일반 주소 → 파트너스 링크(shortenUrl). 반환 링크는 열지 않아요(절대 규칙 1).
export async function deeplink(urls) {
  const json = await call('POST', PATHS.deeplink, { body: { coupangUrls: urls } });
  return json.data || [];
}

export async function report(kind, startDate, endDate) {
  const json = await call('GET', PATHS[kind], { query: `startDate=${startDate}&endDate=${endDate}` });
  return json.data || [];
}

// 쿠팡 일반 주소에서 상품 번호 꺼내기: https://www.coupang.com/vp/products/9228033952?itemId=… → "9228033952"
export function productIdOf(url = '') {
  const m = String(url).match(/coupang\.com\/vp\/products\/(\d+)/);
  return m ? m[1] : '';
}
