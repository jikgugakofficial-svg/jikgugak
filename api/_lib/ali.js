// 알리익스프레스 제휴 API 공용 도우미(검색·상품 상세가 같이 써요). 키는 Vercel 환경 변수 ALI_APP_KEY, ALI_APP_SECRET(, ALI_TRACKING_ID)에만.
import crypto from 'node:crypto';

const API = 'https://api-sg.aliexpress.com/sync';

export function send(res, status, body, cacheSec = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheSec ? `public, s-maxage=${cacheSec}, stale-while-revalidate=3600` : 'no-store');
  res.end(JSON.stringify(body));
}

// 서명: 파라미터를 키 이름순으로 붙인 문자열을 HMAC-SHA256(시크릿)으로 (대문자 16진수)
// 플랫폼이 서명 방식을 거절하면 예전 방식(MD5, 시크릿으로 앞뒤 감싸기)으로 한 번 더 시도해요.
function sign(params, secret, method) {
  const base = Object.keys(params).sort().map((k) => k + params[k]).join('');
  return method === 'md5'
    ? crypto.createHash('md5').update(secret + base + secret, 'utf8').digest('hex').toUpperCase()
    : crypto.createHmac('sha256', secret).update(base, 'utf8').digest('hex').toUpperCase();
}

export function aliKeys() {
  const key = process.env.ALI_APP_KEY;
  const secret = process.env.ALI_APP_SECRET;
  return key && secret ? { key, secret } : null;
}

export async function aliCall(method, biz, keys) {
  const go = async (signMethod) => {
    const params = { app_key: keys.key, method, timestamp: String(Date.now()), sign_method: signMethod, v: '2.0', format: 'json', ...biz };
    params.sign = sign(params, keys.secret, signMethod);
    const r = await fetch(`${API}?${new URLSearchParams(params)}`);
    return r.json();
  };
  let data = await go('sha256');
  if (data && data.error_response && /sign/i.test(JSON.stringify(data.error_response))) data = await go('md5');
  return data;
}

export const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };

export const KR = () => ({ target_currency: 'KRW', target_language: 'KO', ship_to_country: 'KR', tracking_id: process.env.ALI_TRACKING_ID || 'default' });

// 알리 상품 객체 → 화면에 쓰는 모양
export function toItem(p) {
  return {
    id: String(p.product_id),
    title: p.product_title,
    price: num(p.target_sale_price || p.sale_price),
    original: num(p.target_original_price || p.original_price),
    image: p.product_main_image_url,
    link: p.promotion_link || p.product_detail_url,
    orders: num(p.lastest_volume),
    rating: p.evaluate_rate || '',
    shop: p.shop_name || '',
    category: p.first_level_category_name || ''
  };
}
