// 방문자 의견(평점·의견·선택 이메일)을 저장해요. 운영자는 jikgugak.com/admin 에서 봐요.
// 저장: Upstash Redis(api/_lib/store.js). 선택: RESEND_API_KEY가 있으면 운영자 메일로도 보내요.
import { redis, storeReady, readBody, YEAR } from './_lib/store.js';

const clean = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

async function mail(rec) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const stars = rec.rating ? '★'.repeat(rec.rating) + '☆'.repeat(5 - rec.rating) : '평점 없음';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.FEEDBACK_FROM || '직구각 의견함 <onboarding@resend.dev>',
      to: [process.env.FEEDBACK_TO || 'jikgugak.official@gmail.com'],
      subject: `[직구각 의견] ${stars}${rec.message ? ' · ' + rec.message.split('\n')[0].slice(0, 40) : ''}`,
      text: `평점: ${stars}\n페이지: ${rec.page || '-'}\n답장 이메일: ${rec.email || '(안 남김)'}\n\n${rec.message || '(의견 없음)'}`,
      ...(rec.email ? { reply_to: rec.email } : {}),
    }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return send(405, { ok: false, reason: 'method' });

  const b = await readBody(req);
  if (b.website) return send(200, { ok: true }); // 스팸 봇용 숨은 칸
  const rec = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    at: new Date().toISOString(),
    rating: Math.max(0, Math.min(5, Math.round(Number(b.rating) || 0))),
    message: clean(b.message, 2000),
    email: clean(b.email, 200),
    page: clean(b.page, 200),
    kind: clean(b.kind, 20) || 'feedback',
    status: 'new',
  };
  if (!rec.rating && !rec.message) return send(400, { ok: false, reason: 'empty' });
  if (rec.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rec.email)) return send(400, { ok: false, reason: 'email' });
  if (!storeReady()) return send(503, { ok: false, reason: 'not_configured' });

  try {
    await redis([
      ['SET', `fb:${rec.id}`, JSON.stringify(rec), 'EX', String(YEAR)],
      ['ZADD', 'fb:index', String(Date.now()), rec.id],
    ]);
  } catch (e) {
    console.error('feedback store', e.message);
    return send(502, { ok: false, reason: 'store_failed' });
  }
  await mail(rec);
  return send(200, { ok: true });
}
