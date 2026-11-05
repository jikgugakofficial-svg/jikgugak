// N4 광군제 합산과세 네이버 글 사진 캡처(로컬 dist, 390px·2배, Pretendard). 2026-10-30-naver-real-jikgugak/capture.mjs와 같은 방식.
// 실행: npm run build && node scripts/serve.mjs(다른 창) → node content/2026-11-05-naver-1111-combined/capture.mjs content/2026-11-05-naver-1111-combined/img
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

// 01 가이드 '한눈에 보는 답' 소제목 ~ 표 끝
await go('/guide/same-seller-same-day-combined');
await p.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((e) => e.textContent.trim() === '한눈에 보는 답'); window.__top = h; let n = h.nextElementSibling; while (n && !n.querySelector?.('table') && n.tagName !== 'TABLE') n = n.nextElementSibling; window.__bot = n; });
await shot('01-guide-table.png', await span(null, null));

// 02 M90 체감가 영수증: 영수증 제목 ~ '면세 한도 초과' 줄
await go('/p/ali-edifier-m90-speaker');
await p.evaluate(() => { const r = document.querySelector('.receipt'); window.__top = r; const over = [...document.querySelectorAll('.signal')].find((e) => e.textContent.includes('면세 한도 초과') && (r.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)); window.__bot = over || r; });
await shot('02-m90-receipt.png', await span(null, null));

// 03 장바구니 합산: 유그린 허브 32,724원 1개 → '담은 상품 넣기' ~ 쇼핑몰 상자(면세)
await go('/calculator#cart', 800);
await p.click('#tab-cart'); await p.waitForTimeout(300);
if (!(await p.$('.cart-row'))) { await p.click('[data-cart-blank]'); await p.waitForTimeout(200); }
const row = '.cart-row:first-child';
await p.fill(`${row} [data-k=name]`, '유그린 7in1 USB-C 허브');
await p.selectOption(`${row} [data-k=store]`, 'aliexpress');
await p.selectOption(`${row} [data-k=category]`, 'it');
await p.fill(`${row} [data-k=price]`, '32724');
await p.fill(`${row} [data-k=qty]`, '1');
await p.keyboard.press('Tab'); await p.evaluate(() => document.activeElement?.blur()); await p.waitForTimeout(500);
await p.evaluate(() => { const h = document.querySelector('label[for=cart-q]'); window.__top = h.closest('div,section,form')?.previousElementSibling?.matches?.('h3,h4,.h3') ? h.closest('div,section,form').previousElementSibling : h; window.__bot = document.querySelector('[data-c-boxes]') || document.querySelector('[data-c-signal]'); });
await shot('03-cart.png', await span(null, null));
await b.close();
