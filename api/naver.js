// 국내 최저가 후보: 네이버 쇼핑 검색 API(공식, developers.naver.com) (/api/naver?q=검색어&model=모델명)
// 키는 Vercel 환경 변수 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET에만. 없으면 not_configured로 답하고 화면은 이 칸을 숨겨요.
// 해외직구(cbshop)·중고·렌털 상품은 빼고 국내 판매 상품만 받아요.
import { send } from './_lib/ali.js';

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const compact = (s) => String(s || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const model = compact(url.searchParams.get('model') || '');
  if (!q) return send(res, 400, { ok: false, reason: 'empty' });
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return send(res, 503, { ok: false, reason: 'not_configured' });
  try {
    const api = `https://openapi.naver.com/v1/search/shop.json?${new URLSearchParams({ query: q, display: '40', sort: 'sim', exclude: 'used:rental:cbshop' })}`;
    const r = await fetch(api, { headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret } });
    if (!r.ok) return send(res, 502, { ok: false, reason: 'upstream', status: r.status });
    const d = await r.json();
    const items = (d.items || []).map((x) => {
      const title = strip(x.title);
      return {
        title,
        price: Number(x.lprice) || 0,
        mall: x.mallName || '',
        link: x.link,
        image: x.image,
        brand: x.brand || '',
        maker: x.maker || '',
        productId: x.productId,
        type: Number(x.productType) || 0, // 1~3: 가격비교 묶음(여러 판매처 최저가)
        modelMatch: model.length >= 3 ? compact(title).includes(model) : null
      };
    }).filter((x) => x.price > 0);
    // 모델명이 들어 있는 상품 → 가격 낮은 순. 모델명이 없으면 관련도 순 그대로.
    const matched = items.filter((x) => x.modelMatch).sort((a, b) => a.price - b.price);
    const rest = items.filter((x) => !x.modelMatch);
    return send(res, 200, { ok: true, source: 'naver', q, model, items: [...matched, ...rest].slice(0, 8), matched: matched.length }, 3600);
  } catch {
    return send(res, 502, { ok: false, reason: 'error' });
  }
}
