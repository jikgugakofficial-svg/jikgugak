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
