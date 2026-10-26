// 같은 모델인지 볼 때 쓰는 공용 도우미(검색 화면 public/assets/search.js · 자동 후보 발굴 scripts/coupang.mjs 공용)
// 이름 끝 등급(Pro·Max·Plus·Ultra·Lite·Mini·SE 등)이 한쪽에만 있으면 다른 모델일 가능성이 커요
export const VARIANTS = [['pro', '프로'], ['max', '맥스'], ['plus', '플러스', '\\+'], ['ultra', '울트라'], ['lite', '라이트'], ['mini', '미니'], ['se'], ['air', '에어'], ['neo', '네오']];
export function variantsOf(t) {
  const s = ' ' + String(t).toLowerCase().replace(/[()\[\],/_-]/g, ' ') + ' ';
  return VARIANTS.filter((names) => names.some((n) => new RegExp(`[\\s\\d]${n}(?=[\\s\\d])`).test(s))).map((n) => n[0]);
}
export function variantMismatch(a, b) {
  const x = variantsOf(a), y = variantsOf(b);
  return x.some((v) => !y.includes(v)) || y.some((v) => !x.includes(v));
}
