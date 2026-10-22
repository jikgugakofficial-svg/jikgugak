// 실시간 검색 (Vercel 서버 함수 · /api/search?q=검색어)
// 알리익스프레스 제휴 API(aliexpress.affiliate.product.query)로 상품·원화 가격·제휴 링크를 가져와요.
// 키는 Vercel 환경 변수 ALI_APP_KEY, ALI_APP_SECRET(, ALI_TRACKING_ID)에만 넣어요. 코드·저장소에는 절대 적지 않아요.
import crypto from 'node:crypto';
import { rank, queryVariants } from '../src/rank.js';

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

  const base = {
    keywords: q,
    page_no: '1',
    page_size: '50',
    target_currency: 'KRW',
    target_language: 'KO',
    ship_to_country: 'KR',
    tracking_id: process.env.ALI_TRACKING_ID || 'default'
  };
  const debug = url.searchParams.get('debug') === '1';

  async function query(biz) {
    let data = await call('aliexpress.affiliate.product.query', biz, { key, secret });
    if (data && data.error_response && /sign/i.test(JSON.stringify(data.error_response))) {
      data = await call('aliexpress.affiliate.product.query', biz, { key, secret }, 'md5');
    }
    const rr = data && data.aliexpress_affiliate_product_query_response && data.aliexpress_affiliate_product_query_response.resp_result;
    if (!rr) return { error: data && data.error_response ? data.error_response.code || data.error_response.msg : 'no_result' };
    if (String(rr.resp_code) !== '200') return { list: [] }; // 결과 없음도 200이 아닐 수 있어요
    return { list: (rr.result && rr.result.products && rr.result.products.product) || [] };
  }

  try {
    // 두 가지로 찾아 합쳐요: 기본(검색어 관련도) + 많이 팔린 순. 순위는 src/rank.js가 다시 매겨요.
    // 검색어 후보(원래 말 + 영어로 바꾼 말) × (관련도순, 판매순)
    const variants = queryVariants(q).slice(0, 2);
    const results = await Promise.all(variants.flatMap((kw) => [query({ ...base, keywords: kw }), query({ ...base, keywords: kw, sort: 'LAST_VOLUME_DESC' })]));
    if (results.every((r) => r.error)) return send(res, 502, { ok: false, reason: 'upstream', detail: results[0].error });
    const seen = new Set();
    const items = results.flatMap((r) => r.list || []).map((p) => ({
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
    })).filter((p) => p.price > 0 && !seen.has(p.id) && seen.add(p.id));
    const ranked = rank(items, q, { limit: 12 }).map((x) => {
      if (debug) return x;
      const { _score, _why, ...rest } = x;
      return rest;
    });
    const mainFound = ranked.some((x) => !x.accessory);
    return send(res, 200, { ok: true, q, source: 'aliexpress', items: ranked, mainFound, ...(debug ? { pool: items.length, variants } : {}) }, debug ? 0 : 3600);
  } catch (e) {
    return send(res, 502, { ok: false, reason: 'error' });
  }
}
