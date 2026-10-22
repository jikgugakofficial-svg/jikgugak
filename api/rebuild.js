// 매일 사이트 다시 만들기 (Vercel Cron이 호출 · vercel.json의 crons)
// 다시 만들 때 scripts/fx.mjs가 최신 환율을 받아와서 모든 판정이 그날 환율로 바뀌어요.
// 필요한 Vercel 환경 변수: VERCEL_DEPLOY_HOOK(배포 훅 주소), CRON_SECRET(아무 긴 문자열, Vercel이 자동으로 요청에 붙여 줘요)
export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  const secret = process.env.CRON_SECRET;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (!secret || auth !== `Bearer ${secret}`) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, reason: 'unauthorized' }));
  }
  const hook = process.env.VERCEL_DEPLOY_HOOK;
  if (!hook) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, reason: 'not_configured' }));
  }
  try {
    const r = await fetch(hook, { method: 'POST' });
    res.statusCode = r.ok ? 200 : 502;
    return res.end(JSON.stringify({ ok: r.ok, status: r.status }));
  } catch (e) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, reason: 'error' }));
  }
}
