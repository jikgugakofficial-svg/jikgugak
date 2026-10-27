// 넾다세일 네이버 글 사진 캡처(로컬 dist, 390px·2배, Pretendard). capture.mjs와 같은 방식.
// 실행: npm run build && node scripts/serve.mjs(다른 창) → cd /home/claude/jikgugak && H3_SELS='[".pd-head",".vhero",".cmp",".match-line"]' node content/2026-10-26-nupda-naver/capture.mjs content/2026-10-26-nupda-naver/img
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { ensureFonts } from '/home/claude/jikgugak/tools/cards/fonts.mjs';
ensureFonts();
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/opt/npm-tools/node_modules/playwright/index.mjs')); }

const OUT = process.argv[2].replace(/\/?$/, '/');
const EXPLORE = process.argv[3] === 'explore';
mkdirSync(OUT, { recursive: true });
const base = 'http://localhost:4173';
const FONT_CSS = `
  *{font-family:'Pretendard Variable',Pretendard,sans-serif!important}
  .logo-word,.hero h1,.dday-circle b,.num,.vword,.display,.ev-date b,.s-vword,.bf-hero h1{font-weight:800!important;letter-spacing:-0.02em}
  .tabbar,.buybar,.topbar,.ev-dday{display:none!important}`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const IMG_MAP = existsSync('content/_assets/products/map.json') ? JSON.parse(readFileSync('content/_assets/products/map.json', 'utf8')) : {};
await ctx.route(/coupangcdn|aliexpress-media|alicdn/, (r) => {
  const f = IMG_MAP[r.request().url()];
  if (f && existsSync(f)) return r.fulfill({ contentType: f.endsWith('.png') ? 'image/png' : 'image/jpeg', body: readFileSync(f) });
  return r.abort();
});
await ctx.route(/googleapis|gstatic|jsdelivr|coupa\.ng|vercel|va\.vercel/, (r) => r.abort());
await ctx.route('**/api/**', (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":false}' }));
const p = await ctx.newPage();
const go = async (path, wait = 500) => {
  await p.goto(base + path);
  await p.addStyleTag({ content: FONT_CSS });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(wait);
};
const box = (sels, pad = 12) => p.evaluate(([sels, pad]) => {
  const rs = sels.map((s) => document.querySelector(s)).filter(Boolean).map((e) => e.getBoundingClientRect());
  const y = Math.max(0, Math.min(...rs.map((r) => r.top + scrollY)) - pad);
  const y2 = Math.max(...rs.map((r) => r.bottom + scrollY)) + pad;
  return { x: 0, y, width: 390, height: y2 - y };
}, [sels, pad]);
const shot = async (name, clip) => { await p.screenshot({ path: OUT + name, clip, fullPage: true }); console.log(name, Math.round(clip.width * 2), 'x', Math.round(clip.height * 2)); };

if (EXPLORE) {
  for (const [n, path] of [['h3', '/p/ali-qcy-h3-anc-headphones'], ['band', '/p/ali-xiaomi-smart-band-10-pro'], ['cal', '/calendar']]) {
    await go(path);
    await p.screenshot({ path: OUT + n + '-full.png', fullPage: true });
    console.log(n, await p.evaluate(() => [...document.querySelectorAll('main > *, main section, .vhero, .cmp, .pd-head, .dom-sale-notice, .receipt')].slice(0, 30).map((e) => `${e.tagName}.${e.className} ${Math.round(e.getBoundingClientRect().top + scrollY)}-${Math.round(e.getBoundingClientRect().bottom + scrollY)}`).join('\n')));
  }
  await b.close();
  process.exit(0);
}

// 1) QCY H3 판정 박스 + 국내/해외 가격 비교(+ 기준 날짜 줄)
await go('/p/ali-qcy-h3-anc-headphones');
await shot('02-h3-verdict.png', await box(JSON.parse(process.env.H3_SELS || '[".vhero", ".cmp"]')));

// 2) 샤오미 밴드 10 프로 판정 박스
await go('/p/ali-xiaomi-smart-band-10-pro');
await shot('01-band-verdict.png', await box(JSON.parse(process.env.H3_SELS || '[".vhero", ".cmp"]')));

// 3) 상품 페이지의 넾다세일 안내 띠(H3)
await go('/p/ali-qcy-h3-anc-headphones');
await shot('03-sale-notice.png', await box(['.dom-sale-notice']));

// 4) 세일 캘린더 '국내 쇼핑몰·브랜드' 필터의 넾다세일 카드
await go('/calendar');
{ const f = await p.$('[data-ev-filter="domestic"]'); if (f) { await f.click(); await p.waitForTimeout(300); } }
await shot('04-calendar-nupda.png', await box(['li.ev[data-id="naver-nupda-2026"]']));

await b.close();
