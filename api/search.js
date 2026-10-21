// 실시간 국내 최저가 검색 (Vercel 서버 함수 · /api/search?q=검색어)
// 네이버 검색 API 키는 Vercel 환경 변수 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 에만 넣어요. 코드·저장소에는 절대 적지 않아요.
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

function send(res, status, body, cacheSec = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheSec ? `public, s-maxage=${cacheSec}, stale-while-revalidate=86400` : 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  if (!q) return send(res, 400, { ok: false, reason: 'empty' });

  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return send(res, 503, { ok: false, reason: 'not_configured' });

  try {
    const api = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(q)}&display=20&sort=sim&exclude=used:rental:cbshop`;
    const r = await fetch(api, { headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret } });
    if (!r.ok) return send(res, 502, { ok: false, reason: 'upstream', status: r.status });
    const data = await r.json();
    const items = (data.items || [])
      .filter((it) => Number(it.lprice) > 0)
      .slice(0, 12)
      .map((it) => ({
        title: strip(it.title),
        price: Number(it.lprice),
        mall: it.mallName === '네이버' ? '네이버 가격비교' : it.mallName,
        link: it.link,
        image: it.image,
        brand: it.brand || it.maker || '',
        cat: [it.category1, it.category2, it.category3].filter(Boolean)
      }));
    return send(res, 200, { ok: true, q, total: data.total || 0, items }, 21600);
  } catch (e) {
    return send(res, 502, { ok: false, reason: 'error' });
  }
}
