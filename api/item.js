// 붙여 넣은 알리 상품 주소 → 상품 정보·원화 가격·제휴 링크 (/api/item?id=1005...)
// 알리 제휴 API aliexpress.affiliate.productdetail.get 만 써요(긁어 오기 없음).
import { send, aliKeys, aliCall, KR, toItem } from './_lib/ali.js';
import { comparability } from '../src/rank.js';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const id = (url.searchParams.get('id') || '').replace(/\D/g, '').slice(0, 20);
  if (id.length < 9) return send(res, 400, { ok: false, reason: 'bad_id' });
  const keys = aliKeys();
  if (!keys) return send(res, 503, { ok: false, reason: 'not_configured' });
  try {
    const data = await aliCall('aliexpress.affiliate.productdetail.get', { product_ids: id, ...KR() }, keys);
    const rr = data && data.aliexpress_affiliate_productdetail_get_response && data.aliexpress_affiliate_productdetail_get_response.resp_result;
    const list = rr && rr.result && rr.result.products && rr.result.products.product;
    const p = Array.isArray(list) && list[0];
    if (!p) return send(res, 404, { ok: false, reason: 'not_found', detail: (data && data.error_response && data.error_response.code) || (rr && rr.resp_msg) || '' }, 600);
    const it = toItem(p);
    if (!it.price) return send(res, 404, { ok: false, reason: 'no_price' }, 600);
    const c = comparability(it.title || '');
    return send(res, 200, { ok: true, source: 'aliexpress', item: { ...it, brand: c.brand, model: c.model, comparable: c.comparable } }, 1800);
  } catch {
    return send(res, 502, { ok: false, reason: 'error' });
  }
}
