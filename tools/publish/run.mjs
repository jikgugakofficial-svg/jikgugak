// 승인된 content/<폴더>/publish.json 을 Postiz CLI로 게시하고 결과를 publish-result.json 에 남겨요.
// publish.json 형식은 tools/publish/README.md 참고. 게시는 운영자가 승인한 것(approved: true)만 해요.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const sh = (args) => execFileSync('postiz', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const json = (out) => { const i = out.search(/[\[{]/); return JSON.parse(out.slice(i)); }; // 앞에 붙는 안내 줄은 건너뛰어요

if (!process.env.POSTIZ_API_KEY) { console.log('POSTIZ_API_KEY 없음: 게시하지 않아요.'); process.exit(0); }

const roots = readdirSync('content', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join('content', d.name));
const jobs = roots.filter((r) => existsSync(path.join(r, 'publish.json')) && !existsSync(path.join(r, 'publish-result.json')));
if (!jobs.length) { console.log('올릴 글 없음'); process.exit(0); }

const integrations = json(sh(['integrations:list']));
const findId = (kind) => (integrations.find((x) => (x.identifier || x.providerIdentifier || '').toLowerCase().startsWith(kind)) || {}).id;

for (const dir of jobs) {
  const job = JSON.parse(readFileSync(path.join(dir, 'publish.json'), 'utf8'));
  const result = { dir, at: new Date().toISOString(), posts: [] };
  if (job.approved !== true) { console.log(`${dir}: 승인 전이라 건너뜀`); continue; }
  const when = job.schedule || new Date(Date.now() + 2 * 60e3).toISOString();
  for (const [kind, spec] of Object.entries(job.channels || {})) {
    const id = findId(kind);
    if (!id) { result.posts.push({ kind, ok: false, error: `${kind} 계정이 Postiz에 연결돼 있지 않아요` }); continue; }
    try {
      const settings = json(sh(['integrations:settings', id]));
      if (settings.output && settings.output.rules) console.log(`[${kind} rules]`, settings.output.rules);
      const media = (spec.images || []).map((f) => json(sh(['upload', path.join(dir, f)])).path);
      const args = ['posts:create', '-s', when, '-i', id];
      for (const [i, text] of (spec.texts || [spec.text || '']).entries()) {
        args.push('-c', text);
        if (i === 0 && media.length) args.push('-m', media.join(','));
      }
      if (spec.settings) args.push('--settings', JSON.stringify(spec.settings));
      const out = sh(args);
      result.posts.push({ kind, ok: true, schedule: when, response: out.slice(0, 2000) });
    } catch (e) {
      result.posts.push({ kind, ok: false, error: String(e.stderr || e.message).slice(0, 2000) });
    }
  }
  writeFileSync(path.join(dir, 'publish-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
