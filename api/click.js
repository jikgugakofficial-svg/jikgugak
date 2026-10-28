// 구매(제휴) 링크 클릭 수 집계: 어느 유입 채널(src)에서 온 사람이 어느 쇼핑몰(to)로, 어느 페이지(pg)에서 나갔는지 '합계'만 세요.
// 누가 눌렀는지는 저장하지 않아요. 날짜별 400일 보관. GET은 운영자(ADMIN_KEY)만 최근 30일 합계를 봐요.
import crypto from 'node:crypto';
import { redis, storeReady, readBody } from './_lib/store.js';

const kstDay = (offset = 0) => new Date(Date.now() + 9 * 3600e3 - offset * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
const clean = (s, n) => String(s || '').toLowerCase().replace(/[^a-z0-9/_.-]/g, '').slice(0, n) || '-';
const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const STORES = new Set(['coupang', 'aliexpress', 'amazon', 'iherb', 'naver', 'other', 'app_card', 'app_prompt', 'app_install', 'app_open']); // app_*: 홈 화면 앱 설치 안내·설치·앱으로 열기 횟수

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
  if (!storeReady()) return send(200, { ok: false, reason: 'store_not_configured' });

  if (req.method === 'POST') {
    const b = await readBody(req);
    const to = STORES.has(b.to) ? b.to : 'other';
    // 페이지는 묶어서: /p/상품, /deals/1111, /search, / 등
    const pg = clean(b.page, 60).replace(/^\/p\/.+/, '/p').replace(/^\/social\/.+/, '/social');
    const field = `${clean(b.src, 20)}|${to}|${pg}`;
    const key = `clk:${kstDay()}`;
    try { await redis([['HINCRBY', key, field, '1'], ['EXPIRE', key, String(400 * 86400)]]); } catch { return send(200, { ok: false }); }
    return send(200, { ok: true });
  }

  if (req.method === 'GET') {
    const admin = process.env.ADMIN_KEY;
    if (!admin || !same(req.headers['x-admin-key'] || '', admin)) { await new Promise((r) => setTimeout(r, 800)); return send(401, { ok: false, reason: 'unauthorized' }); }
    const days = Math.min(90, Math.max(1, Number(new URL(req.url, 'http://x').searchParams.get('days')) || 30));
    try {
      const rows = await redis([...Array(days)].map((_, i) => ['HGETALL', `clk:${kstDay(i)}`]));
      const total = {};
      rows.forEach((r) => { for (let i = 0; r && i < r.length; i += 2) total[r[i]] = (total[r[i]] || 0) + Number(r[i + 1]); });
      const items = Object.entries(total).map(([k, n]) => { const [src, to, page] = k.split('|'); return { src, to, page, n }; }).sort((a, b) => b.n - a.n);
      return send(200, { ok: true, days, items });
    } catch { return send(200, { ok: false }); }
  }
  return send(405, { ok: false });
}
