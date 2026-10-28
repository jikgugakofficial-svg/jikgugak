// 모든 페이지 공통: D-day 갱신, 공유, 인앱 브라우저에서 구매 링크 열기

const toastEl = document.querySelector('.toast');
let toastTimer;
export function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
}

// D-day: 빌드한 날이 아니라 보는 날 기준으로 다시 계산 (한국 시간)
function kstToday() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}
document.querySelectorAll('[data-dday]').forEach((el) => {
  const d = Math.round((Date.parse(el.dataset.dday) - Date.parse(kstToday())) / 864e5);
  const end = el.dataset.ddayEnd ? Math.round((Date.parse(el.dataset.ddayEnd) - Date.parse(kstToday())) / 864e5) : d;
  el.textContent = d > 0 ? 'D-' + d : d === 0 ? 'D-DAY' : end >= 0 ? '진행 중' : '종료';
});

// 가장 가까운 세일: 빌드 후 날짜가 지나도 오늘 기준으로 다시 골라요
try {
  const raw = document.getElementById('jg-sales');
  const today = kstToday();
  const list = raw ? JSON.parse(raw.textContent).filter((e) => (e.e || e.d) >= today).sort((a, b) => a.d.localeCompare(b.d)) : [];
  const nx = list[0];
  if (nx) {
    const days = Math.round((Date.parse(nx.d) - Date.parse(today)) / 864e5);
    const md = (iso) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8))}`;
    const long = (iso) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8))}일 ${'일월화수목금토'[new Date(iso + 'T00:00:00Z').getUTCDay()]}요일`;
    const set = (root, sel, text) => root.querySelectorAll(sel).forEach((el) => { el.textContent = text; });
    document.querySelectorAll('[data-next-sale]').forEach((root) => {
      set(root, '[data-ns-name]', nx.n);
      set(root, '[data-ns-dday]', days > 0 ? 'D-' + days : days === 0 ? 'D-DAY' : '진행 중');
      set(root, '[data-ns-stores]', nx.s);
      set(root, '[data-ns-date]', days <= 0 && nx.e ? `${md(nx.e)}까지` : long(nx.d));
      root.querySelectorAll('[data-ns-scope]').forEach((el) => { el.textContent = nx.k === 'domestic' ? '국내 쇼핑몰' : '해외 직구'; el.className = 'ns-scope ' + nx.k; });
    });
  }
} catch { /* 세일 정보가 없어도 화면은 그대로 */ }

// 공유: 휴대폰이면 공유 시트(카카오톡 나와의 채팅으로 PC에 보내기 가능), 아니면 링크 복사
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
document.querySelectorAll('[data-share]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const url = location.href;
    const title = btn.dataset.title || document.title;
    if (navigator.share) {
      try { await navigator.share({ title, text: title + ' · 직구각', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    toast((await copy(url)) ? '링크를 복사했어요. 카카오톡 나와의 채팅에 붙여 넣으면 PC에서 열 수 있어요.' : '주소창의 링크를 복사해 주세요.');
  });
});

// 인앱 브라우저(카카오톡·인스타 등)는 쇼핑몰 로그인이 풀려 있어 결제를 포기하기 쉬워요.
// 구매 링크를 누르면 외부 브라우저로 여는 길을 안내합니다.
const ua = navigator.userAgent || '';
const isKakao = /KAKAOTALK/i.test(ua);
const isInApp = isKakao || /Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|DaumApps|everytimeApp/i.test(ua);
const isAndroid = /Android/i.test(ua);
const isIOS = /iPhone|iPad|iPod/i.test(ua);

function iosGuide(href) {
  const wrap = document.createElement('div');
  wrap.className = 'inapp';
  wrap.innerHTML = `<div class="inapp-box" role="dialog" aria-modal="true" aria-labelledby="inapp-t">
    <h2 id="inapp-t">Safari로 열면 결제가 쉬워요</h2>
    <p>앱 안의 브라우저는 쇼핑몰 로그인이 풀려 있어요. 화면 아래나 위의 <b>공유(⋯) 버튼 → Safari로 열기</b>를 눌러 주세요.</p>
    <button type="button" class="btn btn-ink" data-act="copy">링크 복사하기</button>
    <a class="btn btn-line" data-act="go" href="#">그냥 여기서 열기</a>
  </div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    toast((await copy(href)) ? '복사했어요. Safari 주소창에 붙여 넣어 주세요.' : '링크를 길게 눌러 복사해 주세요.');
  });
  wrap.querySelector('[data-act="go"]').addEventListener('click', (e) => { e.preventDefault(); close(); location.href = href; });
  document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
  document.body.appendChild(wrap);
  wrap.querySelector('[data-act="copy"]').focus();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[data-out]');
  if (!a || !isInApp) return;
  const href = a.href;
  if (isAndroid) {
    e.preventDefault();
    if (isKakao) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(href);
    else location.href = 'intent://' + href.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
  } else if (isIOS) {
    e.preventDefault();
    iosGuide(href);
  }
});

// 상품 페이지: 구매 버튼이 화면 밖에 있으면 아래에 '사러 가기' 바를 띄워요
(() => {
  const bar = document.querySelector('[data-buybar]');
  const buy = document.querySelector('.pd .buy');
  if (!bar || !buy || !('IntersectionObserver' in window)) return;
  let buyVisible = true;
  const update = () => { bar.hidden = buyVisible || window.scrollY < 300; };
  new IntersectionObserver((es) => { buyVisible = es[0].isIntersecting; update(); }).observe(buy);
  window.addEventListener('scroll', update, { passive: true });
})();

// ---------- 베타 안내(첫 방문 1번) · 의견 보내기(둘러본 뒤 1번) ----------
// 저장값: jg_beta(안내 본 날), jg_pv(본 페이지 수), jg_t0(첫 방문 시각), jg_fb(의견 창 띄운 날), jg_fb_done(보냄)
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* 저장 안 돼도 동작 */ } },
};
const contactMail = (document.querySelector('a[href^="mailto:"]') || {}).href?.replace('mailto:', '') || 'jikgugak.official@gmail.com';
const track = (name, params) => { try { window.gtag && window.gtag('event', name, params || {}); } catch { /* 분석 없음 */ } };

function sheet(html, cls = '') {
  const wrap = document.createElement('div');
  wrap.className = 'fb-wrap ' + cls;
  wrap.innerHTML = `<div class="fb-box" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  function onKey(e) { if (e.key === 'Escape') close(); }
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-fb-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  return { wrap, close };
}

function openBeta() {
  const { wrap, close } = sheet(`
    <span class="fb-badge">BETA</span>
    <h2 id="fb-t">직구각은 지금 베타 서비스예요</h2>
    <p>관세·배송비까지 더한 최종가 비교를 매일 다듬고 있어요. 불편한 점이나 있었으면 하는 기능을 알려 주시면 <b>적극 반영해서</b> 더 좋은 사이트로 만들게요.</p>
    <div class="fb-btns"><button type="button" class="btn btn-ink" data-act="fb">의견 보내기</button><button type="button" class="btn btn-line" data-fb-close>둘러볼게요</button></div>`, 'fb-beta');
  wrap.querySelector('.fb-box').setAttribute('aria-labelledby', 'fb-t');
  wrap.querySelector('[data-act="fb"]').addEventListener('click', () => { close(); openFeedback('beta'); });
  wrap.querySelector('[data-fb-close]').focus();
  track('beta_notice_view');
}

function openFeedback(from = 'menu') {
  const { wrap, close } = sheet(`
    <button type="button" class="fb-x" data-fb-close aria-label="닫기">×</button>
    <h2 id="fb-t2">직구각, 써 보니 어떠세요?</h2>
    <p class="fb-sub">베타 기간 동안 보내 주신 의견을 하나하나 읽고 반영해요.</p>
    <form class="fb-form" novalidate>
      <fieldset class="fb-stars"><legend>사이트 평가</legend>
        <div class="fb-star-row">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rating" value="${n}"><span aria-hidden="true">★</span><span class="sr-only">${n}점</span></label>`).join('')}<span class="fb-star-txt" aria-live="polite"></span></div>
      </fieldset>
      <label class="fb-l" for="fb-msg">좋았던 점, 불편한 점, 원하는 기능</label>
      <textarea id="fb-msg" name="message" rows="4" maxlength="2000" placeholder="예) 아이허브 상품도 검색되면 좋겠어요"></textarea>
      <label class="fb-l" for="fb-mail">답장 받을 이메일 <span class="muted">(선택)</span></label>
      <input id="fb-mail" name="email" type="email" maxlength="200" autocomplete="email" placeholder="you@example.com">
      <input class="fb-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="fb-note">의견과 이메일은 답변과 사이트 개선에만 써요. <a href="/privacy#feedback">개인정보처리방침</a></p>
      <button type="submit" class="btn btn-ink">보내기</button>
      <p class="fb-msg" role="status"></p>
    </form>`, 'fb-main');
  wrap.querySelector('.fb-box').setAttribute('aria-labelledby', 'fb-t2');
  const form = wrap.querySelector('form');
  const status = wrap.querySelector('.fb-msg');
  const words = ['', '별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요'];
  form.addEventListener('change', (e) => { if (e.target.name === 'rating') wrap.querySelector('.fb-star-txt').textContent = words[e.target.value]; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = { rating: Number(fd.get('rating') || 0), message: String(fd.get('message') || ''), email: String(fd.get('email') || ''), website: String(fd.get('website') || ''), page: location.pathname, kind: from };
    if (!body.rating && !body.message.trim()) { status.textContent = '별점이나 의견 중 하나는 남겨 주세요.'; return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; status.textContent = '보내는 중이에요…';
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!d.ok) throw new Error(d.reason || 'fail');
      store.set('jg_fb_done', 1);
      track('feedback_submit', { rating: body.rating, from });
      form.innerHTML = `<p class="fb-done">고마워요! 보내 주신 의견은 운영자가 직접 읽고 반영할게요.</p><button type="button" class="btn btn-line" data-fb-close>닫기</button>`;
    } catch (err) {
      btn.disabled = false;
      status.innerHTML = `지금은 보내지 못했어요. <b>${contactMail}</b>로 메일 주시면 똑같이 반영할게요.`;
    }
  });
  setTimeout(() => form.querySelector('input[name="rating"]').focus(), 50);
  track('feedback_open', { from });
}
document.addEventListener('click', (e) => {
  const t = e.target.closest && e.target.closest('[data-feedback]');
  if (t) { e.preventDefault(); openFeedback('menu'); }
});

(() => {
  const now = Date.now();
  const pv = Number(store.get('jg_pv') || 0) + 1;
  store.set('jg_pv', pv);
  if (!store.get('jg_t0')) store.set('jg_t0', now);
  const inapp = document.querySelector('.inapp');
  // 1) 첫 방문: 베타 안내 (페이지가 그려진 뒤 잠깐 있다가)
  if (!store.get('jg_beta')) {
    store.set('jg_beta', new Date().toISOString().slice(0, 10));
    setTimeout(() => { if (!document.querySelector('.fb-wrap, .inapp')) openBeta(); }, 1200);
    return;
  }
  // 2) 둘러본 뒤: 4번째 페이지부터, 또는 첫 방문 후 3분이 지난 2번째 페이지부터. 의견을 보냈으면 다시 안 띄우고, 닫았으면 14일 뒤에 한 번 더.
  if (store.get('jg_fb_done') || inapp) return;
  const last = Number(store.get('jg_fb') || 0);
  if (last && now - last < 14 * 864e5) return;
  const t0 = Number(store.get('jg_t0') || now);
  if (pv >= 4 || (pv >= 2 && now - t0 > 3 * 60e3)) {
    setTimeout(() => {
      if (document.querySelector('.fb-wrap, .inapp, .inst-card')) return;
      store.set('jg_fb', Date.now());
      openFeedback('auto');
    }, 20000);
  }
})();

// ---------- 홈 화면에 앱 추가(재방문 편하게) ----------
// 크롬이 첫 방문에 바로 띄우는 설치 창은 막고, 다시 찾아온 사람에게만 작은 안내 카드를 보여요(10/28 운영자: 재방문 편하게).
// - 안드로이드 크롬·삼성 인터넷·PC 크롬: 카드의 [추가] → 브라우저 설치 창
// - 아이폰 사파리: 설치 창이 없어서 '공유 → 홈 화면에 추가' 방법을 보여 줘요
// - 이미 앱으로 열었거나, 카톡·인스타 같은 앱 안 브라우저면 안 보여요. 닫으면 30일 동안 다시 안 보여요.
// 저장값: jg_inst(카드 닫은 시각), jg_inst_done(설치함)
(() => {
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const appEvent = (to) => { const body = JSON.stringify({ src: 'app', to, page: location.pathname }); try { navigator.sendBeacon('/api/click', new Blob([body], { type: 'application/json' })); } catch { /* 집계 없음 */ } };
  if (standalone) {
    try { if (!sessionStorage.getItem('jg_app')) { sessionStorage.setItem('jg_app', '1'); appEvent('app_open'); } } catch { /* 무시 */ }
    return;
  }
  const isIOSSafari = isIOS && !isInApp && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  let deferred = null;
  const link = document.querySelector('[data-install]');
  const showLink = () => { if (link) link.hidden = false; };
  if (isIOSSafari) showLink();

  function iosSheet() {
    const { wrap } = sheet(`
      <h2 class="fb-title">아이폰 홈 화면에 직구각 추가</h2>
      <ol class="inst-steps">
        <li>화면 아래(또는 위)의 <b>공유 버튼</b>(네모에서 화살표가 위로 나온 모양)을 눌러요.</li>
        <li>목록을 내려 <b>홈 화면에 추가</b>를 눌러요.</li>
        <li>오른쪽 위 <b>추가</b>를 누르면 끝이에요. 다음부터 아이콘으로 바로 열려요.</li>
      </ol>
      <div class="fb-btns"><button type="button" class="btn btn-ink" data-fb-close>알겠어요</button></div>`, 'fb-inst');
    wrap.querySelector('[data-fb-close]').focus();
  }
  function otherSheet() {
    sheet(`
      <h2 class="fb-title">홈 화면에 직구각 추가</h2>
      <p class="muted">브라우저 메뉴(⋮ 또는 ≡)에서 <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 눌러 주세요. 다음부터 아이콘으로 바로 열려요.</p>
      <div class="fb-btns"><button type="button" class="btn btn-ink" data-fb-close>알겠어요</button></div>`, 'fb-inst');
  }
  async function install(from) {
    if (deferred) {
      appEvent('app_prompt');
      const ev = deferred; deferred = null;
      ev.prompt();
      try { await ev.userChoice; } catch { /* 무시 */ }
    } else if (isIOSSafari) iosSheet();
    else otherSheet();
    track('app_install_click', { from });
  }
  if (link) link.addEventListener('click', (e) => { e.preventDefault(); install('footer'); });

  function card() {
    if (store.get('jg_inst_done') || isInApp) return;
    const last = Number(store.get('jg_inst') || 0);
    if (last && Date.now() - last < 30 * 864e5) return;
    // 다시 찾아온 사람만: 첫 방문 다음 날 이후이거나, 페이지를 5개 이상 본 사람
    const t0 = Number(store.get('jg_t0') || Date.now());
    const pv = Number(store.get('jg_pv') || 0);
    if (!(Date.now() - t0 > 12 * 3600e3 || pv >= 5)) return;
    setTimeout(() => {
      if (document.querySelector('.fb-wrap, .inapp, .inst-card')) return;
      if (!deferred && !isIOSSafari) return;
      const el = document.createElement('div');
      el.className = 'inst-card';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', '홈 화면에 앱 추가');
      el.innerHTML = `<img src="/icon-192.png?v=2" alt="" width="40" height="40"><div class="inst-txt"><b>직구각을 홈 화면에 추가할까요?</b><span>다음엔 검색 없이 아이콘으로 바로 판정해요</span></div><button type="button" class="btn btn-ink small" data-i="add">추가</button><button type="button" class="inst-x" aria-label="닫기" data-i="x">×</button>`;
      const close = () => { el.remove(); store.set('jg_inst', Date.now()); };
      el.querySelector('[data-i="x"]').addEventListener('click', close);
      el.querySelector('[data-i="add"]').addEventListener('click', () => { close(); install('card'); });
      document.body.appendChild(el);
      appEvent('app_card');
    }, 6000);
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; showLink(); });
  window.addEventListener('appinstalled', () => { store.set('jg_inst_done', Date.now()); appEvent('app_install'); toast('홈 화면에 직구각을 추가했어요'); document.querySelector('.inst-card')?.remove(); if (link) link.hidden = true; });
  // 설치 창 이벤트는 페이지가 뜬 뒤 조금 늦게 와요. 아이폰은 바로.
  if (isIOSSafari) card(); else window.addEventListener('beforeinstallprompt', () => card(), { once: true });
})();

// 인기 검색어: 최근 7일 실제 검색이 5개 이상 모이면 '추천 검색어'를 '인기 검색어'로 바꿔 보여요
(async () => {
  const boxes = [...document.querySelectorAll('[data-trending]')];
  if (!boxes.length) return;
  if (boxes.every((b) => !b.offsetParent)) return; // 화면에 안 보이면(좁은 화면의 레일) 부르지 않아요
  try {
    const d = await fetch('/api/trending').then((r) => r.json());
    if (!d.ok || !d.enough) return;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    for (const b of boxes) {
      b.querySelector('[data-trend-title]').textContent = '인기 검색어';
      b.querySelector('[data-trend-sub]').textContent = '최근 7일 직구각 검색';
      b.querySelector('[data-trend-list]').innerHTML = d.items.map((x, i) => `<li><a href="/search?q=${encodeURIComponent(x.q)}"><i>${i + 1}</i>${esc(x.q)}</a></li>`).join('');
    }
  } catch { /* 추천 검색어 그대로 */ }
})();

// 구매 링크 클릭 수(합계만): 유입 채널(utm_source 또는 처음 들어온 곳) × 쇼핑몰 × 페이지. 누가 눌렀는지는 남기지 않아요.
(function trackClicks() {
  let src = '';
  try {
    const u = new URLSearchParams(location.search).get('utm_source');
    src = u || sessionStorage.getItem('jg_src') || '';
    if (!src) {
      const r = document.referrer ? new URL(document.referrer).hostname : '';
      src = !r ? 'direct' : /google\./.test(r) ? 'google' : /naver\./.test(r) ? 'naver' : /daum\.|kakao/.test(r) ? 'daum' : /instagram\./.test(r) ? 'instagram' : /threads\./.test(r) ? 'threads' : /bing\./.test(r) ? 'bing' : r.endsWith('jikgugak.com') ? 'direct' : 'etc';
    }
    sessionStorage.setItem('jg_src', src);
  } catch { src = src || 'direct'; }
  const storeOf = (h) => /coupang|coupa\.ng/.test(h) ? 'coupang' : /aliexpress/.test(h) ? 'aliexpress' : /amazon|amzn/.test(h) ? 'amazon' : /iherb/.test(h) ? 'iherb' : /naver/.test(h) ? 'naver' : 'other';
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[rel~="sponsored"], a[data-buy]');
    if (!a || !a.href) return;
    let host = ''; try { host = new URL(a.href).hostname; } catch { return; }
    const body = JSON.stringify({ src, to: storeOf(host), page: location.pathname });
    try { navigator.sendBeacon('/api/click', new Blob([body], { type: 'application/json' })); } catch { fetch('/api/click', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {}); }
  }, true);
})();
