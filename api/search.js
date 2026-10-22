// 실시간 검색 (Vercel 서버 함수 · /api/search?q=검색어)
// 알리익스프레스 제휴 API(aliexpress.affiliate.product.query)로 상품·원화 가격·제휴 링크를 가져와요.
// 키는 Vercel 환경 변수 ALI_APP_KEY, ALI_APP_SECRET(, ALI_TRACKING_ID)에만 넣어요. 코드·저장소에는 절대 적지 않아요.
import crypto from 'node:crypto';

const API = 'https://api-sg.aliexpress.com/sync';

function send(res, status, body, cacheSec = 0) {
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

async function call(method, biz, { key, secret }, signMethod = 'sha256') {
  const params = { app_key: key, method, timestamp: String(Date.now()), sign_method: signMethod, v: '2.0', format: 'json', ...biz };
  params.sign = sign(params, secret, signMethod);
  const r = await fetch(`${API}?${new URLSearchParams(params)}`);
  return r.json();
}

const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  if (!q) return send(res, 400, { ok: false, reason: 'empty' });

  const key = process.env.ALI_APP_KEY;
  const secret = process.env.ALI_APP_SECRET;
  if (!key || !secret) return send(res, 503, { ok: false, reason: 'not_configured' });

  const biz = {
    keywords: q,
    page_no: '1',
    page_size: '20',
    sort: 'LAST_VOLUME_DESC', // 많이 팔린 순: 검색어와 무관한 신규·무판매 상품이 위로 오는 걸 막아요
    target_currency: 'KRW',
    target_language: 'KO',
    ship_to_country: 'KR',
    tracking_id: process.env.ALI_TRACKING_ID || 'default'
  };

  try {
    let data = await call('aliexpress.affiliate.product.query', biz, { key, secret });
    if (data && data.error_response && /sign/i.test(JSON.stringify(data.error_response))) {
      data = await call('aliexpress.affiliate.product.query', biz, { key, secret }, 'md5');
    }
    const rr = data && data.aliexpress_affiliate_product_query_response && data.aliexpress_affiliate_product_query_response.resp_result;
    if (!rr) return send(res, 502, { ok: false, reason: 'upstream', detail: data && data.error_response ? data.error_response.code || data.error_response.msg : 'no_result' });
    if (String(rr.resp_code) !== '200') {
      // 검색 결과가 없을 때도 resp_code가 200이 아닐 수 있어요
      return send(res, 200, { ok: true, q, source: 'aliexpress', items: [] }, 1800);
    }
    const list = (rr.result && rr.result.products && rr.result.products.product) || [];
    const items = list.map((p) => ({
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
    })).filter((p) => p.price > 0);
    // 액세서리 정리: 가격이 중간값의 25%도 안 되는 상품(케이스·케이블 등)은 아래로 내려요
    const sortedPrices = list2 => list2.map((x) => x.price).sort((a, b) => a - b);
    const ps = sortedPrices(items);
    const median = ps.length ? ps[Math.floor(ps.length / 2)] : 0;
    const main = items.filter((x) => x.price >= median * 0.25);
    const minor = items.filter((x) => x.price < median * 0.25).map((x) => ({ ...x, accessory: true }));
    items.length = 0; items.push(...main, ...minor);
    items.splice(12);
    return send(res, 200, { ok: true, q, source: 'aliexpress', items }, 3600);
  } catch (e) {
    return send(res, 502, { ok: false, reason: 'error' });
  }
}
