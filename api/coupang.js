// 쿠팡 실시간 검색 (Vercel 서버 함수 · /api/coupang?q=검색어)
// 쿠팡 검색 API 한도: 공식 문서 '1분당 최대 50번', 일별 제한 없음(11/3 운영자가 파트너스 API 화면에서 확인).
// 사이트는 1분 LIVE_PER_MIN 회까지(Actions는 1시간 7회), 합쳐도 1분 50번 아래예요. 403·429가 나면 사이트·Actions 둘 다 멈춰요.
//  1) 같은 검색어 결과는 Redis에 저장해 6시간 동안 그대로 써요(7일까지는 '지난 결과'로라도 보여 줘요).
//  2) 새로 묻는 건 사이트 전체에서 1분 LIVE_PER_MIN 회까지만(나머지는 GitHub Actions 몫과 여유분).
//  3) 쿠팡이 한 번이라도 거부(403·429)하면 cp:stop 표시를 남기고, 운영자가 /admin 에서 풀 때까지 새로 묻지 않아요.
// 응답의 url 은 파트너스 제휴 링크예요. 화면에서만 쓰고 서버·직원이 열지 않아요.
// POST { action: 'reset' } + x-admin-key: 멈춤 표시 풀기 / GET ?status=1 + x-admin-key: 상태 보기
import crypto from 'node:crypto';
import { redis, storeReady, readBody } from './_lib/store.js';
import { coupangKeys, coupangSearch } from './_lib/coupang.js';
import { normQ } from './trending.js';

const LIVE_PER_MIN = 30; // 11/3 공식 한도(1분 50번) 확인 뒤: Actions 몫(한 번에 최대 7회)과 여유 13회를 남겨요.
const FRESH_SEC = 6 * 3600; // 11/3: 한도가 넉넉해져 가격을 더 자주 새로 받아요(하루 → 6시간).
const KEEP_SEC = 7 * 24 * 3600;
const BLOCK = /(https?:|www\.|@|시발|씨발|병신|개새|섹스|야동|토토|카지노)/i;
const hourKey = () => 'cp:n:' + new Date().toISOString().slice(0, 13).replace(/\D/g, '');
const minKey = () => 'cp:m:' + new Date().toISOString().slice(0, 16).replace(/\D/g, '');
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
  // 공개: 멈춤 여부만(true/false). GitHub Actions가 검색 전에 확인해, 사이트가 거부당했으면 같이 멈춰요.
  if (url.searchParams.get('stop') === '1') {
    const [stop] = storeReady() ? await redis([['GET', 'cp:stop']]) : [null];
    return send(res, 200, { ok: true, stop: Boolean(stop) });
  }
  if (url.searchParams.get('status') === '1') {
    if (!isAdmin()) return send(res, 401, { ok: false, reason: 'unauthorized' });
    const [stop, n] = storeReady() ? await redis([['GET', 'cp:stop'], ['GET', hourKey()]]) : [null, null];
    return send(res, 200, { ok: true, configured: Boolean(coupangKeys()), stop: stop ? JSON.parse(stop) : null, usedThisHour: Number(n) || 0, perMin: LIVE_PER_MIN });
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

    // 이번 1분 새 검색 횟수 확인(넘으면 지난 결과나 '잠시 뒤'로). 1시간 합계는 /admin 표시용.
    const [n] = await redis([['INCR', minKey()], ['EXPIRE', minKey(), '120'], ['INCR', hourKey()], ['EXPIRE', hourKey(), '7200']]);
    if (Number(n) > LIVE_PER_MIN) return c ? out(c, { stale: true }) : send(res, 200, { ok: false, reason: 'busy' }, 120);

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
