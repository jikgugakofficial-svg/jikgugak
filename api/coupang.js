// 쿠팡 실시간 검색 (Vercel 서버 함수 · /api/coupang?q=검색어)
// 쿠팡 파트너스 공식 검색 API는 1시간 10회 제한이라, 방문자마다 부르지 않고 이렇게 아껴 써요.
//  1) 같은 검색어 결과는 Redis에 저장해 하루 동안 그대로 써요(7일까지는 '지난 결과'로라도 보여 줘요).
//  2) 새로 묻는 건 사이트 전체에서 1시간 LIVE_PER_HOUR 회까지만(나머지는 GitHub Actions 가격 대조 몫).
//  3) 쿠팡이 한 번이라도 거부(403·429)하면 cp:stop 표시를 남기고, 운영자가 /admin 에서 풀 때까지 새로 묻지 않아요.
// 응답의 url 은 파트너스 제휴 링크예요. 화면에서만 쓰고 서버·직원이 열지 않아요.
// POST { action: 'reset' } + x-admin-key: 멈춤 표시 풀기 / GET ?status=1 + x-admin-key: 상태 보기
import crypto from 'node:crypto';
import { redis, storeReady, readBody } from './_lib/store.js';
import { coupangKeys, coupangSearch } from './_lib/coupang.js';
import { normQ } from './trending.js';

const LIVE_PER_HOUR = 4;
const FRESH_SEC = 24 * 3600;
const KEEP_SEC = 7 * 24 * 3600;
const BLOCK = /(https?:|www\.|@|시발|씨발|병신|개새|섹스|야동|토토|카지노)/i;
const hourKey = () => 'cp:n:' + new Date().toISOString().slice(0, 13).replace(/\D/g, '');
const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function send(res, code, obj, cacheSec = 0) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheSec ? `public, s-maxage=${cacheSec}, stale-while-revalidate=600` : 'no-store');
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const isAdmin = () => process.env.ADMIN_KEY && same(req.headers['x-admin-key'] || '', process.env.ADMIN_KEY);

  if (req.method === 'POST') {
    if (!isAdmin()) return send(res, 401, { ok: false, reason: 'unauthorized' });
    const b = await readBody(req);
    if (b.action === 'reset' && storeReady()) { await redis([['DEL', 'cp:stop']]); return send(res, 200, { ok: true, reset: true }); }
    return send(res, 400, { ok: false });
  }
  if (url.searchParams.get('status') === '1') {
    if (!isAdmin()) return send(res, 401, { ok: false, reason: 'unauthorized' });
    const [stop, n] = storeReady() ? await redis([['GET', 'cp:stop'], ['GET', hourKey()]]) : [null, null];
    return send(res, 200, { ok: true, configured: Boolean(coupangKeys()), stop: stop ? JSON.parse(stop) : null, usedThisHour: Number(n) || 0, perHour: LIVE_PER_HOUR });
  }

  const q = normQ(url.searchParams.get('q'));
  if (q.length < 2 || BLOCK.test(q)) return send(res, 400, { ok: false, reason: 'empty' });
  const keys = coupangKeys();
  if (!keys || !storeReady()) return send(res, 200, { ok: false, reason: 'not_configured' }, 300);

  const ck = 'cp:q:' + q;
  try {
    const [cached, stop] = await redis([['GET', ck], ['GET', 'cp:stop']]);
    const c = cached ? JSON.parse(cached) : null;
    const age = c ? (Date.now() - Date.parse(c.at)) / 1000 : Infinity;
    const out = (data, extra = {}) => send(res, 200, { ok: true, q, source: 'coupang', at: data.at, items: data.items, ...extra }, 600);
    if (c && age < FRESH_SEC) return out(c);
    if (stop) return c ? out(c, { stale: true }) : send(res, 200, { ok: false, reason: 'paused' }, 300);

    // 이번 1시간 새 검색 횟수 확인(넘으면 지난 결과나 '잠시 뒤'로)
    const [n] = await redis([['INCR', hourKey()], ['EXPIRE', hourKey(), '7200']]);
    if (Number(n) > LIVE_PER_HOUR) return c ? out(c, { stale: true }) : send(res, 200, { ok: false, reason: 'busy' }, 120);

    const r = await coupangSearch(q, keys, 10);
    if (r.blocked) {
      await redis([['SET', 'cp:stop', JSON.stringify({ at: new Date().toISOString(), status: r.status, message: String(r.message).slice(0, 120) })]]);
      return c ? out(c, { stale: true }) : send(res, 200, { ok: false, reason: 'paused' }, 300);
    }
    if (!r.ok) return c ? out(c, { stale: true }) : send(res, 200, { ok: false, reason: 'upstream' }, 60);
    const data = { at: new Date().toISOString(), items: r.items };
    await redis([['SET', ck, JSON.stringify(data), 'EX', String(KEEP_SEC)]]);
    return out(data);
  } catch {
    return send(res, 200, { ok: false, reason: 'error' }, 60);
  }
}
