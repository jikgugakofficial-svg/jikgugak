// 실시간 검색 (Vercel 서버 함수 · /api/search?q=검색어)
// 알리익스프레스 제휴 API(aliexpress.affiliate.product.query)로 상품·원화 가격·제휴 링크를 가져와요.
// 키는 Vercel 환경 변수 ALI_APP_KEY, ALI_APP_SECRET(, ALI_TRACKING_ID)에만 넣어요. 코드·저장소에는 절대 적지 않아요.
import { rank, queryVariants } from '../src/rank.js';
import { send, aliKeys, aliCall, KR, toItem } from './_lib/ali.js';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  if (!q) return send(res, 400, { ok: false, reason: 'empty' });

  const keys = aliKeys();
  if (!keys) return send(res, 503, { ok: false, reason: 'not_configured' });

  const base = {
    keywords: q,
    page_no: '1',
    page_size: '50',
    ...KR()
  };
  const debug = url.searchParams.get('debug') === '1';

  async function query(biz) {
    const data = await aliCall('aliexpress.affiliate.product.query', biz, keys);
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
    const items = results.flatMap((r) => r.list || []).map(toItem).filter((p) => p.price > 0 && !seen.has(p.id) && seen.add(p.id));
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
