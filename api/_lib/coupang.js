// 쿠팡 파트너스 공식 Open API 공용 도우미(Vercel 서버 함수·GitHub Actions 스크립트가 같이 써요).
// 키는 환경 변수 COUPANG_ACCESS_KEY · COUPANG_SECRET_KEY 에만(Vercel 환경 변수, GitHub Secrets). 코드·저장소엔 적지 않아요.
// 서명: CEA algorithm=HmacSHA256, signed-date(yyMMddTHHmmssZ, UTC) + method + path + query 를 Secret Key로 HMAC-SHA256(hex)
import crypto from 'node:crypto';

export const HOST = 'https://api-gateway.coupang.com';
const BASE = '/v2/providers/affiliate_open_api/apis/openapi';
export const PATHS = {
  search: `${BASE}/products/search`,
  deeplink: `${BASE}/v1/deeplink`,
  clicks: `${BASE}/v1/reports/clicks`,
  orders: `${BASE}/v1/reports/orders`,
  commission: `${BASE}/v1/reports/commission`
};

export function coupangKeys(env = process.env) {
  return env.COUPANG_ACCESS_KEY && env.COUPANG_SECRET_KEY ? { access: env.COUPANG_ACCESS_KEY, secret: env.COUPANG_SECRET_KEY } : null;
}

function signedDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function authorization(method, path, query, keys, date = new Date()) {
  const dt = signedDate(date);
  const signature = crypto.createHmac('sha256', keys.secret).update(dt + method + path + (query || '')).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${keys.access}, signed-date=${dt}, signature=${signature}`;
}

// 쿠팡이 거부(403·429)하면 blocked:true 로 알려요. 부르는 쪽이 즉시 멈춤 표시를 남겨야 해요.
export async function coupangCall(method, path, { query = '', body } = {}, keys) {
  const res = await fetch(HOST + path + (query ? '?' + query : ''), {
    method,
    headers: { Authorization: authorization(method, path, query, keys), 'Content-Type': 'application/json;charset=UTF-8' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  const rCode = String(json.rCode ?? '');
  const blocked = res.status === 403 || res.status === 429 || rCode === '403' || rCode === '429';
  const ok = res.ok && !blocked && (json.rCode === undefined || rCode === '0');
  return { ok, blocked, status: res.status, json, message: json.rMessage || json.message || '' };
}

// 검색 결과 한 줄을 사이트에서 쓰는 모양으로(사진·링크는 파트너스가 준 것만)
export function toCoupangItem(p) {
  return {
    id: String(p.productId || ''),
    name: String(p.productName || '').slice(0, 140),
    price: Number(p.productPrice) || 0,
    image: String(p.productImage || ''),
    rocket: Boolean(p.isRocket),
    freeShip: Boolean(p.isFreeShipping),
    url: String(p.productUrl || ''),
    rank: Number(p.rank) || 0
  };
}

export async function coupangSearch(keyword, keys, limit = 10) {
  const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
  const r = await coupangCall('GET', PATHS.search, { query }, keys);
  return { ...r, items: r.ok ? (r.json.data?.productData || []).map(toCoupangItem).filter((x) => x.id && x.price > 0) : [] };
}
