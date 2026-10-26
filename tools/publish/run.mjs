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

// 릴스: spec.video(예: publish/reel.mp4)를 사이트 주소로 올려 두고 REELS 컨테이너로 게시해요. 영상 처리에 몇 분 걸려요.
async function postReel(me, dir, spec) {
  const folder = path.basename(dir);
  const url = `${SITE}/social/${folder}/${path.basename(spec.video)}`;
  await waitUrl(url);
  const creation = (await call(IG, `/${me}/media`, IG_TOKEN, { media_type: 'REELS', video_url: url, caption: spec.text || '', share_to_feed: String(spec.shareToFeed !== false) }, 'POST')).id;
  for (let i = 0; i < 60; i++) {
    const st = await call(IG, `/${creation}`, IG_TOKEN, { fields: 'status_code,status' });
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR') throw new Error(`릴스 처리 오류: ${st.status || ''}`);
    if (i === 59) throw new Error('릴스 처리 시간 초과');
    await sleep(10000);
  }
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
    else if (spec.topicTag) params.topic_tag = spec.topicTag; // 스레드 주제 태그(글당 1개, # 없이)
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


// 게시 직전 환율 확인(publish.json의 fxCheck): 카드·글에 박힌 원화 숫자가 오늘 사이트 환율로도 같은지 봐요.
// 다르면 그 폴더는 올리지 않고 작업을 실패로 끝내요(GitHub가 운영자에게 실패 메일을 보내요). 매니저가 숫자를 고쳐 다시 렌더하면 다음 정시에 올라가요.
//   { usd: 200, rate: 'customs'|'pay', shown: '26만 6천 원', round: '1000'(기본, 천 원 아래 버림)|'10000'(만 원 반올림) }
//   { breakeven: '<상품 slug>', shown: '26만 2천 원' }  ← 아마존 손익분기 달러 × 결제 환율, 천 원 아래 버림
const manwon = (v, round = '1000') => {
  const n = round === '10000' ? Math.round(v / 10000) * 10000 : Math.floor(v / 1000) * 1000;
  const m = Math.floor(n / 10000), c = Math.floor((n % 10000) / 1000);
  return (m ? `${m}만` : '') + (c ? `${m ? ' ' : ''}${c}천` : '') + ' 원';
};
let LIVE = null;
async function fxProblems(job) {
  if (!Array.isArray(job.fxCheck) || !job.fxCheck.length) return [];
  if (!LIVE) LIVE = await (await fetch(`${SITE}/live.json?t=${Date.now()}`)).json();
  const out = [];
  for (const c of job.fxCheck) {
    let now, raw;
    if (c.breakeven) {
      const p = LIVE.products[c.breakeven];
      if (!p || p.breakeven == null) { out.push(`${c.breakeven}: 사이트에 손익분기 값이 없음`); continue; }
      raw = p.breakeven * LIVE.fx.pay; now = manwon(raw);
    } else { raw = c.usd * LIVE.fx[c.rate || 'customs']; now = manwon(raw, c.round); }
    // 천 원 단위 경계에서 하루 환율 몇 원 움직인 것까지 막지 않게: 글 숫자와 실제 값 차이가 2천 원(만 원 반올림이면 7천 원) 이내면 통과
    const shownNum = (String(c.shown).match(/(\d+)\s*만/) || [0, 0])[1] * 10000 + (String(c.shown).match(/(\d+)\s*천/) || [0, 0])[1] * 1000;
    if (Math.abs(raw - shownNum) > (c.round === '10000' ? 7000 : 2000)) out.push(`${c.note || c.breakeven || c.usd + '달러'}: 글에는 "${c.shown}", 오늘 환율로는 "${now}"`);
  }
  return out;
}
let HELD = 0;

const roots = readdirSync('content', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join('content', d.name));
const jobs = roots.filter((r) => existsSync(path.join(r, 'publish.json')) && !existsSync(path.join(r, 'publish-result.json')));
if (!jobs.length) { console.log('올릴 글 없음'); process.exit(0); }

for (const dir of jobs) {
  const job = JSON.parse(readFileSync(path.join(dir, 'publish.json'), 'utf8'));
  if (job.approved !== true) { console.log(`${dir}: 승인 전이라 건너뜀`); continue; }
  if (job.schedule && Date.parse(job.schedule) > Date.now()) { console.log(`${dir}: 예약 ${job.schedule}, 아직 아님`); continue; }
  const probs = await fxProblems(job).catch((e) => [`환율 확인 실패: ${e.message}`]);
  if (probs.length) { HELD++; console.error(`::error::${dir}: 환율이 바뀌어 숫자가 달라져서 게시를 멈췄어요\n  ` + probs.join('\n  ')); continue; }
  const result = { dir, at: new Date().toISOString(), posts: [] };
  for (const [kind, spec] of Object.entries(job.channels || {})) {
    try {
      const acct = kind === 'reels' ? 'instagram' : kind;
      if (!who[acct] || !who[acct].ok) throw new Error(`${kind} 연결 안 됨: ${who[acct] ? who[acct].error : '지원 안 하는 채널'}`);
      const r = kind === 'instagram' ? await postInstagram(who.instagram.id, dir, spec) : kind === 'reels' ? await postReel(who.instagram.id, dir, spec) : await postThreads(who.threads.id, spec);
      result.posts.push({ kind, ok: true, ...r });
    } catch (e) {
      result.posts.push({ kind, ok: false, error: String(e.message).slice(0, 1000) });
    }
  }
  writeFileSync(path.join(dir, 'publish-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
if (HELD) process.exit(1);
