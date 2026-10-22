// 직구각 사이트 빌드: data/*.json을 읽어 dist/에 정적 HTML을 만듭니다.
// 실행: npm run build  (외부 패키지 없이 Node만 있으면 됩니다)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, landedCost, judge, breakevenUsd, dutyFreeLimit, formatKrw } from '../src/calc.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));

const site = readJson('settings.json');
const products = readJson('products.json');
const events = readJson('events.json').sort((a, b) => a.date.localeCompare(b.date));
const FX = site.fx.usdKrw;
const RULE = site.rule;
const BUILT = new Date();

const STORES = {
  amazon: { name: '아마존', cta: '아마존에서 현재가 보기' },
  iherb: { name: '아이허브' },
  aliexpress: { name: '알리익스프레스' },
  coupang: { name: '쿠팡' }
};

// ---------- 작은 도우미 ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const krw = formatKrw;
const usd = (n) => '$' + Number(n).toFixed(2);
const absUrl = (p) => site.siteUrl.replace(/\/$/, '') + p;
const kstToday = () => new Date(BUILT.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const daysUntil = (iso) => Math.round((Date.parse(iso) - Date.parse(kstToday())) / 864e5);
const ddayText = (iso) => { const d = daysUntil(iso); return d > 0 ? 'D-' + d : d === 0 ? 'D-DAY' : '종료'; };
const md = (iso) => { const [, m, d] = iso.split('-'); return `${Number(m)}.${Number(d)}`; };
const weekday = (iso) => ['일', '월', '화', '수', '목', '금', '토'][new Date(iso + 'T00:00:00Z').getUTCDay()];

const icon = {
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  calc: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/></svg>',
  cal: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  home: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z"/></svg>',
  guide: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7M8 11h5"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
  dash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
  house: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z"/></svg>',
  lens: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  image: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9AA0AB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  warn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A5A00" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
  logo: '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2" fill="#FFE14D"/><path d="M5 4V25H26" fill="none" stroke="#D23A10" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const CAT_ICONS = {
  supplement: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M9.6 8.6L14.4 15.4"/>',
  it: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  audio: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  toy: '<rect x="3" y="10" width="18" height="10" rx="1.5"/><rect x="6" y="6.5" width="4" height="3.5" rx="1"/><rect x="14" y="6.5" width="4" height="3.5" rx="1"/>',
  food: '<path d="M8 3h8v3l2 3v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9l2-3z"/><path d="M6 12h12"/>',
  home: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3v3M11 3v3"/>',
  apparel: '<path d="M8 3l-5 4 3 3 2-1v12h8V9l2 1 3-3-5-4a4 4 0 0 1-8 0z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>'
};
const catIcon = (k) => `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D23A10" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAT_ICONS[k] || CAT_ICONS.home}</svg>`;

// ---------- 상품 판정 ----------
// 원화로 파는 쇼핑몰(아이허브 한국 등)은 priceKrw·shipKrw를 넣으면 달러로 바꿔 면세 한도를 판단해요
function normalize(p) {
  const amzTag = site.affiliateIds && site.affiliateIds.amazon;
  if (p.store === 'amazon' && amzTag && p.buyUrl && !/[?&]tag=/.test(p.buyUrl)) p = { ...p, buyUrl: p.buyUrl + (p.buyUrl.includes('?') ? '&' : '?') + 'tag=' + encodeURIComponent(amzTag) };
  if (p.priceKrw == null) return p;
  return { ...p, priceUsd: p.priceKrw / FX, shipUsd: (p.shipKrw || 0) / FX, krwPriced: true };
}

function evaluate(p) {
  const ctx = { origin: p.origin, method: p.method, category: p.category, fx: FX };
  const limit = dutyFreeLimit(ctx);
  if (p.priceUsd == null) {
    const be = breakevenUsd({ ...ctx, domesticKrw: p.domesticKrw, shipUsd: p.shipUsd }, RULE);
    return be == null
      ? { kind: 'nobreak', verdict: 'bad', limit, note: '배송비가 차액보다 커요' }
      : { kind: 'break', verdict: 'check', limit, breakeven: be, note: '아마존에서 현재가 확인' };
  }
  const cost = landedCost({ ...ctx, priceUsd: p.priceUsd, shipUsd: p.shipUsd });
  if (p.krwPriced) {
    // 원화 결제는 낸 금액 그대로를 과세가격으로 써서 영수증 합계가 1원도 어긋나지 않게
    const cif = p.priceKrw + (p.shipKrw || 0);
    cost.goodsKrw = p.priceKrw; cost.shipKrw = p.shipKrw || 0;
    cost.duty = cost.dutyFree ? 0 : Math.floor(cif * cost.rate);
    cost.vat = cost.dutyFree ? 0 : Math.floor((cif + cost.duty) * 0.1);
    cost.total = cif + cost.duty + cost.vat;
  }
  const j = judge(p.domesticKrw, cost.total, RULE);
  const pctNum = Math.round(Math.abs(j.pct) * 100);
  const pct = j.diff > 0 ? '-' + pctNum + '%' : '+' + pctNum + '%';
  const note = j.verdict === 'good' ? `₩${krw(j.diff)} 아껴요`
    : j.verdict === 'meh' ? `차액 ₩${krw(j.diff)}, 배송 기간 감안`
    : `국내가 ₩${krw(-j.diff)} 더 싸요`;
  const be = breakevenUsd({ ...ctx, domesticKrw: p.domesticKrw, shipUsd: p.shipUsd }, RULE);
  // 원화 결제 상품은 손익분기도 원화로: 목표 체감가 − 배송비 (면세 한도 안일 때만, 아니면 달러 값을 환산)
  let beKrw = null;
  if (p.krwPriced) {
    const target = Math.min(p.domesticKrw * (1 - RULE.minSavePct), p.domesticKrw - RULE.minSaveKrw);
    const free = Math.floor((target - (p.shipKrw || 0)) / 10) * 10;
    beKrw = free <= 0 ? null : free / FX <= limit ? free : (be == null ? null : Math.floor(be * FX / 10) * 10);
  }
  return { kind: 'priced', verdict: j.verdict, limit, cost, diff: j.diff, pct, pctNum, note, breakeven: be, beKrw };
}
const items = products.map(normalize).map((p) => ({ ...p, ev: evaluate(p), storeName: (STORES[p.store] || { name: p.store }).name }));

const VERDICT = {
  good: { label: '직구각', cls: 'v-good', icon: icon.check },
  meh: { label: '애매', cls: 'v-meh', icon: icon.dash },
  bad: { label: '국내가 나음', cls: 'v-bad', icon: icon.house },
  check: { label: '현재가 확인', cls: 'v-check', icon: icon.lens }
};

// ---------- 공통 틀 ----------
const NAV = [
  { href: '/', label: '오늘의 직구각' },
  { href: '/calendar', label: '세일 캘린더' },
  { href: '/calculator', label: '관세 계산기' },
  { href: '/guide', label: '직구 가이드' }
];

function layout({ title, description, urlPath, body, scripts = [], current = '', noindex = false, image = '' }) {
  const ogImage = image || absUrl('/og.png');
  const fullTitle = title ? `${title} | ${site.siteName}` : `${site.siteName} | ${site.tagline}`;
  const desc = description || site.description;
  const nav = NAV.map((n) => `<a href="${n.href}" class="navlink${current === n.href ? ' is-current' : ''}"${current === n.href ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('');
  const bf = events.find((e) => e.id === site.featuredEvent);
  const ga = site.ga4Id ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(site.ga4Id)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(site.ga4Id)}');</script>` : '';
  const verify = [
    site.googleVerification ? `<meta name="google-site-verification" content="${esc(site.googleVerification)}">` : '',
    site.naverVerification ? `<meta name="naver-site-verification" content="${esc(site.naverVerification)}">` : '',
    site.impactVerification ? `<meta name="impact-site-verification" value="${esc(site.impactVerification)}">` : ''
  ].join('');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(absUrl(urlPath))}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.siteName)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(absUrl(urlPath))}">
<meta property="og:locale" content="ko_KR">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#D23A10">
<meta name="jg-fx" content="${FX}">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icon-192.png">
${verify}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/assets/site.css">
${ga}
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<div class="disclose-bar">직구각의 링크로 구매하면 제휴 수수료를 받을 수 있어요. 구매 가격은 똑같아요. <a href="/disclosure">자세히</a></div>
<header class="site-header">
  <div class="wrap header-row">
    <a href="/" class="logo" aria-label="${esc(site.siteName)} 홈">${icon.logo}<span class="logo-word">${esc(site.siteName)}</span><span class="logo-tag">직구할 각인지<br>3초 판정</span></a>
    <form class="search" role="search" action="/search" method="get">
      <label for="q" class="sr-only">상품 검색</label>
      <input id="q" name="q" type="search" placeholder="아무 상품이나 검색해서 직구각 판정" autocomplete="off">
      <button type="submit" aria-label="검색">${icon.search}</button>
    </form>
  </div>
  <nav class="wrap main-nav" aria-label="주요 메뉴">
    ${nav}
    ${upcoming[0] ? `<a href="/sale" class="navlink hot${current === '/sale' ? ' is-current' : ''}" data-next-sale><span data-ns-name>${esc(upcoming[0].name)}</span><span class="pill-hot" data-ns-dday>${evDday(upcoming[0])}</span></a>` : ''}
  </nav>
</header>
<main id="main" class="wrap main">
${body}
</main>
<footer class="site-footer" id="disclosure-footer">
  <div class="wrap footer-in">
    <div class="footer-links"><a href="/disclosure">광고·제휴 고지</a><a href="/privacy">개인정보처리방침</a><a href="/guide">직구 가이드</a><a href="mailto:${esc(site.contactEmail)}">문의하기</a></div>
    <p>직구각은 쿠팡 파트너스, 아마존 어소시에이트, 알리익스프레스${(site.affiliatePending || []).includes('iherb') ? '' : ', 아이허브'} 제휴 프로그램에 참여하고 있으며, 링크를 통한 구매 시 수수료를 받을 수 있습니다.</p>
    <p>이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
    <p lang="en">As an Amazon Associate I earn from qualifying purchases.</p>
    <p>표시된 관부가세와 체감가는 예상치이며, 최종 세액은 세관 고지를 따릅니다. ${esc(site.fx.label)}.</p>
    <p class="muted">© ${BUILT.getFullYear()} ${esc(site.businessName || site.siteName)} · 운영자 ${esc(site.operator)}</p>
  </div>
</footer>
<nav class="tabbar" aria-label="하단 메뉴">
  <a href="/"${current === '/' ? ' aria-current="page"' : ''}>${icon.home}홈</a>
  <a href="/calculator"${current === '/calculator' ? ' aria-current="page"' : ''}>${icon.calc}계산기</a>
  <a href="/calendar"${current === '/calendar' ? ' aria-current="page"' : ''}>${icon.cal}세일 캘린더</a>
  <a href="/guide"${current === '/guide' ? ' aria-current="page"' : ''}>${icon.guide}가이드</a>
</nav>
<div class="toast" role="status" aria-live="polite" hidden></div>
<script type="application/json" id="jg-sales">${JSON.stringify(upcoming.map((e) => ({ n: e.name, d: e.date, e: e.end || '', s: shortStores(e), k: e.scope }))).replace(/</g, '\\u003c')}</script>
<script type="module" src="/assets/app.js"></script>
${scripts.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
</body>
</html>
`;
}

// ---------- 조각 ----------
function verdictBar(ev) {
  const v = VERDICT[ev.verdict];
  const label = ev.verdict === 'check' ? '' : v.label + ' · ';
  return `<div class="vbar ${v.cls}">${v.icon}${esc(label + ev.note)}</div>`;
}

// 상품 사진: 제휴 프로그램(쿠팡 파트너스·알리 제휴 API)이 제공하는 상품 이미지. 없으면 회색 자리표시
const productImages = (p) => (p.image ? [p.image] : (p.parts || []).map((x) => x.image).filter(Boolean)).slice(0, 4);
function imgBlock(p, eager = false) {
  const imgs = productImages(p);
  if (!imgs.length) return `${icon.image}<span>상품 이미지</span>`;
  const attrs = `alt="" referrerpolicy="no-referrer" decoding="async"${eager ? '' : ' loading="lazy"'}`;
  if (imgs.length === 1) return `<img class="p-photo" src="${esc(imgs[0])}" ${attrs}>`;
  return `<div class="p-photos n${imgs.length}">${imgs.map((u) => `<img src="${esc(u)}" ${attrs}>`).join('')}</div>`;
}

function card(p) {
  const ev = p.ev;
  let price = '';
  if (ev.kind === 'priced') {
    price = `<div class="card-price"><span class="${ev.diff > 0 ? 'pct-down' : 'pct-up'}">${ev.pct}</span><b>₩${krw(ev.cost.total)}</b></div><div class="card-sub">관부가세·배송비 포함 체감가</div>`;
  } else if (ev.kind === 'break') {
    price = `<div class="break-box">${esc(p.storeName)}가 <b>$${ev.breakeven} 이하</b>면 직구각<br><span>현재가는 ${esc(p.storeName)}에서 확인하세요</span></div>`;
  }
  return `<a class="card" href="/p/${esc(p.slug)}" data-verdict="${ev.verdict}" data-cat="${esc(p.category)}" data-name="${esc(p.name)}">
  <div class="card-img"><span class="store-chip">${esc(p.storeName)}</span>${p.sample ? '<span class="sample-chip">예시</span>' : ''}${imgBlock(p)}</div>
  <div class="card-name">${esc(p.name)}</div>
  <div class="card-dom">국내 최저가 ₩${krw(p.domesticKrw)}</div>
  ${price}
  ${verdictBar(ev)}
</a>`;
}

const sampleNote = items.some((p) => p.sample) ? " · '예시' 표시 상품은 가격 확인 전이에요" : '';

// ---------- 페이지: 홈 ----------
function pageHome() {
  const bf = events.find((e) => e.id === site.featuredEvent) || events[0];
  const upcomingAll = upcoming;
  const ticker = items.slice(0, 6).map((p) => {
    const v = VERDICT[p.ev.verdict];
    const t = p.ev.kind === 'break' ? `${p.storeName}가 $${p.ev.breakeven} 이하면 직구각` : p.ev.kind === 'priced' ? `${v.label} ${p.ev.pct}` : v.label;
    return `<a href="/p/${esc(p.slug)}" class="tick">${esc(p.name)} <b class="${v.cls}-text">${esc(t)}</b></a>`;
  }).join('<span class="tick-sep" aria-hidden="true">|</span>');
  const usedCats = [...new Set(items.map((p) => p.category))];
  const chips = usedCats.map((k) => `<button type="button" class="cat" data-cat-filter="${k}" aria-pressed="false"><span class="cat-ico">${catIcon(k)}</span>${esc(CATEGORIES[k].label)}</button>`).join('');
  const body = `
<section class="hero">
  <div class="hero-main">
    <div class="hero-top">
      <div class="hero-copy">
        <span class="hero-pill">다가오는 세일 ${upcomingAll.length}개</span>
        <h1>세일할 땐,<br>직구각인 것만<br>골라 드려요</h1>
        <p>관세·배송비까지 더한 최종 체감가로<br>국내 최저가와 바로 비교해요.</p>
        <div class="hero-btns"><a href="/sale" class="btn btn-yellow">세일 직구각 모음</a><a href="/calendar" class="btn btn-ghost">세일 캘린더</a></div>
      </div>
      ${nextSaleCircle()}
    </div>
    <div class="hero-events">${upcomingAll.slice(0, 4).map((e) => `<span><b>${e.end ? md(e.date) + '~' + md(e.end) : md(e.date)}</b> ${esc(e.name)}</span>`).join('')}</div>
  </div>
  <a href="/calculator" class="hero-calc">
    <span class="hc-title">${icon.calc}<b>3초 관세 계산</b></span>
    <span class="hc-desc">상품가만 넣으면 면세 한도, 관부가세,<br>국내 최저가 대비 차액까지 계산해요.</span>
    <span class="hc-row"><span>구매처</span><b>미국 · 특송</b></span>
    <span class="hc-row"><span>상품가</span><b>$ 119.00</b></span>
    <span class="hc-row"><span>국내 최저가</span><b>₩ 219,000</b></span>
    <span class="hc-ok"><i></i>면세 한도 안 · 예상 세금 ₩0</span>
    <span class="btn btn-ink">계산기 열기</span>
  </a>
</section>

<section class="ticker" aria-label="최근 판정"><span class="ticker-pill">최근 판정</span>${ticker}</section>

<section aria-labelledby="cat-title" class="block">
  <h2 id="cat-title" class="h2">카테고리별 직구각</h2>
  <div class="cats">${chips}</div>
</section>

<section id="today" aria-labelledby="today-title" class="block">
  <div class="block-head">
    <div><h2 id="today-title" class="h2 big">오늘의 직구각</h2><span class="muted small">관세·배송비 포함 체감가 기준${sampleNote}</span></div>
    <div class="filters" role="group" aria-label="판정으로 거르기">
      <button type="button" data-filter="all" aria-pressed="true">전체</button>
      <button type="button" data-filter="good" aria-pressed="false">직구각만</button>
      <button type="button" data-filter="meh" aria-pressed="false">애매</button>
      <button type="button" data-filter="bad" aria-pressed="false">국내가 나음</button>
    </div>
  </div>
  <p class="search-note" hidden></p>
  <div class="grid">${items.map(card).join('\n')}</div>
  <p class="empty" hidden>조건에 맞는 상품이 없어요. 다른 필터를 눌러 보세요.</p>
</section>

<section id="guide" aria-labelledby="guide-title" class="guide-strip">
  <h2 id="guide-title" class="h2">직구 처음이세요? 결제 전 3가지만 챙기세요</h2>
  <p class="muted">해외 쇼핑몰에 도착하기 전에 여기서 준비를 끝내요.</p>
  <div class="steps">
    <a href="/guide#address" class="step"><span class="num">1</span><b>영문 주소 변환</b><span>도로명주소를 영문으로 바꾸고 쇼핑몰 입력칸에 맞게 넣는 법.</span></a>
    <a href="/guide#pccc" class="step"><span class="num">2</span><b>통관부호 3초 점검</b><span>유효기간, 등록 이메일, 배송지 우편번호. 결제 전에 세 줄만 확인해요.</span></a>
    <a href="/calculator" class="step"><span class="num">3</span><b>면세 신호등</b><span>미국 특송 $200, 그 외 $150. 장바구니가 한도를 넘는지 바로 알려줘요.</span></a>
  </div>
</section>`;
  return layout({ title: '', urlPath: '/', body, current: '/', scripts: ['/assets/home.js'] });
}

// ---------- 페이지: 판정 상세 ----------
function pageProduct(p) {
  const ev = p.ev;
  const v = VERDICT[ev.verdict];
  const cat = CATEGORIES[p.category];
  // 구매 버튼: 직구가 손해면 국내(쿠팡 등) 링크를 먼저, 아니면 해외 링크를 먼저 보여줘요
  const domesticFirst = ev.verdict === 'bad';
  const overseasLabel = p.store === 'amazon' ? STORES.amazon.cta : ev.kind === 'priced' ? `${p.storeName}에서 ₩${krw(ev.cost.total)}에 사기` : `${p.storeName}에서 보기`;
  const domesticLabel = `국내 최저가 ₩${krw(p.domesticKrw)}에 사기${p.domesticStore ? ` (${p.domesticStore})` : ''}`;
  const linkBtn = (url, label, primary) => `<a href="${esc(url)}" class="btn ${primary ? 'btn-buy' : 'btn-line'}" data-out rel="sponsored nofollow noopener" target="_blank">${esc(label)}</a>`;
  const btns = [];
  const overseas = p.buyUrl ? { url: p.buyUrl, label: overseasLabel } : null;
  const partsHtml = (p.parts || []).length ? `<div class="parts" id="parts"><b>${esc(p.storeName)}에서 하나씩 담기</b>${p.parts.map((x) => `<a href="${esc(x.url)}" data-out rel="sponsored nofollow noopener" target="_blank">${esc(x.name)}<span>₩${krw(x.priceKrw)}</span></a>`).join('')}</div>` : '';
  const domestic = p.domesticUrl ? { url: p.domesticUrl, label: domesticLabel } : null;
  // 판정이 추천하는 쪽이 첫 번째(빨간) 버튼. 그 링크가 아직 없으면 '준비 중'으로 두고, 다른 쪽은 보조 버튼으로
  const preferred = domesticFirst ? domestic : overseas;
  const other = domesticFirst ? overseas : domestic;
  if (preferred) btns.push(linkBtn(preferred.url, preferred.label, true));
  else if (!domesticFirst && partsHtml) btns.push(`<a href="#parts" class="btn btn-buy">${esc(p.storeName)}에서 ${p.parts.length}개 담기 · ₩${krw(ev.cost.total)}</a>`);
  else btns.push(`<span class="btn btn-buy is-disabled" aria-disabled="true">${esc(domesticFirst ? '국내 구매 링크 준비 중' : `${p.storeName} 구매 링크 준비 중`)}</span>`);
  if (other) btns.push(linkBtn(other.url, other.label, false));
  const out = btns.join('\n      ') + partsHtml;
  let hero, money;
  if (ev.kind === 'priced') {
    const c = ev.cost;
    const headline = ev.verdict === 'good' ? `국내 최저가보다 ${ev.pctNum}% 저렴해요`
      : ev.verdict === 'meh' ? `₩${krw(ev.diff)} 싸지만 차액이 작아요` : `국내가 ₩${krw(-ev.diff)} 더 싸요`;
    const sub = ev.verdict === 'good' ? `관세·배송비 다 넣고도 ₩${krw(ev.diff)} 아껴요`
      : ev.verdict === 'meh' ? '배송 기간과 반품 부담을 생각하면 급하지 않을 때만 추천해요' : '지금은 국내에서 사는 편이 나아요';
    hero = `<div class="vhero ${v.cls}"><span class="vword">${v.label}</span><div><b>${esc(headline)}</b><span>${esc(sub)}</span></div></div>`;
    const sig = c.signal === 'red' ? ['', '', 'on-red'] : c.signal === 'yellow' ? ['', 'on-yellow', ''] : ['on-green', '', ''];
    const sigText = c.dutyFree
      ? `<b>면세 한도 안</b> · 한도 $${c.limit} 중 ${usd(c.price)}${cat.listClearance ? '' : ` (${esc(cat.label)}은 미국발도 $150 기준)`}`
      : `<b>면세 한도 초과</b> · 한도 $${c.limit}을 넘어 배송비 포함 전체에 과세돼요`;
    money = `
<div class="compare">
  <div class="cmp"><span>국내 최저가</span><b>₩${krw(p.domesticKrw)}</b><small>${esc(p.domesticSource)} 기준</small></div>
  <div class="cmp is-main"><span>해외 최종 체감가</span><b>₩${krw(c.total)}</b><small>${esc(p.storeName)} · 관부가세·배송비 포함</small></div>
</div>
<div class="receipt">
  <b class="r-title">체감가 영수증</b>
  <div class="r-row"><span>${p.krwPriced ? `상품가 (원화 결제, ${usd(c.price)} 상당)` : `상품가 ${usd(c.price)}`}</span><span>₩${krw(p.krwPriced ? p.priceKrw : c.goodsKrw)}</span></div>
  <div class="r-row"><span>${p.krwPriced ? (p.shipKrw ? '국제 배송비' : `국제 배송비${p.shipNote ? ' · ' + esc(p.shipNote) : ''}`) : `국제 배송비 ${usd(c.ship)}`}</span><span>₩${krw(p.krwPriced ? (p.shipKrw || 0) : c.shipKrw)}</span></div>
  <div class="r-row"><span>관세 ${Math.round(c.rate * 100)}%</span><span${c.dutyFree ? ' class="ok"' : ''}>₩${krw(c.duty)}${c.dutyFree ? ' · 면세' : ''}</span></div>
  <div class="r-row"><span>부가세 10%</span><span${c.dutyFree ? ' class="ok"' : ''}>₩${krw(c.vat)}${c.dutyFree ? ' · 면세' : ''}</span></div>
  <div class="r-total"><span>합계</span><span>₩${krw(c.total)}</span></div>
  <small>${esc(site.fx.label)} · 최종 세액은 세관 고지를 따라요</small>
</div>
<div class="signal"><div class="lights" aria-hidden="true"><i class="${sig[0]}"></i><i class="${sig[1]}"></i><i class="${sig[2]}"></i></div><span>${sigText}</span></div>
${ev.verdict !== 'good' && (p.krwPriced ? ev.beKrw != null : ev.breakeven != null) ? `<p class="muted small">이 상품은 ${esc(p.storeName)} 가격이 <b>${p.krwPriced ? '₩' + krw(ev.beKrw) : '$' + ev.breakeven} 이하</b>로 내려가면 직구각이에요.</p>` : ''}`;
  } else {
    const limit = ev.limit;
    hero = ev.kind === 'break'
      ? `<div class="vhero v-check"><span class="vword">$${ev.breakeven} 이하</span><div><b>${esc(p.storeName)} 가격이 이 가격 이하면 직구각</b><span>국내 최저가 ₩${krw(p.domesticKrw)}, 배송비 ${p.shipNote ? esc(p.shipNote) : '$' + p.shipUsd}, 면세 한도 $${limit} 기준</span></div></div>`
      : `<div class="vhero v-bad"><span class="vword">국내가 나음</span><div><b>배송비가 가격 차이보다 커요</b><span>국내 최저가 ₩${krw(p.domesticKrw)} · 배송비 $${p.shipUsd} 기준</span></div></div>`;
    money = `
<div class="compare">
  <div class="cmp"><span>국내 최저가</span><b>₩${krw(p.domesticKrw)}</b><small>${esc(p.domesticSource)} 기준</small></div>
  <div class="cmp is-main"><span>직구각 기준 가격</span><b>${ev.kind === 'break' ? '$' + ev.breakeven + ' 이하' : '없음'}</b><small>20% 이상, ₩${krw(RULE.minSaveKrw)} 이상 쌀 때</small></div>
</div>
<form class="mini-calc" data-mini-calc data-domestic="${p.domesticKrw}" data-ship="${p.shipUsd}" data-origin="${p.origin}" data-method="${p.method}" data-category="${p.category}">
  <label for="mc-price"><b>지금 ${esc(p.storeName)} 가격을 넣어 보세요</b><span>${esc(p.storeName)}에서 본 가격을 그대로 넣으면 바로 판정해요. 원화(KRW)로 보이면 ₩를 골라 주세요.</span></label>
  <div class="mc-row"><select class="mc-cur" aria-label="통화"><option value="usd">$</option><option value="krw">₩</option></select><input id="mc-price" type="number" inputmode="decimal" min="0" step="any" placeholder="예: 119.99"></div>
  <div class="mc-out" aria-live="polite"></div>
</form>`;
  }
  const risks = (p.risks || []).map((r) => `<span class="risk">${icon.warn}${esc(r)}</span>`).join('');
  // 요약 문장 속 {be}·{beKrw}는 빌드할 때 손익분기 값으로 바꿔요(가격·환율이 바뀌어도 문장이 맞게)
  const fill = (s) => s.replace(/\{be\}/g, ev.breakeven != null ? '$' + ev.breakeven : '-').replace(/\{beKrw\}/g, ev.beKrw != null ? '₩' + krw(ev.beKrw) : '-');
  const summary = (p.summary || []).map((s) => `<li>${esc(fill(s))}</li>`).join('');
  const desc = ev.kind === 'priced'
    ? `${p.name} 해외직구 최종 체감가 ₩${krw(ev.cost.total)} vs 국내 최저가 ₩${krw(p.domesticKrw)}. ${v.label} 판정과 관부가세 계산.`
    : `${p.name} 해외직구 손익분기 가격과 국내 최저가 ₩${krw(p.domesticKrw)} 비교.`;
  const body = `
<nav class="crumbs" aria-label="현재 위치"><a href="/">홈</a><span aria-hidden="true">›</span><a href="/?cat=${esc(p.category)}">${esc(cat.label)}</a><span aria-hidden="true">›</span><span>${esc(p.name)}</span></nav>
<div class="pd">
  <div class="pd-left">
    <div class="pd-img">${imgBlock(p, true)}</div>
    ${summary ? `<div class="ai-box"><div class="ai-head"><span class="ai-tag">AI 요약</span><b>직구 전에 알아둘 3줄</b></div><ol>${summary}</ol><small>요약은 참고용이에요. 가격 확인 결과와 제조사·쇼핑몰 정보를 바탕으로 정리했어요.</small></div>` : ''}
  </div>
  <div class="pd-right">
    <div class="pd-head"><span class="store-chip static">${esc(p.storeName)}</span><h1>${esc(p.name)}</h1><span class="muted small">${p.sample ? '예시 가격 · ' : ''}${esc(p.checkedAt || kstToday().replace(/-/g, '.'))} 기준 가격</span></div>
    ${hero}
    ${money}
    ${risks ? `<div class="risks">${risks}</div>` : ''}
    <div class="buy">
      <span class="ad-note"><b>광고</b> · 이 링크로 구매하면 직구각이 수수료를 받아요. 가격은 같아요.</span>
      ${out}
      <button type="button" class="btn btn-line" data-share data-title="${esc(p.name + ' 직구 판정')}">${icon.share}PC로 보내기 · 공유</button>
    </div>
  </div>
</div>
<section class="before" aria-labelledby="before-title">
  <h2 id="before-title">결제 전 30초 체크</h2>
  <div><a href="/guide#address">영문 주소 넣는 법</a><a href="/guide#pccc">통관부호 유효기간 확인</a><a href="/guide#combine">합산과세 피하기</a></div>
</section>`;
  return layout({ title: `${p.name} 직구 판정`, description: desc, urlPath: `/p/${p.slug}`, body, image: p.image || '', scripts: ev.kind === 'priced' ? [] : ['/assets/mini-calc.js'] });
}

// ---------- 페이지: 관세 계산기 ----------
function pageCalculator() {
  const cats = Object.entries(CATEGORIES).map(([k, c], i) => `<button type="button" data-cat="${k}" aria-pressed="${i === 0}"><b>${esc(c.label)}</b><small>${esc(c.sub)}</small></button>`).join('');
  const body = `
<div class="page-head"><h1 class="display">관세 계산기</h1><p class="muted">상품가와 국내 최저가만 넣으면 직구각인지 바로 판정해요.</p></div>
<div class="calc" data-calc data-fx="${FX}" data-min-krw="${RULE.minSaveKrw}" data-min-pct="${RULE.minSavePct}">
  <section class="calc-in" aria-label="입력">
    <fieldset><legend>어디서 보내나요?</legend><div class="seg" data-group="origin"><button type="button" data-val="us" aria-pressed="true">미국</button><button type="button" data-val="other" aria-pressed="false">그 외 (중국·일본·유럽)</button></div></fieldset>
    <fieldset><legend>어떻게 배송되나요?</legend><div class="seg" data-group="method"><button type="button" data-val="express" aria-pressed="true">특송·쇼핑몰 직배송</button><button type="button" data-val="post" aria-pressed="false">우편 (EMS 등)</button></div></fieldset>
    <fieldset><legend>무엇을 사나요?</legend><div class="seg seg-cat" data-group="category">${cats}</div></fieldset>
    <div class="two">
      <div class="field"><label for="c-price">상품가 (달러)</label><input id="c-price" type="number" inputmode="decimal" min="0" step="0.01" value="119"><small>판매국 세금·현지 배송비 포함</small></div>
      <div class="field"><label for="c-ship">국제 배송비 (달러)</label><input id="c-ship" type="number" inputmode="decimal" min="0" step="0.01" value="10"><small>결제 화면에 따로 적힌 금액, 무료면 0</small></div>
    </div>
    <div class="field"><label for="c-dom">국내 최저가 (원)</label><input id="c-dom" type="number" inputmode="numeric" min="0" step="100" value="219000"><small>네이버쇼핑·쿠팡에서 같은 모델의 최저가</small></div>
  </section>
  <section class="calc-out" aria-label="계산 결과" aria-live="polite">
    <div class="vhero" data-out-verdict><span class="vword">-</span><div><b>-</b></div></div>
    <div class="signal" data-out-signal><div class="lights" aria-hidden="true"><i></i><i></i><i></i></div><span><b>-</b><br><small>-</small></span></div>
    <p class="rule-note" data-out-note hidden></p>
    <div class="receipt">
      <b class="r-title">체감가 영수증</b>
      <div class="r-row"><span>상품가</span><span data-r="goods">-</span></div>
      <div class="r-row"><span>국제 배송비</span><span data-r="ship">-</span></div>
      <div class="r-row"><span data-r="rate">관세</span><span data-r="duty">-</span></div>
      <div class="r-row"><span>부가세 10%</span><span data-r="vat">-</span></div>
      <div class="r-total"><span>최종 체감가</span><span data-r="total">-</span></div>
    </div>
    <div class="be" data-out-be></div>
    <p class="muted small">${esc(site.fx.label)}. 관세율은 품목별 기본세율 예시이며, 실제 세율과 최종 세액은 <a href="https://unipass.customs.go.kr/csp/index.do" target="_blank" rel="noopener">관세청 예상세액 조회</a>와 세관 고지를 따릅니다.</p>
  </section>
</div>`;
  return layout({ title: '해외직구 관세 계산기', description: '미국 $200, 그 외 $150 면세 한도와 관세·부가세를 계산하고 국내 최저가와 비교해 직구할 각인지 판정해요.', urlPath: '/calculator', body, current: '/calculator', scripts: ['/assets/calculator.js'] });
}

// ---------- 페이지: 검색 (판정한 상품 + 네이버쇼핑 실시간 국내 최저가) ----------
function pageSearch() {
  const catOpts = Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${esc(c.label)} (${esc(c.sub)})</option>`).join('');
  const body = `
<div class="page-head"><h1 class="display" data-s-title>직구각 검색</h1><p class="muted" data-s-sub>상품명을 검색하면 알리익스프레스 실시간 가격을 찾아 드려요. 국내 최저가만 넣으면 관부가세까지 계산해 바로 판정해요.</p></div>
<form class="s-form" action="/search" method="get" role="search">
  <label for="sq" class="sr-only">상품 검색</label>
  <input id="sq" name="q" type="search" placeholder="예: 무선 이어폰, USB-C 허브, 레고" autocomplete="off">
  <button type="submit" class="btn btn-buy">검색</button>
</form>
<section class="block" data-s-curated hidden>
  <h2 class="h2">직구각이 이미 판정한 상품</h2>
  <div class="grid">${items.map(card).join('\n')}</div>
</section>
<section class="block" data-s-live hidden data-fx="${FX}" data-min-krw="${RULE.minSaveKrw}" data-min-pct="${RULE.minSavePct}">
  <div class="block-head"><div><h2 class="h2">알리익스프레스 실시간 가격</h2><span class="muted small">원화 판매가 기준 · 신규 회원 할인·쿠폰은 빠져 있어요</span></div></div>
  <p class="s-status" data-s-status role="status" aria-live="polite"></p>
  <ol class="s-list" data-s-list></ol>
  <div class="s-more" data-s-more hidden><span class="muted small">국내 최저가 찾아보기</span><a data-s-coupang target="_blank" rel="noopener">쿠팡에서 검색</a><a data-s-naver target="_blank" rel="noopener">네이버쇼핑에서 검색</a></div>
</section>
<template id="s-row">
  <li class="s-item">
    <div class="s-main">
      <img class="s-img" alt="" loading="lazy" width="88" height="88">
      <div class="s-info">
        <span class="s-title"></span>
        <div class="s-meta"><b class="s-price"></b><s class="s-orig"></s><span class="s-mall"></span></div>
        <div class="s-btns"><button type="button" class="btn btn-ink small s-open">국내가 넣고 판정</button><a class="btn btn-line small s-buy" target="_blank" rel="sponsored noopener">알리에서 보기</a></div>
      </div>
    </div>
    <div class="s-judge" hidden>
      <div class="s-grid">
        <div class="field"><label>국내 최저가 (원)</label><input class="s-dom-in" type="number" inputmode="numeric" min="0" step="100" placeholder="쿠팡·네이버 최저가"><small><a class="s-dom-coupang" target="_blank" rel="noopener">쿠팡에서 같은 상품 찾기</a></small></div>
        <div class="field"><label>국제 배송비 (원)</label><input class="s-ship-in" type="number" inputmode="numeric" min="0" step="100" value="0"><small>무료배송이면 0</small></div>
        <div class="field s-wide"><label>품목</label><select class="s-cat">${catOpts}</select></div>
      </div>
      <div class="s-result" aria-live="polite"></div>
    </div>
  </li>
</template>
<p class="muted small">알리 가격은 제휴 API로 받아온 원화 판매가예요. 회원·쿠폰·옵션에 따라 실제 결제가는 다를 수 있어요. 직구각의 링크로 구매하면 제휴 수수료를 받을 수 있어요. ${esc(site.fx.label)}.</p>`;
  return layout({ title: '직구각 검색', description: '아무 상품이나 검색하면 알리익스프레스 실시간 가격을 찾고, 국내 최저가와 관부가세까지 계산해 직구각인지 판정해요.', urlPath: '/search', body, noindex: true, scripts: ['/assets/search.js'] });
}

// ---------- 세일 일정 도우미 ----------
const evEnd = (e) => e.end || e.date;
const evRange = (e) => (e.end ? `${md(e.date)}~${md(e.end)}` : md(e.date));
const evDday = (e) => { const d = daysUntil(e.date); return d > 0 ? 'D-' + d : d === 0 ? 'D-DAY' : daysUntil(evEnd(e)) >= 0 ? '진행 중' : '종료'; };
const ddayAttr = (e) => `data-dday="${e.date}"${e.end ? ` data-dday-end="${e.end}"` : ''}`;
const upcoming = events.filter((e) => daysUntil(evEnd(e)) >= 0).sort((a, b) => a.date.localeCompare(b.date));
const STATUS = { confirmed: '날짜 확정', expected: '예상 · 작년 기준' };
const SCOPE = { overseas: '해외 직구', domestic: '국내 쇼핑몰' };
const nextSaleFor = (storeName) => upcoming.find((e) => e.scope === 'overseas' && e.stores.includes(storeName));

// 가장 가까운 세일 D-day 원: 빌드 때 값을 넣고, 브라우저에서 오늘 날짜로 다시 골라요(app.js)
const weekdayLong = (iso) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8))}일 ${weekday(iso)}요일`;
const shortStores = (e) => e.stores.split(' · ').slice(0, 2).join(' · ');
function nextSaleCircle() {
  const nx = upcoming[0];
  if (!nx) return '';
  const ongoing = daysUntil(nx.date) <= 0;
  return `<div class="dday-circle ns-circle" data-next-sale>
  <span class="ns-scope ${nx.scope}" data-ns-scope>${SCOPE[nx.scope]}</span>
  <span class="ns-stores" data-ns-stores>${esc(shortStores(nx))}</span>
  <b data-ns-dday>${evDday(nx)}</b>
  <span class="ns-name" data-ns-name>${esc(nx.name)}</span>
  <span class="ns-date" data-ns-date>${ongoing && nx.end ? `${md(nx.end)}까지` : weekdayLong(nx.date)}</span>
</div>`;
}

// ---------- 페이지: 세일 직구각 모음 ----------
function pageSale() {
  const chips = upcoming.slice(0, 5).map((e) => `<span><b>${evRange(e)}</b> ${esc(e.name)} <i ${ddayAttr(e)}>${evDday(e)}</i></span>`).join('');
  const good = items.filter((p) => p.ev.verdict === 'good');
  const targets = items.filter((p) => p.ev.kind === 'break');
  const domestic = items.filter((p) => p.ev.verdict === 'bad' || p.ev.verdict === 'meh');
  const rows = targets.map((p) => {
    const sale = nextSaleFor(p.storeName);
    return `<tr>
    <th scope="row"><a href="/p/${esc(p.slug)}">${esc(p.name)}</a><span class="muted small">${esc(p.storeName)}</span></th>
    <td>₩${krw(p.domesticKrw)}</td>
    <td><b class="bf-target">$${p.ev.breakeven} 이하</b></td>
    <td>${sale ? `${esc(sale.name)}<span class="muted small">${evRange(sale)}</span>` : '-'}</td>
  </tr>`;
  }).join('\n');
  const body = `
<section class="bf-hero">
  <div>
    <span class="hero-pill">다가오는 세일 ${upcoming.length}개</span>
    <h1>세일 직구각 모음</h1>
    <p>관세·부가세·배송비까지 더한 체감가로 골랐어요. 세일 당일엔 목표가만 확인하고 바로 사세요.</p>
    <div class="bf-dates">${chips}</div>
  </div>
  ${nextSaleCircle()}
</section>

<section class="block" aria-labelledby="sale-now">
  <div class="block-head"><div><h2 id="sale-now" class="h2 big">지금 사도 직구각</h2><span class="muted small">세일을 기다릴 필요 없이 이미 국내보다 20% 이상 싼 상품</span></div></div>
  <div class="grid">${good.map(card).join('\n')}</div>
</section>

<section class="block" aria-labelledby="sale-target">
  <div class="block-head"><div><h2 id="sale-target" class="h2 big">세일 목표가</h2><span class="muted small">해외 가격이 이 밑으로 떨어지면 직구각이에요. 국내 최저가 기준으로 계산했어요.</span></div></div>
  <div class="bf-table-wrap"><table class="bf-table">
    <thead><tr><th scope="col">상품</th><th scope="col">국내 최저가</th><th scope="col">직구각 목표가</th><th scope="col">노릴 세일</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
</section>

<section class="block" aria-labelledby="sale-dom">
  <div class="block-head"><div><h2 id="sale-dom" class="h2 big">세일에도 국내가 나은 것</h2><span class="muted small">해외가 싸 보여도 배송비·세금을 더하면 국내와 비슷하거나 더 비싸요. 11번가 십일절·빅스마일데이 땐 국내가 더 내려가요.</span></div></div>
  <div class="grid">${domestic.map(card).join('\n')}</div>
</section>

<section class="guide-strip" aria-labelledby="sale-check">
  <h2 id="sale-check" class="h2">세일 결제 전 5가지 체크</h2>
  <ol class="bf-checks">
    <li><b>면세 한도</b> 미국에서 특송으로 오면 $200, 그 외 나라·영양제·식품은 $150까지 면세예요.</li>
    <li><b>합산과세</b> 같은 날 같은 나라에서 산 여러 주문이 한 번에 들어오면 합쳐서 세금을 매길 수 있어요. 주문을 하루 이상 띄우세요.</li>
    <li><b>달러로 결제</b> 해외 쇼핑몰이 원화로 결제하자고 하면 거절하고 현지 통화를 고르세요. 환전 수수료를 아껴요.</li>
    <li><b>무료배송 기준</b> 아마존은 한국행 무료배송 상품을 $49 이상, 아이허브는 ₩40,000 이상 담아야 배송비가 0원이에요.</li>
    <li><b>통관부호</b> 개인통관고유부호가 유효한지, 이름·전화번호가 주문 정보와 같은지 미리 확인하세요. <a href="/guide#pccc">확인하는 법</a></li>
  </ol>
  <div class="hero-btns"><a class="btn btn-ink" href="/calendar">세일 일정 전체 보기</a><a class="btn btn-line" href="/calculator">관세 계산기</a></div>
</section>`;
  return layout({ title: '세일 직구각 모음', description: '광군제·블랙프라이데이·사이버먼데이·박싱데이 등 해외직구 세일 때 관부가세까지 더한 체감가로 직구할 상품과 목표가를 정리했어요.', urlPath: '/sale', body, current: '/sale' });
}

// ---------- 페이지: 세일 캘린더 ----------
function gcalLink(e) {
  const d = e.date.replace(/-/g, '');
  const next = new Date(Date.parse(evEnd(e)) + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${e.name} (${e.stores})`, dates: `${d}/${next}`, details: `${e.note}\n${absUrl('/calendar')}` });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}
function pageCalendar() {
  const rows = upcoming.map((e) => `<li class="ev" data-scope="${e.scope}">
  <div class="ev-date"><b>${md(e.date)}</b><span>${weekday(e.date)}요일</span></div>
  <div class="ev-body">
    <div class="ev-title"><b>${esc(e.name)}</b><span class="ev-dday" ${ddayAttr(e)}>${evDday(e)}</span></div>
    <div class="ev-tags"><span class="ev-tag ${e.scope}">${SCOPE[e.scope]}</span><span class="ev-tag ${e.status}">${STATUS[e.status]}</span><span class="ev-range">${evRange(e)}</span></div>
    <span class="ev-store">${esc(e.stores)}</span><p>${esc(e.note)}</p>
  </div>
  <a class="btn btn-line small" href="${esc(gcalLink(e))}" target="_blank" rel="noopener">구글 캘린더에 추가</a>
</li>`).join('\n');
  const body = `
<div class="page-head"><h1 class="display">세일 캘린더</h1><p class="muted">해외 직구 세일과, 국내가가 내려가는 국내 쇼핑몰 세일까지 한눈에. 캘린더에 넣어 두면 놓치지 않아요.</p>
<a class="btn btn-ink small" href="/calendar.ics">내 캘린더에 전체 구독 (.ics)</a></div>
<div class="filters ev-filters" role="group" aria-label="세일 종류로 거르기">
  <button type="button" data-ev-filter="all" aria-pressed="true">전체</button>
  <button type="button" data-ev-filter="overseas" aria-pressed="false">해외 직구</button>
  <button type="button" data-ev-filter="domestic" aria-pressed="false">국내 쇼핑몰</button>
</div>
<ol class="events">${rows}</ol>
<p class="muted small">'예상'은 작년 일정을 기준으로 적었고, 쇼핑몰이 날짜를 발표하면 바로 '확정'으로 바꿔요. 할인 내용은 쇼핑몰 공식 발표를 따라요.</p>
<script type="module">
const bs=[...document.querySelectorAll('[data-ev-filter]')];
bs.forEach((b)=>b.addEventListener('click',()=>{bs.forEach((x)=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('.ev').forEach((li)=>{li.hidden=b.dataset.evFilter!=='all'&&li.dataset.scope!==b.dataset.evFilter;});}));
</script>`;
  return layout({ title: '해외직구 세일 캘린더', description: '광군제, 블랙프라이데이, 사이버먼데이, 박싱데이, 프라임데이와 11번가 십일절·빅스마일데이까지 직구 세일 일정을 한눈에 보고 캘린더에 추가하세요.', urlPath: '/calendar', body, current: '/calendar' });
}
function calendarIcs() {
  const stamp = BUILT.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//jikgugak//sale calendar//KO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:직구각 세일 캘린더'];
  for (const e of upcoming) {
    const d = e.date.replace(/-/g, '');
    const next = new Date(Date.parse(evEnd(e)) + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
    const desc = `${e.status === 'expected' ? '[예상] ' : ''}${e.note}`;
    lines.push('BEGIN:VEVENT', `UID:${e.id}@jikgugak`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`, `SUMMARY:${e.name} (${e.stores})`, `DESCRIPTION:${desc.replace(/[,;]/g, (m) => '\\' + m)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// ---------- 페이지: 가이드 ----------
function pageGuide() {
  const body = `
<div class="page-head"><h1 class="display">직구 가이드</h1><p class="muted">결제 직전에 막히는 세 가지를 미리 풀어 둬요.</p></div>
<article class="prose">
<section id="address">
<h2>1. 영문 주소 넣는 법</h2>
<p><a href="https://www.juso.go.kr/" target="_blank" rel="noopener">도로명주소 안내시스템</a>에서 주소를 검색하면 영문 주소를 볼 수 있어요. 해외 쇼핑몰 입력칸에는 이렇게 나눠 넣어요.</p>
<table>
<thead><tr><th scope="col">쇼핑몰 입력칸</th><th scope="col">넣을 내용</th><th scope="col">예시</th></tr></thead>
<tbody>
<tr><td>Address Line 1</td><td>건물번호 + 도로명</td><td>[건물번호] [도로명]-ro</td></tr>
<tr><td>Address Line 2</td><td>동·호수</td><td>[동]-dong [호]-ho</td></tr>
<tr><td>City</td><td>시·군·구</td><td>[구]-gu, Seoul</td></tr>
<tr><td>State / Province</td><td>시·도</td><td>Seoul</td></tr>
<tr><td>ZIP / Postal code</td><td>우편번호 5자리</td><td>[우편번호]</td></tr>
</tbody>
</table>
<p>받는 사람 이름은 개인통관고유부호에 등록한 영문 이름과 같게 적어요.</p>
</section>
<section id="pccc">
<h2>2. 통관부호 3초 점검</h2>
<ul class="checklist">
<li><b>유효기간:</b> 2026년부터 개인통관고유부호는 1년마다 갱신해요. 2026년 이전에 받았다면 2027년 본인 생일이 만료일이에요. 만료일 전후 30일 안에 갱신하지 않으면 자동 해지돼요.</li>
<li><b>등록 이메일:</b> 쇼핑몰 주문 때 일회용 인증번호가 등록 이메일로 와요. 지금 쓰는 메일인지 확인해요.</li>
<li><b>배송지 우편번호:</b> 통관할 때 등록 주소와 배송지 우편번호를 대조해요. 받는 곳이 여러 곳이면 미리 등록해 둬요.</li>
</ul>
<p>확인과 갱신은 <a href="https://unipass.customs.go.kr/csp/persIndex.do" target="_blank" rel="noopener">관세청 개인통관고유부호 페이지</a>에서 해요. 직구각은 통관부호를 저장하거나 묻지 않아요.</p>
</section>
<section id="limit">
<h2>3. 면세 한도</h2>
<table>
<thead><tr><th scope="col">구분</th><th scope="col">면세 기준</th></tr></thead>
<tbody>
<tr><td>미국에서 특송·쇼핑몰 직배송</td><td>물품가격 $200 이하</td></tr>
<tr><td>미국에서 우편(EMS 등)</td><td>$150 이하</td></tr>
<tr><td>미국 외 국가</td><td>$150 이하</td></tr>
<tr><td>건강기능식품·의약품·식품류 (어디서든)</td><td>$150 이하 · 건강기능식품은 총 6병까지</td></tr>
</tbody>
</table>
<p>물품가격에는 판매국 세금과 현지 배송비가 들어가고, 결제 화면에 따로 적힌 국제 배송비는 빠져요. 한도를 넘으면 넘은 부분이 아니라 <b>배송비를 포함한 전체 금액</b>에 관세와 부가세가 붙어요. <a href="/calculator">관세 계산기</a>로 바로 확인해 보세요.</p>
</section>
<section id="combine">
<h2>4. 합산과세 주의</h2>
<ul>
<li>같은 판매자(해외공급자)에게서 <b>같은 날</b> 산 물건을 나눠 받으면 금액을 합쳐서 따져요.</li>
<li>하나의 운송장으로 들어온 물건을 나눠 통관해도 합쳐요.</li>
<li>영양제와 다른 상품을 한 상자에 섞으면 상자 전체가 $150 기준을 받아요.</li>
</ul>
<p>판매자가 다르거나 산 날짜가 다르면, 같은 날 도착해도 합산하지 않아요. 애매하면 관세청 고객지원센터(국번 없이 125)에 물어보세요.</p>
</section>
</article>`;
  return layout({ title: '해외직구 가이드: 영문 주소, 통관부호, 면세 한도', description: '해외직구 영문 주소 입력법, 개인통관고유부호 갱신, 미국 $200·그 외 $150 면세 한도와 합산과세 주의점.', urlPath: '/guide', body, current: '/guide' });
}

// ---------- 페이지: 고지·개인정보 ----------
function pageDisclosure() {
  const body = `
<div class="page-head"><h1 class="display">광고·제휴 고지</h1></div>
<article class="prose">
<p>직구각은 상품을 직접 팔지 않아요. 상품 페이지의 구매 버튼은 제휴 링크이고, 그 링크로 구매가 이뤄지면 직구각이 쇼핑몰로부터 수수료를 받을 수 있어요. <b>구매하는 분이 내는 가격은 똑같아요.</b></p>
<h2>참여 중인 제휴 프로그램</h2>
<ul><li>쿠팡 파트너스</li><li>아마존 어소시에이트 (Amazon Associates)</li><li>아이허브 제휴 프로그램${(site.affiliatePending || []).includes('iherb') ? ' (승인 대기 중 — 승인 전 아이허브 링크는 수수료가 없는 일반 링크예요)' : ''}</li><li>알리익스프레스 제휴 프로그램</li></ul>
<p>이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
<p lang="en">As an Amazon Associate I earn from qualifying purchases.</p>
<h2>판정 기준</h2>
<p>수수료와 관계없이 같은 기준으로 판정해요. 해외 최종 체감가(상품가 + 국제 배송비 + 예상 관세·부가세)가 국내 최저가보다 <b>20% 이상, 그리고 ₩${krw(RULE.minSaveKrw)} 이상</b> 싸면 '직구각', 조금이라도 싸면 '애매', 아니면 '국내가 나음'이에요. 국내가 나을 때는 국내 쇼핑몰 링크를 안내해요.</p>
<h2>가격 정보</h2>
<p>아마존 상품의 현재가는 직구각에 표시하지 않고, 국내 최저가로 계산한 '손익분기 가격'만 보여 드려요. 실제 가격은 쇼핑몰에서 확인해 주세요. 세액은 예상치이며 최종 세액은 세관 고지를 따릅니다.</p>
</article>`;
  return layout({ title: '광고·제휴 고지', urlPath: '/disclosure', body });
}
function pagePrivacy() {
  const body = `
<div class="page-head"><h1 class="display">개인정보처리방침</h1><p class="muted">시행일: ${esc(site.privacyEffective)}</p></div>
<article class="prose">
<p>${esc(site.businessName || site.siteName)}(운영자 ${esc(site.operator)}, 이하 '운영자')은 직구각 서비스를 운영하며, 이용자의 개인정보를 소중히 다룹니다.</p>
<h2>1. 수집하는 정보</h2>
<p>직구각은 회원가입이 없으며, 이름·연락처·주소·개인통관고유부호를 수집하거나 저장하지 않아요. 관세 계산기에 입력한 값은 이용자의 브라우저 안에서만 계산돼요.</p>
<p>서비스 개선을 위해 방문 기록(접속 페이지, 브라우저 종류, 대략적 지역 등)이 분석 도구(Google Analytics)를 통해 쿠키로 수집될 수 있어요.</p>
<p>사이트는 Vercel(미국)에서 운영돼요. 보안과 오류 확인을 위해 접속 기록(IP 주소, 접속 시각, 요청한 주소, 브라우저 정보)이 Vercel 서버에 일정 기간 자동으로 남아요.</p>
<h2>2. 검색 기능</h2>
<p>검색창에 입력한 검색어는 상품 가격을 찾기 위해 직구각 서버와 알리익스프레스 제휴 API로 전달돼요. 검색어는 이용자를 식별하는 정보와 연결해 저장하지 않으며, 같은 검색의 결과를 빠르게 보여 주기 위해 잠시 보관(캐시)될 수 있어요. 검색창에 이름·연락처·통관부호 같은 개인정보는 넣지 마세요.</p>
<h2>3. 제휴 링크와 쿠키</h2>
<p>구매 링크를 누르면 이동한 쇼핑몰(쿠팡, 아마존, 아이허브, 알리익스프레스 등)이 추천 경로 확인을 위해 쿠키를 설정할 수 있어요. 이 쿠키는 각 쇼핑몰의 개인정보처리방침을 따릅니다.</p>
<h2>4. 쿠키 거부</h2>
<p>브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있어요.</p>
<h2>5. 문의</h2>
<p>개인정보 관련 문의: ${esc(site.contactEmail)}</p>
</article>`;
  return layout({ title: '개인정보처리방침', urlPath: '/privacy', body });
}
function page404() {
  return layout({ title: '페이지를 찾을 수 없어요', urlPath: '/404', body: `<div class="page-head"><h1 class="display">페이지를 찾을 수 없어요</h1><p class="muted">주소가 바뀌었거나 없는 페이지예요.</p><a class="btn btn-buy" href="/">홈으로 가기</a></div>` });
}

// ---------- 출력 ----------
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'p'), { recursive: true });
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
fs.copyFileSync(path.join(root, 'src', 'calc.js'), path.join(dist, 'assets', 'calc.js'));

const write = (rel, content) => { const f = path.join(dist, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
write('index.html', pageHome());
write('calculator.html', pageCalculator());
write('search.html', pageSearch());
write('calendar.html', pageCalendar());
write('sale.html', pageSale());
write('calendar.ics', calendarIcs());
write('guide.html', pageGuide());
write('disclosure.html', pageDisclosure());
write('privacy.html', pagePrivacy());
write('404.html', page404());
for (const p of items) write(`p/${p.slug}.html`, pageProduct(p));

const urls = ['/', '/sale', '/calculator', '/calendar', '/guide', ...items.map((p) => `/p/${p.slug}`), '/disclosure', '/privacy'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${absUrl(u)}</loc><lastmod>${kstToday()}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${absUrl('/sitemap.xml')}\n`);

console.log(`빌드 완료: 페이지 ${8 + items.length}개 → dist/`);
for (const p of items) console.log(`  ${p.name.padEnd(20)} ${VERDICT[p.ev.verdict].label}${p.ev.kind === 'priced' ? ` (₩${krw(p.ev.cost.total)} vs ₩${krw(p.domesticKrw)})` : p.ev.kind === 'break' ? ` (손익분기 $${p.ev.breakeven})` : ''}`);
