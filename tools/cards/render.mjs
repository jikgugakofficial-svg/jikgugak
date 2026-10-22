// 카드뉴스 이미지 만들기: content/<폴더>/cards.json → content/<폴더>/cards/01.png … (1080×1350, 인스타 4:5)
// 사용법: node tools/cards/render.mjs content/2026-10-22-lego-bouquet
// 규격과 슬라이드 종류는 docs/marketing/card-spec.md 참고. 브랜드 로고·남의 사진은 넣지 않아요.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function loadPlaywright() {
  for (const m of ['playwright', '/opt/npm-tools/node_modules/playwright/index.mjs']) {
    try { return await import(m); } catch {}
  }
  throw new Error('playwright를 찾을 수 없어요. (npx playwright 또는 전역 설치 필요)');
}

const dir = process.argv[2];
if (!dir) { console.error('사용법: node tools/cards/render.mjs content/<폴더>'); process.exit(1); }
const deck = JSON.parse(await readFile(path.join(dir, 'cards.json'), 'utf8'));
const handle = deck.handle || '@jikgugak';
const slides = deck.slides || [];
const N = slides.length;
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const br = (s = '') => esc(s).replace(/\n/g, '<br>');

const TONE = { good: ['#0E7C4A', '#E3F3EA', '직구각'], meh: ['#8A5A00', '#FFF1CC', '애매'], bad: ['#2F5FD0', '#E8EEFC', '국내가 나음'], wait: ['#D23A10', '#FDEDE7', '세일 대기'] };

function slideHtml(s, i) {
  const n = `<div class="num">${i + 1}/${N}</div>`;
  const foot = `<div class="foot"><span class="mark"><b>직구각</b> jikgugak.com</span><span>${esc(handle)}</span></div>`;
  let inner = '';
  switch (s.type) {
    case 'cover':
      inner = `${deck.ad ? '<div class="ad">광고 · 제휴 링크 포함</div>' : ''}
        ${s.kicker ? `<div class="kicker">${br(s.kicker)}</div>` : ''}
        <h1 class="cover-t">${br(s.title)}</h1>
        ${s.sub ? `<p class="cover-s">${br(s.sub)}</p>` : ''}
        ${s.badge ? `<div class="badge">${br(s.badge)}</div>` : ''}`;
      return `<section class="slide cover">${inner}${foot}</section>`;
    case 'compare':
      inner = `<h2>${br(s.title)}</h2>
        <div class="rows">${(s.rows || []).map(([label, value, tone]) => `<div class="row ${tone || ''}"><span>${br(label)}</span><b>${br(value)}</b></div>`).join('')}</div>
        ${s.note ? `<p class="note">${br(s.note)}</p>` : ''}`;
      break;
    case 'verdict': {
      const [c, bg, word] = TONE[s.verdict] || TONE.wait;
      inner = `<div class="vbox" style="--c:${c};--bg:${bg}"><div class="vword">${esc(s.word || word)}</div>${s.line ? `<div class="vline">${br(s.line)}</div>` : ''}</div>
        <h2>${br(s.title)}</h2>${s.body ? `<p class="body">${br(s.body)}</p>` : ''}`;
      break;
    }
    case 'recap':
      inner = `<h2>${br(s.title)}</h2><ol class="recap">${(s.items || []).map((x) => `<li>${br(x)}</li>`).join('')}</ol>`;
      break;
    case 'cta':
      inner = `<h2 class="cta-t">${br(s.title)}</h2>${s.body ? `<p class="body">${br(s.body)}</p>` : ''}<div class="cta-btn">${br(s.button || '프로필 링크 → jikgugak.com')}</div>`;
      return `<section class="slide ctaslide">${n}${inner}${foot}</section>`;
    default: // point
      inner = `${s.label ? `<div class="label">${br(s.label)}</div>` : ''}<h2>${br(s.title)}</h2>${s.body ? `<p class="body">${br(s.body)}</p>` : ''}${s.big ? `<div class="big">${br(s.big)}</div>` : ''}`;
  }
  return `<section class="slide">${n}<div class="content">${inner}</div>${foot}</section>`;
}

const css = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Pretendard Variable','Pretendard','Noto Sans CJK KR','Apple SD Gothic Neo',sans-serif;color:#16181D;-webkit-font-smoothing:antialiased;word-break:keep-all}
.slide{width:1080px;height:1350px;position:relative;background:#fff;padding:150px 130px 170px;display:flex;flex-direction:column;overflow:hidden}
.content{flex:1;display:flex;flex-direction:column;justify-content:center;gap:48px}
.num{position:absolute;top:70px;right:90px;font-size:32px;font-weight:700;color:#6B7280}
.foot{position:absolute;left:90px;right:90px;bottom:64px;display:flex;justify-content:space-between;font-size:30px;color:#6B7280}
.mark b{color:#D23A10;font-weight:900;margin-right:10px}
h2{font-size:86px;line-height:1.22;font-weight:900;letter-spacing:-2px}
.label{display:inline-block;align-self:flex-start;background:#FFE14D;font-size:38px;font-weight:800;padding:10px 22px;border-radius:999px}
.body{font-size:50px;line-height:1.5;color:#3B414D;font-weight:500}
.big{font-size:150px;font-weight:900;color:#D23A10;letter-spacing:-3px}
.cover{background:#D23A10;color:#fff;justify-content:center;gap:36px}
.cover .foot{color:rgba(255,255,255,.85)} .cover .mark b{color:#FFE14D}
.ad{position:absolute;top:70px;left:90px;font-size:30px;font-weight:700;background:rgba(0,0,0,.18);padding:8px 18px;border-radius:999px}
.kicker{font-size:44px;font-weight:800;color:#FFE14D}
.cover-t{font-size:118px;line-height:1.14;font-weight:900;letter-spacing:-4px}
.cover-s{font-size:46px;line-height:1.45;font-weight:600;opacity:.95}
.badge{align-self:flex-start;background:#FFE14D;color:#16181D;font-size:40px;font-weight:900;padding:16px 30px;border-radius:999px}
.rows{display:flex;flex-direction:column;gap:22px}
.row{display:flex;justify-content:space-between;align-items:center;gap:30px;background:#F5F6F8;border-radius:28px;padding:38px 46px;font-size:46px;font-weight:600}
.row b{font-size:60px;font-weight:900;text-align:right}
.row.hi{background:#FDEDE7} .row.hi b{color:#D23A10}
.row.good{background:#E3F3EA} .row.good b{color:#0E7C4A}
.row.dim{background:#fff;border:3px solid #E6E8EC}
.note{font-size:38px;line-height:1.5;color:#6B7280}
.vbox{background:var(--bg);border:6px solid var(--c);border-radius:40px;padding:50px;text-align:center}
.vword{font-size:130px;font-weight:900;color:var(--c);letter-spacing:-4px}
.vline{font-size:44px;font-weight:700;margin-top:12px}
.recap{list-style:none;counter-reset:r;display:flex;flex-direction:column;gap:26px}
.recap li{counter-increment:r;font-size:50px;line-height:1.4;font-weight:700;padding-left:86px;position:relative}
.recap li::before{content:counter(r);position:absolute;left:0;top:-4px;width:62px;height:62px;border-radius:50%;background:#D23A10;color:#fff;font-size:36px;font-weight:900;display:flex;align-items:center;justify-content:center}
.ctaslide{background:#FFF7D1;justify-content:center;gap:44px}
.cta-t{font-size:90px}
.cta-btn{align-self:flex-start;background:#D23A10;color:#fff;font-size:46px;font-weight:900;padding:26px 44px;border-radius:999px}
`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body>${slides.map(slideHtml).join('')}</body></html>`;
const outDir = path.join(dir, 'cards');
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'deck.html'), html);

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
const els = await page.$$('section.slide');
const overflow = [];
for (let i = 0; i < els.length; i++) {
  const over = await els[i].evaluate((el) => [...el.querySelectorAll('h1,h2,.body,.rows,.recap,.vbox,.big,.cover-s,.badge,.cta-btn')].some((c) => c.scrollWidth > c.clientWidth + 2 || c.getBoundingClientRect().bottom > el.getBoundingClientRect().bottom - 140));
  if (over) overflow.push(i + 1);
  await els[i].screenshot({ path: path.join(outDir, String(i + 1).padStart(2, '0') + '.png') });
}
await browser.close();
console.log(`카드 ${els.length}장 → ${outDir}`);
if (overflow.length) console.log(`⚠ 글자가 넘칠 수 있는 장: ${overflow.join(', ')} — 문구를 줄여 주세요`);
