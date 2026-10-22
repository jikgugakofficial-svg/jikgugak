// 방문자 의견(평점·의견·선택 이메일)을 운영자 메일로 보내요. Resend(이메일 발송 서비스) 사용.
// 필요한 Vercel 환경 변수: RESEND_API_KEY(Resend에서 만든 키)
// 선택: FEEDBACK_TO(받는 주소, 기본 jikgugak.official@gmail.com), FEEDBACK_FROM(보내는 주소, 기본 onboarding@resend.dev — 도메인 인증 전엔 Resend 가입 메일로만 보낼 수 있어요)
const TO = process.env.FEEDBACK_TO || 'jikgugak.official@gmail.com';
const FROM = process.env.FEEDBACK_FROM || '직구각 의견함 <onboarding@resend.dev>';

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 20000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
const clean = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return send(405, { ok: false, reason: 'method' });

  const b = await readBody(req);
  if (b.website) return send(200, { ok: true }); // 스팸 봇용 숨은 칸
  const rating = Math.max(0, Math.min(5, Math.round(Number(b.rating) || 0)));
  const message = clean(b.message, 2000);
  const email = clean(b.email, 200);
  const page = clean(b.page, 200);
  const kind = clean(b.kind, 20) || 'feedback';
  if (!rating && !message) return send(400, { ok: false, reason: 'empty' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(400, { ok: false, reason: 'email' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return send(503, { ok: false, reason: 'not_configured' });

  const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '평점 없음';
  const first = message.split('\n')[0].slice(0, 40);
  const when = new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16) + ' KST';
  const text = [
    `평점: ${stars}${rating ? ` (${rating}/5)` : ''}`,
    `받은 때: ${when}`,
    `보낸 페이지: ${page || '-'}`,
    `답장 이메일: ${email || '(안 남김)'}`,
    `종류: ${kind}`,
    '',
    message || '(의견 없음)',
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: `[직구각 의견] ${stars}${first ? ' · ' + first : ''}`,
        text,
        ...(email ? { reply_to: email } : {}),
      }),
    });
    if (!r.ok) {
      console.error('resend', r.status, (await r.text()).slice(0, 300));
      return send(502, { ok: false, reason: 'send_failed' });
    }
    return send(200, { ok: true });
  } catch (e) {
    console.error('resend error', e && e.message);
    return send(502, { ok: false, reason: 'send_failed' });
  }
}
