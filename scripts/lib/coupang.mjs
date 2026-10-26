// 쿠팡 파트너스 공식 Open API 호출 (서버·GitHub Actions 전용, 브라우저에서 쓰지 않아요)
// 키는 환경 변수 COUPANG_ACCESS_KEY · COUPANG_SECRET_KEY 에만 둬요. 저장소·글·채팅에 적지 않아요.
// 서명: CEA algorithm=HmacSHA256, signed-date(yyMMddTHHmmssZ, UTC) + method + path + query 를 Secret Key로 HMAC-SHA256(hex)
import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const HOST = 'https://api-gateway.coupang.com';
const BASE = '/v2/providers/affiliate_open_api/apis/openapi';
export const PATHS = {
  search: `${BASE}/products/search`,
  deeplink: `${BASE}/v1/deeplink`,
  clicks: `${BASE}/v1/reports/clicks`,
  orders: `${BASE}/v1/reports/orders`,
  commission: `${BASE}/v1/reports/commission`
};

// 안전장치: 검색은 1시간 10회 제한(초과 시 403, 반복되면 계정 제한 사례). 우리는 1시간 6회까지만 써요.
// 한 번이라도 403/429가 나면 data/coupang-guard.json 에 멈춤 표시를 남기고, 사람이 지울 때까지 검색을 안 해요.
export const SEARCH_PER_HOUR = 6;
const GUARD = 'data/coupang-guard.json';

export function hasKeys() {
  return Boolean(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY);
}

function signedDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function authorization(method, path, query = '', keys = process.env, date = new Date()) {
  const dt = signedDate(date);
  const signature = crypto.createHmac('sha256', keys.COUPANG_SECRET_KEY).update(dt + method + path + query).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${keys.COUPANG_ACCESS_KEY}, signed-date=${dt}, signature=${signature}`;
}

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

async function call(method, path, { query = '', body } = {}) {
  if (!hasKeys()) throw new Error('쿠팡 API 키가 없어요 (COUPANG_ACCESS_KEY·COUPANG_SECRET_KEY)');
  const res = await fetch(HOST + path + (query ? '?' + query : ''), {
    method,
    headers: { Authorization: authorization(method, path, query), 'Content-Type': 'application/json;charset=UTF-8' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  const rCode = String(json.rCode ?? json.code ?? '');
  if (res.status === 403 || res.status === 429 || rCode === '403' || rCode === '429') {
    const g = readGuard(); g.stoppedAt = new Date().toISOString(); g.stopReason = `${res.status} ${json.rMessage || json.message || ''}`.trim(); writeGuard(g);
    throw new Error(`쿠팡 API가 거부했어요(${res.status}). 안전을 위해 검색을 멈췄어요: data/coupang-guard.json 확인`);
  }
  if (!res.ok || (json.rCode && String(json.rCode) !== '0')) throw new Error(`쿠팡 API 오류 ${res.status}: ${json.rMessage || json.message || text.slice(0, 200)}`);
  return json;
}

// 상품 검색: 결과 최대 10개(productId, productName, productPrice, isRocket, isFreeShipping, productUrl=제휴 링크)
export async function search(keyword, limit = 10) {
  if (searchBudgetLeft() <= 0) throw new Error('이번 1시간 검색 횟수를 다 썼거나 멈춤 상태예요');
  const g = readGuard(); g.calls = [...(g.calls || []).filter((t) => Date.now() - Date.parse(t) < 3600_000), new Date().toISOString()]; writeGuard(g);
  const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
  const json = await call('GET', PATHS.search, { query });
  return json.data?.productData || [];
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
