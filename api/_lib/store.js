// 의견 저장소: Upstash Redis(Vercel 마켓플레이스에서 연결하면 환경 변수가 자동으로 들어와요). REST로만 써서 패키지가 필요 없어요.
// 환경 변수: KV_REST_API_URL + KV_REST_API_TOKEN (또는 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const storeReady = () => Boolean(URL_ && TOKEN);
export async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error('redis ' + r.status);
  const out = await r.json();
  const err = out.find((x) => x && x.error);
  if (err) throw new Error('redis ' + err.error);
  return out.map((x) => x.result);
}
export const YEAR = 365 * 24 * 3600; // 1년 지나면 자동 삭제(개인정보처리방침)
export function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 20000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
