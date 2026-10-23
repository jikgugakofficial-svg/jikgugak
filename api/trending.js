// 직구각 인기 검색어: 검색 화면이 검색할 때마다 POST로 1번 세고, GET으로 최근 7일 상위 5개를 돌려줘요.
// 저장: Upstash Redis(api/_lib/store.js). 검색어와 횟수만 날짜별로 8일 보관해요(누가 검색했는지는 저장하지 않아요).
import { redis, storeReady, readBody } from './_lib/store.js';

const MIN_COUNT = 2; // 2번 이상 검색된 것만 순위에 올려요
const BLOCK = /(https?:|www\.|@|\d{7,}|시발|씨발|병신|개새|섹스|야동|토토|카지노)/i;
const kstDay = (offset = 0) => new Date(Date.now() + 9 * 3600e3 - offset * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
export const normQ = (q) => String(q || '').replace(/[\u0000-\u001F]/g, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 30);

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (code, obj, cache = 0) => { res.statusCode = code; res.setHeader('Cache-Control', cache ? `public, s-maxage=${cache}, stale-while-revalidate=600` : 'no-store'); res.end(JSON.stringify(obj)); };
  if (!storeReady()) return send(200, { ok: false, reason: 'not_configured', items: [] }, 60);

  if (req.method === 'POST') {
    const b = await readBody(req);
    const q = normQ(b.q);
    if (q.length < 2 || BLOCK.test(q)) return send(200, { ok: true, counted: false });
    const key = `sq:${kstDay()}`;
    try { await redis([['ZINCRBY', key, '1', q], ['EXPIRE', key, String(8 * 86400)]]); } catch { return send(200, { ok: false }); }
    return send(200, { ok: true, counted: true });
  }

  if (req.method === 'GET') {
    try {
      const days = [...Array(7)].map((_, i) => `sq:${kstDay(i)}`);
      const rows = await redis(days.map((k) => ['ZREVRANGE', k, '0', '49', 'WITHSCORES']));
      const sum = new Map();
      for (const r of rows) for (let i = 0; r && i < r.length; i += 2) sum.set(r[i], (sum.get(r[i]) || 0) + Number(r[i + 1]));
      const items = [...sum.entries()].filter(([, n]) => n >= MIN_COUNT).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([q, n]) => ({ q, n }));
      return send(200, { ok: true, items, enough: items.length >= 5 }, 300);
    } catch { return send(200, { ok: false, items: [] }, 60); }
  }
  return send(405, { ok: false });
}
