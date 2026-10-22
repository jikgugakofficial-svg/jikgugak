// 승인된 content/<폴더>/publish.json 을 Meta 공식 API로 인스타그램·스레드에 올리고 결과를 publish-result.json 에 남겨요.
// 형식은 tools/publish/README.md 참고. 운영자가 승인한 것(approved: true)이고 예약 시간이 지난 것만 올려요.
//   node tools/publish/run.mjs          → 올릴 글 게시
//   node tools/publish/run.mjs check    → 토큰 확인만(계정 이름을 content/_publish-status.json 에 기록)
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const IG = 'https://graph.instagram.com/v23.0';
const TH = 'https://graph.threads.net/v1.0';
const SITE = process.env.SITE_URL || 'https://www.jikgugak.com';
const { IG_TOKEN, THREADS_TOKEN } = process.env;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(base, p, token, params = {}, method = 'GET') {
  const u = new URL(base + p);
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = method === 'GET' ? await fetch(u + '?' + body) : await fetch(u, { method, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${p}: ${JSON.stringify(j.error || j).slice(0, 400)}`);
  return j;
}

async function whoami() {
  const out = {};
  if (IG_TOKEN) { try { const j = await call(IG, '/me', IG_TOKEN, { fields: 'user_id,username' }); out.instagram = { ok: true, id: j.user_id || j.id, username: j.username }; } catch (e) { out.instagram = { ok: false, error: e.message }; } }
  else out.instagram = { ok: false, error: 'IG_TOKEN 없음' };
  if (THREADS_TOKEN) { try { const j = await call(TH, '/me', THREADS_TOKEN, { fields: 'id,username' }); out.threads = { ok: true, id: j.id, username: j.username }; } catch (e) { out.threads = { ok: false, error: e.message }; } }
  else out.threads = { ok: false, error: 'THREADS_TOKEN 없음' };
  return out;
}

async function waitUrl(url) {
  for (let i = 0; i < 40; i++) { const r = await fetch(url, { method: 'HEAD' }).catch(() => null); if (r && r.ok) return; await sleep(15000); }
  throw new Error(`이미지가 사이트에 아직 안 올라왔어요: ${url}`);
}

async function postInstagram(me, dir, spec) {
  const folder = path.basename(dir);
  const urls = spec.images.map((f) => `${SITE}/social/${folder}/${path.basename(f)}`);
  if (!urls.length || urls.length > 10) throw new Error('인스타 이미지는 1~10장이어야 해요');
  for (const u of urls) await waitUrl(u);
  const waitReady = async (id) => {
    for (let i = 0; i < 30; i++) { const s = await call(IG, `/${id}`, IG_TOKEN, { fields: 'status_code' }); if (s.status_code === 'FINISHED') return; if (s.status_code === 'ERROR') throw new Error(`컨테이너 오류 ${id}`); await sleep(5000); }
    throw new Error(`컨테이너 준비 시간 초과 ${id}`);
  };
  let creation;
  if (urls.length === 1) {
    creation = (await call(IG, `/${me}/media`, IG_TOKEN, { image_url: urls[0], caption: spec.text || '' }, 'POST')).id;
  } else {
    const children = [];
    for (const u of urls) { const c = (await call(IG, `/${me}/media`, IG_TOKEN, { image_url: u, is_carousel_item: 'true' }, 'POST')).id; children.push(c); }
    for (const c of children) await waitReady(c);
    creation = (await call(IG, `/${me}/media`, IG_TOKEN, { media_type: 'CAROUSEL', children: children.join(','), caption: spec.text || '' }, 'POST')).id;
  }
  await waitReady(creation);
  const media = (await call(IG, `/${me}/media_publish`, IG_TOKEN, { creation_id: creation }, 'POST')).id;
  const info = await call(IG, `/${media}`, IG_TOKEN, { fields: 'permalink' }).catch(() => ({}));
  return { id: media, url: info.permalink };
}

async function postThreads(me, spec) {
  const texts = spec.texts || [spec.text];
  let prev, first;
  for (const t of texts) {
    if (t.length > 500) throw new Error('스레드 글은 500자 이하');
    const params = { media_type: 'TEXT', text: t };
    if (prev) params.reply_to_id = prev;
    const c = (await call(TH, `/${me}/threads`, THREADS_TOKEN, params, 'POST')).id;
    await sleep(5000);
    prev = (await call(TH, `/${me}/threads_publish`, THREADS_TOKEN, { creation_id: c }, 'POST')).id;
    first = first || prev;
    await sleep(3000);
  }
  const info = await call(TH, `/${first}`, THREADS_TOKEN, { fields: 'permalink' }).catch(() => ({}));
  return { id: first, url: info.permalink };
}

const who = await whoami();
if (process.argv[2] === 'check') {
  writeFileSync('content/_publish-status.json', JSON.stringify({ checkedAt: new Date().toISOString(), ...who }, null, 2) + '\n');
  console.log(JSON.stringify(who, null, 2));
  process.exit(0);
}

const roots = readdirSync('content', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join('content', d.name));
const jobs = roots.filter((r) => existsSync(path.join(r, 'publish.json')) && !existsSync(path.join(r, 'publish-result.json')));
if (!jobs.length) { console.log('올릴 글 없음'); process.exit(0); }

for (const dir of jobs) {
  const job = JSON.parse(readFileSync(path.join(dir, 'publish.json'), 'utf8'));
  if (job.approved !== true) { console.log(`${dir}: 승인 전이라 건너뜀`); continue; }
  if (job.schedule && Date.parse(job.schedule) > Date.now()) { console.log(`${dir}: 예약 ${job.schedule}, 아직 아님`); continue; }
  const result = { dir, at: new Date().toISOString(), posts: [] };
  for (const [kind, spec] of Object.entries(job.channels || {})) {
    try {
      if (!who[kind] || !who[kind].ok) throw new Error(`${kind} 연결 안 됨: ${who[kind] ? who[kind].error : '지원 안 하는 채널'}`);
      const r = kind === 'instagram' ? await postInstagram(who.instagram.id, dir, spec) : await postThreads(who.threads.id, spec);
      result.posts.push({ kind, ok: true, ...r });
    } catch (e) {
      result.posts.push({ kind, ok: false, error: String(e.message).slice(0, 1000) });
    }
  }
  writeFileSync(path.join(dir, 'publish-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
