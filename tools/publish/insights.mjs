// 인스타그램·스레드 성과(도달·조회·프로필 방문·링크 클릭 등)를 Meta 공식 API로 읽어 content/_insights/latest.json 에 남겨요.
// 토큰(IG_TOKEN·THREADS_TOKEN)은 GitHub Secrets에만 있어요. 이 파일은 읽기만 하고 아무것도 올리지 않아요.
//   node tools/publish/insights.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const IG = 'https://graph.instagram.com/v23.0';
const TH = 'https://graph.threads.net/v1.0';
const { IG_TOKEN, THREADS_TOKEN } = process.env;

async function get(base, p, token, params = {}) {
  const u = new URL(base + p);
  for (const [k, v] of Object.entries({ ...params, access_token: token })) u.searchParams.set(k, v);
  const res = await fetch(u);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${p}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  return j;
}
const safe = async (fn) => { try { return await fn(); } catch (e) { return { error: e.message }; } };
const flat = (data = []) => Object.fromEntries(data.map((m) => [m.name, m.total_value?.value ?? m.values?.[0]?.value ?? null]));
const since = Math.floor(Date.now() / 1000) - 7 * 86400;
const until = Math.floor(Date.now() / 1000);

async function instagram() {
  if (!IG_TOKEN) return { error: 'IG_TOKEN 없음' };
  const out = {};
  out.profile = await safe(() => get(IG, '/me', IG_TOKEN, { fields: 'user_id,username,name,biography,website,followers_count,follows_count,media_count,account_type' }));
  out.account7d = await safe(async () => flat((await get(IG, '/me/insights', IG_TOKEN, { metric: 'reach,views,profile_views,website_clicks,accounts_engaged,total_interactions,follows_and_unfollows,profile_links_taps', period: 'day', metric_type: 'total_value', since, until })).data));
  if (out.account7d.error) out.account7dBasic = await safe(async () => flat((await get(IG, '/me/insights', IG_TOKEN, { metric: 'reach,views,profile_views,website_clicks', period: 'day', metric_type: 'total_value', since, until })).data));
  const media = await safe(() => get(IG, '/me/media', IG_TOKEN, { fields: 'id,caption,media_type,permalink,timestamp,like_count,comments_count', limit: '20' }));
  out.media = [];
  for (const m of media.data || []) {
    const ins = await safe(async () => flat((await get(IG, `/${m.id}/insights`, IG_TOKEN, { metric: 'reach,views,saved,shares,total_interactions,profile_visits,profile_activity,follows' })).data));
    const ins2 = ins.error ? await safe(async () => flat((await get(IG, `/${m.id}/insights`, IG_TOKEN, { metric: 'reach,views,saved,shares,total_interactions' })).data)) : null;
    out.media.push({ permalink: m.permalink, timestamp: m.timestamp, type: m.media_type, firstLine: (m.caption || '').split('\n')[0].slice(0, 60), likes: m.like_count, comments: m.comments_count, insights: ins2 || ins, ...(ins2 ? { insightsFullError: ins.error } : {}) });
  }
  if (media.error) out.mediaError = media.error;
  return out;
}

async function threads() {
  if (!THREADS_TOKEN) return { error: 'THREADS_TOKEN 없음' };
  const out = {};
  out.profile = await safe(() => get(TH, '/me', THREADS_TOKEN, { fields: 'id,username,name,threads_biography,is_verified' }));
  out.account7d = await safe(async () => flat((await get(TH, '/me/threads_insights', THREADS_TOKEN, { metric: 'views,likes,replies,reposts,quotes,clicks,followers_count', since, until })).data));
  if (out.account7d.error) out.account7dBasic = await safe(async () => flat((await get(TH, '/me/threads_insights', THREADS_TOKEN, { metric: 'views,likes,replies,followers_count', since, until })).data));
  const posts = await safe(() => get(TH, '/me/threads', THREADS_TOKEN, { fields: 'id,text,permalink,timestamp,media_type,is_reply,topic_tag', limit: '25' }));
  out.posts = [];
  for (const p of posts.data || []) {
    const ins = await safe(async () => flat((await get(TH, `/${p.id}/insights`, THREADS_TOKEN, { metric: 'views,likes,replies,reposts,quotes,shares' })).data));
    out.posts.push({ permalink: p.permalink, timestamp: p.timestamp, topicTag: p.topic_tag, hasLink: /https?:\/\//.test(p.text || ''), firstLine: (p.text || '').split('\n')[0].slice(0, 60), insights: ins });
  }
  if (posts.error) out.postsError = posts.error;
  // 스레드 링크는 첫 글이 아니라 답글에 있어서, 내 답글도 따로 봐요
  const replies = await safe(() => get(TH, '/me/replies', THREADS_TOKEN, { fields: 'id,text,permalink,timestamp', limit: '25' }));
  out.replies = [];
  for (const p of replies.data || []) {
    const ins = await safe(async () => flat((await get(TH, `/${p.id}/insights`, THREADS_TOKEN, { metric: 'views,likes,replies' })).data));
    out.replies.push({ permalink: p.permalink, timestamp: p.timestamp, hasLink: /https?:\/\//.test(p.text || ''), firstLine: (p.text || '').split('\n')[0].slice(0, 60), insights: ins });
  }
  if (replies.error) out.repliesError = replies.error;
  return out;
}

const report = { at: new Date().toISOString(), window: '최근 7일', instagram: await instagram(), threads: await threads() };
mkdirSync('content/_insights', { recursive: true });
writeFileSync('content/_insights/latest.json', JSON.stringify(report, null, 2) + '\n');
writeFileSync(`content/_insights/${report.at.slice(0, 10)}.json`, JSON.stringify(report, null, 2) + '\n');
console.log('인사이트 저장: content/_insights/latest.json');
