// 세일 캘린더: 한 달 달력 + 카테고리·국내/해외 필터. 아래 목록과 같은 필터를 써요.
const data = JSON.parse(document.getElementById('jg-events').textContent);
const grid = document.querySelector('[data-cal-grid]');
const title = document.querySelector('[data-cal-title]');
const dayBox = document.querySelector('[data-cal-day]');
const items = [...document.querySelectorAll('.events .ev')];
const KST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const today = KST();
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const MAIN = (ev) => ev.c.find((c) => c !== 'general') || 'general';

let cat = 'all';
let scope = 'all';
let picked = '';
let y = Number(today.slice(0, 4));
let m = Number(today.slice(5, 7)) - 1;
const lastDate = data.reduce((a, e) => (e.e > a ? e.e : a), today);
const minYM = y * 12 + m;
const maxYM = Number(lastDate.slice(0, 4)) * 12 + Number(lastDate.slice(5, 7)) - 1;

const visible = (ev) => (cat === 'all' || ev.c.includes(cat)) && (scope === 'all' || ev.k === scope);

function render() {
  title.textContent = `${y}년 ${m + 1}월`;
  document.querySelector('[data-cal-prev]').disabled = y * 12 + m <= minYM;
  document.querySelector('[data-cal-next]').disabled = y * 12 + m >= maxYM;
  const first = new Date(Date.UTC(y, m, 1));
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = first.getUTCDay(); // 일요일 시작
  const evs = data.filter(visible);
  let html = ['일', '월', '화', '수', '목', '금', '토'].map((w, i) => `<div class="cal-w${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}">${w}</div>`).join('');
  for (let i = 0; i < lead; i++) html += '<div class="cal-d empty" aria-hidden="true"></div>';
  // 주마다 세일에 줄(레인)을 정해 두면 같은 세일이 한 줄로 이어져 보여요
  const LANES = 4;
  const laneOf = {};
  for (let ws = 1 - lead; ws <= days; ws += 7) {
    const a = iso(y, m, Math.max(1, ws)); const b = iso(y, m, Math.min(days, ws + 6));
    const inWeek = evs.filter((e) => e.d <= b && a <= e.e).sort((x, z) => (x.m !== z.m ? (x.m ? -1 : 1) : x.d === z.d ? z.e.localeCompare(x.e) : x.d.localeCompare(z.d))); // 대형 세일이 위 줄을 먼저 차지
    const used = [];
    for (const e of inWeek) {
      const s0 = e.d < a ? a : e.d; const e0 = e.e > b ? b : e.e;
      let lane = 0;
      while (used[lane] && used[lane].some(([s1, e1]) => s0 <= e1 && s1 <= e0)) lane++;
      (used[lane] ||= []).push([s0, e0]);
      laneOf[e.id + '@' + a] = lane;
    }
  }
  for (let d = 1; d <= days; d++) {
    const key = iso(y, m, d);
    const dow = (lead + d - 1) % 7;
    const weekKey = iso(y, m, Math.max(1, d - dow));
    const on = evs.filter((e) => e.d <= key && key <= e.e);
    const slots = Array(LANES).fill('<span class="cal-ev gap"></span>');
    let hiddenN = 0;
    for (const e of on) {
      const lane = laneOf[e.id + '@' + weekKey] ?? 0;
      if (lane >= LANES) { hiddenN++; continue; }
      const start = e.d === key || dow === 0 || d === 1;
      const end = e.e === key || dow === 6 || d === days;
      slots[lane] = `<span class="cal-ev c-${MAIN(e)}${start ? ' s' : ''}${end ? ' e' : ''}${e.m ? ' major' : ''}" title="${e.n}">${start ? `<span>${e.n}</span>` : '&nbsp;'}</span>`;
    }
    while (slots.length && slots[slots.length - 1].includes('gap') && !on.length) slots.pop();
    const more = hiddenN ? `<span class="cal-more">+${hiddenN}</span>` : '';
    const dots = on.slice(0, 4).map((e) => `<i class="c-${MAIN(e)}"></i>`).join('');
    html += `<button type="button" class="cal-d${key === today ? ' today' : ''}${key < today ? ' past' : ''}${picked === key ? ' picked' : ''}${dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}" data-day="${key}" aria-label="${m + 1}월 ${d}일, 세일 ${on.length}개"${on.length ? '' : ' tabindex="-1"'}>
      <span class="cal-n">${d}</span><span class="cal-evs">${slots.join('')}${more}</span><span class="cal-dots" aria-hidden="true">${dots}</span></button>`;
  }
  grid.innerHTML = html;
  applyList();
}

function applyList() {
  let shown = 0;
  for (const li of items) {
    const ev = data.find((e) => e.id === li.dataset.id);
    let ok = ev && visible(ev);
    if (ok && picked) ok = ev.d <= picked && picked <= ev.e;
    li.hidden = !ok;
    if (ok) shown++;
  }
  if (picked) {
    dayBox.hidden = false;
    const [, mm, dd] = picked.split('-');
    dayBox.querySelector('[data-cal-day-title]').textContent = `${Number(mm)}월 ${Number(dd)}일 진행 중인 세일 ${shown}개`;
  } else dayBox.hidden = true;
}

grid.addEventListener('click', (e) => {
  const b = e.target.closest('[data-day]');
  if (!b) return;
  picked = picked === b.dataset.day ? '' : b.dataset.day;
  render();
  if (picked) dayBox.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
document.querySelector('[data-cal-day-clear]').addEventListener('click', () => { picked = ''; render(); });
document.querySelector('[data-cal-prev]').addEventListener('click', () => { if (--m < 0) { m = 11; y--; } render(); });
document.querySelector('[data-cal-next]').addEventListener('click', () => { if (++m > 11) { m = 0; y++; } render(); });
const catBtns = [...document.querySelectorAll('[data-cal-cat]')];
catBtns.forEach((b) => b.addEventListener('click', () => { cat = b.dataset.calCat; catBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); }));
const scopeBtns = [...document.querySelectorAll('[data-ev-filter]')];
scopeBtns.forEach((b) => b.addEventListener('click', () => { scope = b.dataset.evFilter; scopeBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); }));
render();
