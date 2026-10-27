// 카드뉴스 이미지 만들기: content/<폴더>/cards.json → content/<폴더>/cards/01.png … (1080×1350, 인스타 4:5)
// 사용법: node tools/cards/render.mjs content/2026-10-22-lego-bouquet
// 규격과 슬라이드 종류는 docs/marketing/card-spec.md 참고. 브랜드 로고·남의 사진은 넣지 않아요.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureFonts } from './fonts.mjs';
ensureFonts();

async function loadPlaywright() {
  for (const m of ['playwright', '/opt/npm-tools/node_modules/playwright/index.mjs']) {
    try { return await import(m); } catch {}
  }
  throw new Error('playwright를 찾을 수 없어요. (npx playwright 또는 전역 설치 필요)');
}

const dir = process.argv[2];
if (!dir) { console.error('사용법: node tools/cards/render.mjs content/<폴더>'); process.exit(1); }
const deck = JSON.parse(await readFile(path.join(dir, 'cards.json'), 'utf8'));
const handle = deck.handle || '@jikgugak.official';
const slides = deck.slides || [];
const N = slides.length;
const imgCache = {};
const imgRatio = {};
async function dataUrl(rel) {
  if (!rel) return '';
  if (!imgCache[rel]) {
    const buf = await readFile(path.join(dir, rel));
    const ext = rel.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    imgCache[rel] = `data:image/${ext};base64,${buf.toString('base64')}`;
    // PNG 가로세로 비율: 넓은 캡처는 통째로(contain), 긴 캡처는 위쪽부터 칸 너비에 맞춰(cover)
    if (ext === 'png' && buf.length > 24) imgRatio[rel] = buf.readUInt32BE(16) / buf.readUInt32BE(20);
  }
  return imgCache[rel];
}
for (const s of slides) if (s.image) await dataUrl(s.image);
// profile-cta 장의 프로필 사진 자리: 직구각 로고(brand/profile-1080.png). 다른 그림은 "avatar": "img/…"로 바꿀 수 있어요.
let profileAvatar = '';
const pcSlide = slides.find((s) => s.type === 'profile-cta');
if (pcSlide) {
  try {
    if (pcSlide.avatar) profileAvatar = await dataUrl(pcSlide.avatar);
    else profileAvatar = `data:image/png;base64,${(await readFile(new URL('../../brand/profile-1080.png', import.meta.url))).toString('base64')}`;
  } catch { console.log('⚠ 프로필 로고(brand/profile-1080.png)를 못 읽어 빈 동그라미로 그려요'); }
}
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const br = (s = '') => esc(s).replace(/\n/g, '<br>');

const TONE = { good: ['#0E7C4A', '#E3F3EA', '직구각'], meh: ['#8A5A00', '#FFF1CC', '애매'], bad: ['#2F5FD0', '#E8EEFC', '국내가 나음'], wait: ['#D23A10', '#FDEDE7', '세일 대기'] };

function slideHtml(s, i) {
  const n = `<div class="num">${i + 1}/${N}</div>`;
  const foot = `<div class="foot"><span class="mark"><b>직구각</b> jikgugak.com</span><span>${esc(handle)}</span></div>`;
  let inner = '';
  switch (s.type) {
    case 'shock': // 자극적인 표지: 아주 큰 숫자 한 개 + 짧은 제목 + 도장 + 상품 사진
      inner = `${deck.ad ? '<div class="ad">광고 · 제휴 링크 포함</div>' : ''}
        <div class="sk-top">${s.kicker ? `<div class="kicker">${br(s.kicker)}</div>` : ''}
        <div class="sk-big${s.strike ? ' strike' : ''}" style="font-size:${Math.min(250, Math.floor(800 / (Math.max(...String(s.big).split('\n').map((l) => l.length)) * 0.6)))}px">${br(s.big)}</div>
        <h1 class="sk-t">${br(s.title)}</h1>
        ${s.sub ? `<p class="sk-s">${br(s.sub)}</p>` : ''}</div>
        ${s.image ? `<div class="sk-img"><img src="${imgCache[s.image]}" alt=""></div>` : ''}
        ${s.stamp ? `<div class="sk-stamp">${br(s.stamp)}</div>` : ''}
        ${s.swipe !== false && deck.swipe !== false ? `<div class="swipe">넘겨서 확인 →</div>` : ''}`;
      return `<section class="slide cover shock${s.image ? ' has-img' : ''}">${inner}${foot}</section>`;
    case 'cover':
      inner = `${deck.ad ? '<div class="ad">광고 · 제휴 링크 포함</div>' : ''}
        ${s.kicker ? `<div class="kicker">${br(s.kicker)}</div>` : ''}
        <h1 class="cover-t">${br(s.title)}</h1>
        ${s.sub ? `<p class="cover-s">${br(s.sub)}</p>` : ''}
        ${s.badge ? `<div class="badge">${br(s.badge)}</div>` : ''}
        ${s.vs ? `<div class="cover-vs">${s.vs.map(([k, v], j) => `<div class="vs-box${j === s.vs.length - 1 ? ' hi' : ''}"><span>${br(k)}</span><b>${br(v)}</b></div>`).join('<i>vs</i>')}</div>` : ''}
        ${s.image ? `<div class="cover-img"><img src="${imgCache[s.image]}" alt=""></div>` : ''}
        ${deck.series ? `<div class="series">${esc(deck.series)}</div>` : ''}
        ${s.swipe !== false && deck.swipe !== false ? `<div class="swipe">넘겨서 확인 →</div>` : ''}`;
      return `<section class="slide cover${s.image ? ' has-img' : ''}">${inner}${foot}</section>`;
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
    case 'profile-cta': { // 마지막 장: 직구각 프로필 화면 목업에서 링크 위치를 주황 테두리로 짚어 줌(팔로워 숫자·남의 사진 없음)
      const link = esc(s.link || 'www.jikgugak.com');
      const chain = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#1F2E57" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';
      inner = `<h2 class="pc-t">${br(s.title || '상품별 판정은\n프로필 링크에서')}</h2>${s.body ? `<p class="body pc-b">${br(s.body)}</p>` : ''}
        <div class="pf-card">
          <div class="pf-top">${esc(handle.replace(/^@/, ''))}</div>
          <div class="pf-head">${profileAvatar ? `<img class="pf-av" src="${profileAvatar}" alt="">` : '<div class="pf-av"></div>'}<div class="pf-name">${esc(s.name || '직구각')}</div></div>
          <p class="pf-bio">${br(s.bio || "해외직구, 어렵게 재지 말고\n'직구각'에서 각 잡으세요")}</p>
          <div class="pf-link">${chain}<span>${link}</span></div>
          <div class="pf-point">↑ ${br(s.point || '여기를 누르면 상품별 판정')}</div>
          <div class="pf-btns"><span class="on">팔로우</span><span>메시지</span></div>
        </div>`;
      return `<section class="slide pcslide">${n}${inner}${foot}</section>`;
    }
    case 'shot': // 사이트 화면 캡처를 크게 보여 주는 장
      inner = `${s.label ? `<div class="label">${br(s.label)}</div>` : ''}<h2 class="shot-t">${br(s.title)}</h2><div class="shot${(imgRatio[s.image] || 0) >= 1.25 ? ' wide' : ''}"><img src="${imgCache[s.image] || ''}" alt=""></div>${s.body ? `<p class="body shot-b">${br(s.body)}</p>` : ''}`;
      return `<section class="slide shotslide">${n}<div class="content">${inner}</div>${foot}</section>`;
    default: // point
      inner = `${s.label ? `<div class="label">${br(s.label)}</div>` : ''}<h2>${br(s.title)}</h2>${s.body ? `<p class="body">${br(s.body)}</p>` : ''}${s.big ? `<div class="big">${br(s.big)}</div>` : ''}${s.image ? `<div class="pt-img"><img src="${imgCache[s.image]}" alt=""></div>` : ''}`;
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
.label{display:inline-block;align-self:flex-start;background:#1F2E57;color:#fff;font-size:38px;font-weight:800;padding:10px 22px;border-radius:999px}
.body{font-size:50px;line-height:1.5;color:#3B414D;font-weight:500}
.big{font-size:150px;font-weight:900;color:#D23A10;letter-spacing:-3px}
.cover{background:#D23A10;color:#fff;justify-content:center;gap:36px}
.cover .foot{color:rgba(255,255,255,.85)} .cover .mark b{color:#FFC7A6}
.ad{position:absolute;top:70px;left:90px;font-size:32px;font-weight:700;background:rgba(0,0,0,.18);padding:8px 18px;border-radius:999px}
.kicker{font-size:44px;font-weight:800;color:#FFC7A6}
.cover-t{font-size:118px;line-height:1.14;font-weight:900;letter-spacing:-4px}
.cover-s{font-size:46px;line-height:1.45;font-weight:600;opacity:.95}
.cover.has-img{justify-content:flex-start;padding-top:140px;gap:26px}
.cover.has-img .cover-t{font-size:104px}
.cover-img{margin-top:auto;align-self:center;width:520px;height:520px;background:#fff;border-radius:44px;padding:26px;box-shadow:0 18px 40px rgba(0,0,0,.18)}
.cover-vs ~ .cover-img{width:330px;height:330px;padding:18px;border-radius:36px}
.shock{justify-content:flex-start;padding-top:150px}
.sk-top{display:flex;flex-direction:column;gap:14px;position:relative;z-index:2}
.sk-big{line-height:1;font-weight:900;letter-spacing:-0.04em;color:#fff;margin:4px 0;text-shadow:0 10px 0 rgba(0,0,0,.14);white-space:nowrap}
.sk-big.strike{position:relative;align-self:flex-start;color:rgba(255,255,255,.92)}
.sk-big.strike:after{content:'';position:absolute;left:-12px;right:-12px;top:52%;height:20px;background:#1F2E57;transform:rotate(-6deg);border-radius:12px}
.sk-t{font-size:96px;line-height:1.14;font-weight:900;letter-spacing:-4px}
.sk-s{font-size:40px;font-weight:600;opacity:.92;margin-top:4px}
.sk-img{position:absolute;right:90px;bottom:205px;width:340px;height:340px;background:#fff;border-radius:44px;padding:22px;box-shadow:0 24px 50px rgba(0,0,0,.25);transform:rotate(4deg);z-index:1}
.sk-img img{width:100%;height:100%;object-fit:contain;display:block}
.sk-stamp{position:absolute;left:120px;bottom:210px;z-index:3;background:#1F2E57;color:#fff;font-size:46px;font-weight:900;padding:22px 34px;border-radius:24px;transform:rotate(-6deg);box-shadow:0 14px 30px rgba(0,0,0,.25);border:5px solid #fff}
.shock .swipe{bottom:110px}
.cover-img img,.pt-img img{width:100%;height:100%;object-fit:contain;display:block}
.pt-img{align-self:center;width:420px;height:420px;background:#fff;border:3px solid #E6E8EC;border-radius:36px;padding:20px}
.shotslide{padding:120px 100px 150px}
.shotslide .content{justify-content:flex-start;gap:28px;min-height:0}
.shot-t{font-size:70px}
.shot{flex:1 1 0;min-height:0;position:relative;background:#F5F6F8;border-radius:36px;overflow:hidden}
.shot img{position:absolute;inset:28px;width:calc(100% - 56px);height:calc(100% - 56px);object-fit:cover;object-position:center top;border-radius:20px;filter:drop-shadow(0 12px 24px rgba(22,24,29,.14))}
.shot.wide img{object-fit:contain}
.shot-b{font-size:42px}
.series{position:absolute;top:66px;right:90px;font-size:38px;font-weight:800;color:#FFC7A6;letter-spacing:1px}
.swipe{position:absolute;right:90px;bottom:120px;font-size:32px;font-weight:800;color:#fff;opacity:.9}
.cover-vs{display:flex;align-items:center;gap:22px;margin-top:10px}
.cover-vs i{font-style:normal;font-weight:900;font-size:40px;color:#FFC7A6}
.vs-box{flex:1;background:rgba(255,255,255,.14);border-radius:28px;padding:26px 30px;display:flex;flex-direction:column;gap:6px}
.vs-box span{font-size:34px;font-weight:700;opacity:.9}
.vs-box b{font-size:62px;font-weight:900;letter-spacing:-2px}
.vs-box.hi{background:#1F2E57;color:#fff}
.badge{align-self:flex-start;background:#1F2E57;color:#fff;font-size:40px;font-weight:900;padding:16px 30px;border-radius:999px}
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
.ctaslide{background:#EEF2FA;justify-content:center;gap:44px}
.cta-t{font-size:90px}
.cta-btn{align-self:flex-start;background:#D23A10;color:#fff;font-size:46px;font-weight:900;padding:26px 44px;border-radius:999px}
.pcslide{background:#EEF2FA;padding:120px 110px 170px;gap:36px;justify-content:center}
.pc-t{font-size:80px}
.pc-b{font-size:42px;margin-top:-12px}
.pf-card{background:#fff;border-radius:48px;padding:38px 52px 42px;box-shadow:0 20px 50px rgba(31,46,87,.14);display:flex;flex-direction:column;gap:22px}
.pf-top{font-size:40px;font-weight:800;padding-bottom:20px;border-bottom:3px solid #EEF0F3}
.pf-head{display:flex;align-items:center;gap:34px}
.pf-av{width:136px;height:136px;border-radius:50%;background:#D23A10;object-fit:cover;flex:none}
.pf-name{font-size:52px;font-weight:900}
.pf-bio{font-size:38px;line-height:1.45;color:#3B414D;font-weight:500}
.pf-link{align-self:flex-start;display:flex;align-items:center;gap:14px;font-size:42px;font-weight:800;color:#1F2E57;border:7px solid #D23A10;background:#FDEDE7;border-radius:22px;padding:14px 26px 14px 20px;margin-left:-26px}
.pf-point{font-size:38px;font-weight:900;color:#D23A10;margin-top:-10px}
.pf-btns{display:flex;gap:18px}
.pf-btns span{flex:1;text-align:center;font-size:36px;font-weight:800;padding:18px 0;border-radius:18px;background:#F0F1F4;color:#16181D}
.pf-btns span.on{background:#1F2E57;color:#fff}
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
  const over = await els[i].evaluate((el) => [...el.querySelectorAll('h1,h2,.body,.rows,.recap,.vbox,.big,.cover-s,.badge,.cta-btn,.cover-img,.pt-img,.shot,.pf-card')].some((c) => c.scrollWidth > c.clientWidth + 2 || c.getBoundingClientRect().bottom > el.getBoundingClientRect().bottom - 140));
  if (over) overflow.push(i + 1);
  await els[i].screenshot({ path: path.join(outDir, String(i + 1).padStart(2, '0') + '.png') });
}
await browser.close();
console.log(`카드 ${els.length}장 → ${outDir}`);
if (overflow.length) console.log(`⚠ 글자가 넘칠 수 있는 장: ${overflow.join(', ')} — 문구를 줄여 주세요`);
