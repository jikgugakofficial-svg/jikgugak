// HTML 광고 굽기 (레퍼런스 키트 방식: seek(t) 순수 함수 + Playwright 프레임 캡처 + 서브프레임 모션 블러)
//   node tools/tvc/render_html.mjs <광고.html> <출력.mp4> [--음악 곡.wav] [--fps 30] [--sub 4] [--w 1080 --h 1920] [--dur 15] [--stills 0.5,2,7.5]
// 광고 HTML 규칙
//   - window.seek(t) 하나가 모든 모양을 그 시각 기준으로 계산(타이머·CSS transition·애니메이션 금지, 프레임 사이에 상태 안 남김)
//   - window.DURATION(초)를 적어 두면 --dur 없이도 길이를 알아요
//   - 소리는 HTML에 넣지 않고 --음악으로 합쳐요
// --sub N: 한 프레임을 N번(시간을 1/(fps*N)씩 밀어) 찍어 평균 → 빠른 움직임에 진짜 모션 블러
// --stills: 그 시각들만 PNG로 찍고 끝(박자마다 점검용)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf(k); if (i < 0) return d; const v = a[i + 1]; a.splice(i, 2); return v; };
const music = opt('--음악', null), fps = +opt('--fps', 30), sub = +opt('--sub', 1);
const W = +opt('--w', 1080), H = +opt('--h', 1920), stills = opt('--stills', null);
let dur = opt('--dur', null);
const [src, out] = a;
if (!src || !out) { console.error('사용법: node tools/tvc/render_html.mjs <광고.html> <출력.mp4> [--음악 곡.wav]'); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto('file://' + path.resolve(src));
await page.evaluate(() => document.fonts.ready);
dur = +(dur ?? await page.evaluate(() => window.DURATION || 15));
const shot = async (t) => { await page.evaluate((t) => window.seek(t), t); return page.screenshot({ type: 'png' }); };

if (stills) {
  const dir = out.replace(/\.mp4$/, '') + '_stills'; fs.mkdirSync(dir, { recursive: true });
  for (const s of stills.split(',').map(Number)) fs.writeFileSync(`${dir}/${s.toFixed(2).padStart(5, '0')}s.png`, await shot(s));
  console.log('정지 화면', dir); await browser.close(); process.exit(0);
}

const N = Math.round(dur * fps);
const tmp = out.replace(/\.mp4$/, '') + '_silent.mp4';
// 서브프레임은 ffmpeg tmix 로 섞어요(키트·레퍼런스 프롬프트 방식)
const vf = sub > 1 ? `tmix=frames=${sub}:weights='${Array(sub).fill(1).join(' ')}',select='not(mod(n\\,${sub}))',setpts=N/${fps}/TB,` : '';
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps * sub), '-i', '-',
  '-vf', vf + 'format=yuv420p', '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let i = 0; i < N; i++) for (let s = 0; s < sub; s++) {
  const t = (i + (s - (sub - 1) / 2) / sub) / fps;
  if (!ff.stdin.write(await shot(Math.max(0, t)))) await new Promise((r) => ff.stdin.once('drain', r));
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await browser.close();
const args = music
  ? ['-y', '-loglevel', 'error', '-i', tmp, '-i', music, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(dur), '-movflags', '+faststart', out]
  : ['-y', '-loglevel', 'error', '-i', tmp, '-c', 'copy', '-movflags', '+faststart', out];
await new Promise((r) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', r));
fs.rmSync(tmp, { force: true });
console.log('광고', out, Math.round(fs.statSync(out).size / 1024), 'KB');
