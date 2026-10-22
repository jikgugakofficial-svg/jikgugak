// 검색 결과 순위 매기기: 검색어와 상품명이 얼마나 맞는지 + 액세서리 내리기 + 판매량은 살짝만
// api/search.js(서버)에서 쓰고, scripts/test-rank.mjs로 확인해요.

// 상품명에 이 말이 있으면 '본품이 아니라 액세서리'일 가능성이 커요 (검색어에 같은 말이 있으면 예외)
export const ACCESSORY_WORDS = [
  '케이스', '커버', '키링', '열쇠고리', '키체인', '스트랩', '랜야드', '보호필름', '필름', '강화유리', '거치대', '홀더',
  '스티커', '파우치', '이어팁', '이어캡', '폼팁', '스킨', '교체용', '부품', '후크', '목걸이', '데칼', '범퍼', '프로텍터', '디스플레이 케이스', '진열장',
  'case', 'cover', 'keychain', 'keyring', 'strap', 'lanyard', 'film', 'protector', 'holder', 'sticker', 'pouch', 'skin',
  'replacement', 'decal', 'bumper'
];
// 정품이 아닌 호환·유사품 신호(살짝만 내려요)
const COMPAT_WORDS = ['호환', '스타일', '유사', 'compatible', 'style', 'for '];

const lower = (s) => String(s || '').toLowerCase();
const compact = (s) => lower(s).replace(/[\s\-_/·,.()[\]{}+]+/g, '');

// "에어팟2" → ["에어팟","2"], "MX Master 3S" → ["mx","master","3s"]
export function tokenize(q) {
  return lower(q)
    .split(/\s+/)
    .flatMap((w) => w.split(/(?<=[가-힣])(?=[a-z0-9])|(?<=[a-z0-9])(?=[가-힣])/))
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
}

function hasToken(titleLower, titleCompact, t) {
  if (/^\d+$/.test(t)) return new RegExp(`(^|[^0-9])${t}([^0-9]|$)`).test(titleLower); // 숫자는 2가 2024에 걸리지 않게
  return titleCompact.includes(t);
}

export function analyze(item, q) {
  const tokens = tokenize(q);
  const tl = lower(item.title);
  const tc = compact(item.title);
  const qc = compact(q);
  const hits = tokens.filter((t) => hasToken(tl, tc, t)).length;
  const coverage = tokens.length ? hits / tokens.length : 0;
  const full = qc.length > 1 && tc.includes(qc);
  const qLower = lower(q);
  const accWord = ACCESSORY_WORDS.find((w) => tl.includes(w) && !qLower.includes(w));
  // "에어팟용", "아이폰 15용" 처럼 검색어 바로 뒤에 '용'이 붙으면 그 제품에 끼우는 액세서리
  const forUse = tokens.some((t) => t.length > 1 && !/^\d+$/.test(t) && new RegExp(`${t}[0-9a-z ]{0,8}용`).test(tl)) && !/용/.test(qLower);
  const compat = COMPAT_WORDS.some((w) => tl.includes(w) && !qLower.includes(w.trim()));
  return { coverage, full, accessory: Boolean(accWord || forUse), accWord: accWord || (forUse ? '~용' : ''), compat };
}

const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export function rank(items, q, { limit = 12 } = {}) {
  const rows = items.map((it) => ({ it, a: analyze(it, q) }));
  // 기준 가격: 검색어를 다 담은 본품들의 중간값(없으면 전체)
  const core = rows.filter((r) => !r.a.accessory && r.a.coverage === 1).map((r) => r.it.price);
  const ref = median(core.length >= 3 ? core : rows.filter((r) => !r.a.accessory).map((r) => r.it.price)) || median(rows.map((r) => r.it.price));
  for (const r of rows) {
    const cheap = ref > 0 && r.it.price < ref * 0.3;
    r.flag = r.a.accessory || cheap;
    r.score = r.a.coverage * 3 + (r.a.full ? 1 : 0) - (r.a.accessory ? 3 : 0) - (cheap ? 1.5 : 0) - (r.a.compat ? 0.5 : 0) + Math.log10((r.it.orders || 0) + 1) * 0.3;
  }
  rows.sort((x, y) => y.score - x.score);
  return rows.slice(0, limit).map((r) => {
    const cheap = ref > 0 && r.it.price < ref * 0.3;
    const note = r.a.accessory ? '액세서리일 수 있어요' : r.a.compat ? '정품이 아닌 호환·유사품일 수 있어요' : cheap ? '다른 결과보다 훨씬 싸요 · 구성 확인' : '';
    return { ...r.it, accessory: r.flag, note, _score: Math.round(r.score * 100) / 100, _why: [r.a.accWord, r.a.compat ? '호환' : '', cheap ? '저가' : '', `일치 ${Math.round(r.a.coverage * 100)}%`].filter(Boolean).join(' ') };
  });
}
