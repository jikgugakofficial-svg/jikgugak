// N5 알리 국내발송 관세 네이버 글 사진 캡처(로컬 dist, 390px·2배, Pretendard). 2026-10-30-naver-real-jikgugak/capture.mjs와 같은 방식.
// 실행: npm run build && node scripts/serve.mjs(다른 창) → node content/2026-11-09-naver-ali-domestic-ship/capture.mjs content/2026-11-09-naver-ali-domestic-ship/img
// Windows: NODE_PATH=npm 전역 폴더(status.md 7장)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { ensureFonts } from '../../tools/cards/fonts.mjs';
ensureFonts();
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }

const OUT = process.argv[2].replace(/\/?$/, '/');
mkdirSync(OUT, { recursive: true });
const base = 'http://localhost:4173';
const FONT_CSS = `@font-face{font-family:'Pretendard Variable';src:url('/__font/pretendard.ttf');font-weight:100 900}
  *{font-family:'Pretendard Variable',Pretendard,sans-serif!important}
  .logo-word,.hero h1,.num,.vword,.display{font-weight:800!important;letter-spacing:-0.02em}
  .tabbar,.buybar,.topbar{display:none!important}`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const IMG_MAP = existsSync('content/_assets/products/map.json') ? JSON.parse(readFileSync('content/_assets/products/map.json', 'utf8')) : {};
await ctx.route(/coupangcdn|aliexpress-media|alicdn/, (r) => {
  const f = IMG_MAP[r.request().url()];
  if (f && existsSync(f)) return r.fulfill({ contentType: f.endsWith('.png') ? 'image/png' : 'image/jpeg', body: readFileSync(f) });
  return r.abort();
});
await ctx.route(/googleapis|gstatic|jsdelivr|coupa\.ng|vercel|va\.vercel/, (r) => r.abort());
await ctx.route('**/__font/pretendard.ttf', (r) => r.fulfill({ contentType: 'font/ttf', body: readFileSync('tools/cards/fonts/PretendardVariable.ttf') }));
await ctx.route('**/api/**', (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":false}' }));
const p = await ctx.newPage();
const go = async (path, wait = 500) => {
  await p.goto(base + path);
  await p.addStyleTag({ content: FONT_CSS });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(wait);
};
// 위 요소의 top ~ 아래 요소의 bottom
const span = (topSel, botSel, pad = 12) => p.evaluate(([topSel, botSel, pad]) => {
  const pick = (s) => typeof s === 'string' ? document.querySelector(s) : null;
  const t = pick(topSel) || window.__top, bt = pick(botSel) || window.__bot;
  const a = t.getBoundingClientRect(), c = bt.getBoundingClientRect();
  const y = Math.max(0, a.top + scrollY - pad);
  return { x: 0, y, width: 390, height: c.bottom + scrollY + pad - y };
}, [topSel, botSel, pad]);
const shot = async (name, clip) => { await p.screenshot({ path: OUT + name, clip, fullPage: true }); console.log(name, Math.round(clip.width * 2), 'x', Math.round(clip.height * 2)); };

// 01 광군제 페이지 FAQ '알리 국내발송 상품도 관세가 붙나요?' 하나만 펼쳐서
await go('/deals/1111');
await p.evaluate(() => { const d = [...document.querySelectorAll('details.faq')].find((e) => e.querySelector('summary').textContent.includes('국내발송')); d.open = true; window.__top = d; window.__bot = d; });
await shot('01-deals-faq.png', await span(null, null));

// 02 가이드 '한눈에 보는 답' 소제목 ~ 표 끝
await go('/guide/aliexpress-customs-duty');
await p.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((e) => e.textContent.trim() === '한눈에 보는 답'); window.__top = h; let n = h.nextElementSibling; while (n && !n.querySelector?.('table') && n.tagName !== 'TABLE') n = n.nextElementSibling; window.__bot = n; });
await shot('02-guide-table.png', await span(null, null));
await b.close();
