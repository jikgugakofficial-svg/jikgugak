// 홈: 판정 필터, 카테고리, 검색어로 카드 거르기
const cards = [...document.querySelectorAll('.grid .card')];
const empty = document.querySelector('.empty');
const note = document.querySelector('.search-note');
const params = new URLSearchParams(location.search);
const state = { verdict: 'all', cat: params.get('cat') || '', q: (params.get('q') || '').trim() };

const norm = (s) => s.toLowerCase().replace(/\s+/g, '');

function apply() {
  let shown = 0;
  for (const c of cards) {
    const ok = (state.verdict === 'all' || c.dataset.verdict === state.verdict)
      && (!state.cat || c.dataset.cat === state.cat)
      && (!state.q || norm(c.dataset.name).includes(norm(state.q)));
    c.hidden = !ok;
    if (ok) shown++;
  }
  empty.hidden = shown > 0;
  document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.verdict)));
  document.querySelectorAll('[data-cat-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.catFilter === state.cat)));
  if (state.q) {
    note.hidden = false;
    note.textContent = `'${state.q}' 검색 결과 ${shown}개`;
  } else note.hidden = true;
}

document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { state.verdict = b.dataset.filter; apply(); }));
document.querySelectorAll('[data-cat-filter]').forEach((b) => b.addEventListener('click', () => {
  state.cat = state.cat === b.dataset.catFilter ? '' : b.dataset.catFilter;
  apply();
  document.getElementById('today').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

const q = document.getElementById('q');
if (q && state.q) q.value = state.q;
apply();
if (state.q || state.cat) document.getElementById('today').scrollIntoView({ block: 'start' });
