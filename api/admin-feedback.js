// 운영자 전용: 받은 의견 목록 보기·처리 표시·삭제. jikgugak.com/admin 화면이 이 주소를 불러요.
// 필요한 Vercel 환경 변수: ADMIN_KEY(운영자만 아는 긴 비밀번호), 저장소 변수(api/_lib/store.js)
import crypto from 'node:crypto';
import { redis, storeReady, readBody } from './_lib/store.js';

const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
  const admin = process.env.ADMIN_KEY;
  if (!admin || admin.length < 12) return send(503, { ok: false, reason: 'admin_not_configured' });
  if (!same(req.headers['x-admin-key'] || '', admin)) { await new Promise((r) => setTimeout(r, 800)); return send(401, { ok: false, reason: 'unauthorized' }); }
  if (!storeReady()) return send(503, { ok: false, reason: 'store_not_configured' });

  try {
    if (req.method === 'GET') {
      const [ids] = await redis([['ZREVRANGE', 'fb:index', '0', '499']]);
      if (!ids || !ids.length) return send(200, { ok: true, items: [] });
      const [vals] = await redis([['MGET', ...ids.map((id) => `fb:${id}`)]]);
      const gone = ids.filter((id, i) => !vals[i]);
      if (gone.length) await redis([['ZREM', 'fb:index', ...gone]]); // 1년 지나 지워진 것 정리
      return send(200, { ok: true, items: vals.filter(Boolean).map((v) => JSON.parse(v)) });
    }
    if (req.method === 'POST') {
      const b = await readBody(req);
      const id = String(b.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
      if (!id) return send(400, { ok: false, reason: 'id' });
      if (b.action === 'delete') { await redis([['DEL', `fb:${id}`], ['ZREM', 'fb:index', id]]); return send(200, { ok: true }); }
      if (b.action === 'done' || b.action === 'new') {
        const [v] = await redis([['GET', `fb:${id}`]]);
        if (!v) return send(404, { ok: false, reason: 'gone' });
        const rec = { ...JSON.parse(v), status: b.action, memo: String(b.memo || '').slice(0, 500) };
        await redis([['SET', `fb:${id}`, JSON.stringify(rec), 'KEEPTTL']]);
        return send(200, { ok: true });
      }
      return send(400, { ok: false, reason: 'action' });
    }
    return send(405, { ok: false, reason: 'method' });
  } catch (e) {
    console.error('admin feedback', e.message);
    return send(502, { ok: false, reason: 'store_failed' });
  }
}
