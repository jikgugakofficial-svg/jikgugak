// 광군제 직구각 네이버 글 사진 캡처(로컬 dist, 390px·2배, Pretendard). capture.mjs와 같은 방식.
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

const S = [".vhero", ".cmp", ".match-line"];
await go('/p/ali-edifier-evobuds-pro'); await shot('01-evobuds.png', await box(S));
await go('/p/ali-ugreen-7in1-usbc-hub'); await shot('02-ugreen.png', await box(S));
await go('/p/iherb-cgn-coq10-100-360'); await shot('03-coq10.png', await box(S));
await go('/calculator#cart', 800);
{ const t = await p.$('[data-tab="cart"], #tab-cart, [href="#cart"]'); if (t) { await t.click(); await p.waitForTimeout(400); } }
await shot('04-cart.png', await box(['.calc-tabs', '#panel-cart']));
await b.close();
