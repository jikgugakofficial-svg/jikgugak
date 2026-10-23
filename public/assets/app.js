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
      if (document.querySelector('.fb-wrap, .inapp')) return;
      store.set('jg_fb', Date.now());
      openFeedback('auto');
    }, 20000);
  }
})();

// 크롬의 "앱 설치" 자동 안내(미니 인포바)는 띄우지 않아요. 원하는 사람은 크롬 메뉴 → 홈 화면에 추가로 설치할 수 있어요.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); });
