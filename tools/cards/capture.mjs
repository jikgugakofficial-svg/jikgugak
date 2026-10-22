// 카드뉴스용 사이트 화면 캡처. 로컬 빌드(dist)를 http://localhost:4173 에 띄운 뒤 실행:
//   node tools/cards/capture.mjs <출력 폴더>
// 폰트는 카드와 같은 Pretendard 하나로 통일해요(제목용 검은고딕도 Pretendard 굵게로 바꿔 찍음).
// 폰트 파일은 tools/cards/fonts/에 있고, 없으면 자동 설치해요.
import { mkdirSync } from 'node:fs';
import { ensureFonts } from './fonts.mjs';
ensureFonts();
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/opt/npm-tools/node_modules/playwright/index.mjs')); }

const OUT = (process.argv[2] || 'content/_captures').replace(/\/?$/, '/');
mkdirSync(OUT, { recursive: true });
const base = process.env.BASE || 'http://localhost:4173';

// 검색 화면은 실제 API 대신 아래 예시 결과로 찍어요(10.22 실제 검색 결과와 같은 값).
const SEARCH = {
  ok: true,
  mainFound: true,
  items: [
    { id: '1', title: 'UGREEN Uno USB C 허브, 노트북용 분배기 어댑터, 맥북 프로 에어, USB 확장기, 도킹 스테이션', price: 29449, original: 51948, orders: 4309, rating: '96.9%', brand: 'UGREEN', model: '', comparable: true, link: '#', image: '' },
    { id: '2', title: 'UGREEN 12-in-1 USB 허브 타입-C to 2HDMI 4K120Hz DP USB3.2 10Gbps 이더넷 PD 100W', price: 28516, original: 35465, orders: 3550, rating: '96.6%', brand: 'UGREEN', model: '', comparable: true, link: '#', image: '' },
  ],
};

const FONT_CSS = `
  *{font-family:'Pretendard Variable',Pretendard,sans-serif!important}
  .logo-word,.hero h1,.dday-circle b,.num,.vword,.display,.ev-date b,.s-vword,.bf-hero h1{font-weight:800!important;letter-spacing:-0.02em}
  .card-img,.s-img,.tabbar,.buybar,.topbar,.ev-dday,.p-photo{display:none!important}`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.route(/coupangcdn|aliexpress-media|alicdn|googleapis|gstatic|jsdelivr|coupa\.ng/, (r) => r.abort());
await ctx.route('**/api/search*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(SEARCH) }));
const p = await ctx.newPage();

const go = async (path, wait = 400) => {
  await p.goto(base + path);
  await p.addStyleTag({ content: FONT_CSS });
  await p.evaluate(() => document.querySelectorAll('input[placeholder]').forEach((i) => { if (/\d/.test(i.placeholder)) i.placeholder = ''; }));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(wait);
};
const box = (sels, pad = 12) => p.evaluate(([sels, pad]) => {
  const rs = sels.map((s) => (typeof s === 'string' ? document.querySelector(s) : null)).filter(Boolean).map((e) => e.getBoundingClientRect());
  const y = Math.max(0, Math.min(...rs.map((r) => r.top + scrollY)) - pad);
  const y2 = Math.max(...rs.map((r) => r.bottom + scrollY)) + pad;
  return { x: 0, y, width: 390, height: y2 - y };
}, [sels, pad]);
const shot = async (name, clip) => { await p.screenshot({ path: OUT + name, clip, fullPage: true }); console.log(name, Math.round(clip.width), '×', Math.round(clip.height)); };

// 상품 판정: 판정 박스 + 국내/해외 가격 비교(상품명 제목 제외)
await go('/p/ali-ugreen-7in1-usbc-hub.html');
await shot('03-product-compare.png', await box(['.vhero', '.cmp']));

// 계산기(기본 예시 값), 위쪽 판정·신호등·영수증 앞부분
await go('/calculator.html', 600);
{ const c = await box(['.calc-out']); c.height = Math.min(c.height, 470); await shot('05-calculator.png', c); }

// 아마존 손익분기 배너
await go('/p/amazon-lego-10280-flower-bouquet.html');
await shot('06-amazon-banner.png', await box(['.vhero']));

// 검색 결과 2개
await go('/search.html?q=' + encodeURIComponent('유그린 허브'), 800);
await shot('07-search.png', await box(['[data-s-live] .block-head', '.s-item:nth-of-type(2)']));

// 세일 캘린더(해외 직구 필터)
await go('/calendar.html');
{ const f = await p.$('[data-scope="overseas"], .ev-filters button:nth-child(2)'); if (f) { await f.click(); await p.waitForTimeout(300); } }
{ const r = await p.evaluate(() => { const t = document.querySelector('.ev-filters').getBoundingClientRect(); const evs = [...document.querySelectorAll('.ev-body')].filter((e) => e.offsetParent); const e = evs[0]; const l = (e.closest('li,article,div.ev,section') || e).getBoundingClientRect(); return { y: t.top + scrollY, y2: l.bottom + scrollY }; }); await shot('08-calendar.png', { x: 0, y: r.y - 12, width: 390, height: r.y2 - r.y + 24 }); }

// 홈 '국내가 나음' 필터의 D3K2 카드
await go('/');
{ const f = await p.$('[data-filter="bad"]'); if (f) { await f.click(); await p.waitForTimeout(300); } }
{ const r = await p.evaluate(() => { const c = document.querySelector('a.card[href*="vitamin-d3-k2"]'); const rr = c.getBoundingClientRect(); const t = [...c.querySelectorAll('*')].find((e) => /국내 최저가/.test(e.textContent) && !e.children.length); const ty = t ? t.getBoundingClientRect().top : rr.top; return { x: rr.left, y: ty + scrollY, w: rr.width, h: rr.bottom - ty }; }); await shot('02-home-bad-d3k2-badge.png', { x: Math.max(0, r.x - 4), y: r.y - 10, width: Math.min(390, r.w + 8), height: r.h + 14 }); }

await b.close();
