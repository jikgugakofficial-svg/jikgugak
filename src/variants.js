// 같은 모델인지 볼 때 쓰는 공용 도우미(검색 화면 public/assets/search.js · 자동 후보 발굴 scripts/coupang.mjs 공용)
// 이름 끝 등급(Pro·Max·Plus·Ultra·Lite·Mini·SE 등)이 한쪽에만 있으면 다른 모델일 가능성이 커요
export const VARIANTS = [['pro', '프로'], ['max', '맥스'], ['plus', '플러스', '\\+'], ['ultra', '울트라'], ['lite', '라이트'], ['mini', '미니'], ['se'], ['air', '에어'], ['neo', '네오'], ['active', '액티브']];
export function variantsOf(t) {
  const s = ' ' + String(t).toLowerCase().replace(/[()\[\],/_-]/g, ' ') + ' ';
  return VARIANTS.filter((names) => names.some((n) => new RegExp(`[\\s\\d]${n}(?=[\\s\\d])`).test(s))).map((n) => n[0]);
}
export function variantMismatch(a, b) {
  const x = variantsOf(a), y = variantsOf(b);
  return x.some((v) => !y.includes(v)) || y.some((v) => !x.includes(v));
}

// ---------- 알리·쿠팡 상품이 같은 모델인지(검색 화면에서 한 카드로 묶을 때) ----------
// 브랜드(한글 이름 포함)가 같고, 모델 번호(T13·WH-1000XM5처럼 글자+숫자)가 하나 이상 같고, 등급이 다르지 않을 때만 '같은 모델'로 봐요.
// 쿠팡 이름에 모델 번호가 없으면 묶지 않아요(틀리게 묶는 것보다 따로 보여 주는 게 나아요).
export const BRAND_ALIASES = {
  logitech: ['로지텍'], anker: ['앤커'], ugreen: ['유그린'], baseus: ['베이스어스'], xiaomi: ['샤오미', 'mi'], redmi: ['레드미'], amazfit: ['어메이즈핏', '어매이즈핏'],
  soundcore: ['사운드코어'], edifier: ['에디파이어'], qcy: ['큐씨와이'], aula: ['아울라', '독거미'], sony: ['소니'], samsung: ['삼성', '갤럭시'], apple: ['애플'],
  lego: ['레고'], dyson: ['다이슨'], nintendo: ['닌텐도'], keychron: ['키크론'], soundpeats: ['사운드피츠'], bose: ['보스'], jbl: ['제이비엘'], dji: ['디제이아이'],
  lenovo: ['레노버'], roborock: ['로보락'], dreame: ['드리미'], philips: ['필립스'], timemore: ['타임모어'], stanley: ['스탠리'], naturehike: ['네이처하이크'], mchose: ['엠초즈']
};
const BRAND_KEYS = Object.keys(BRAND_ALIASES);
const low = (s) => String(s || '').toLowerCase();
const word = (t, w) => new RegExp(`(^|[^a-z0-9가-힣])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9가-힣])`).test(t) || (/[가-힣]/.test(w) && t.includes(w));
export function brandOf(title) {
  const t = low(title);
  return BRAND_KEYS.find((b) => word(t, b) || BRAND_ALIASES[b].some((k) => k.length > 1 && word(t, k))) || '';
}
const SPEC = /^\d+(\.\d+)?(w|mah|hz|khz|k|p|gb|tb|mm|cm|m|g|kg|v|a|ml|l|pcs|pc|in|ft|db|mbps|gbps|x|ch|bit|ea|개|매|정|입)$/;
const NOT_MODEL = /^(usb\d*|tws|rgb|pd\d*w?|qc\d*|bt\d*|anc|enc|hdmi\d*|ipx\d|ip\d+|typec|usbc|wifi\d*|5g|4g|3d|\d+in\d+|mp\d|ddr\d|nvme|m2|v\d+|\d+s|\d+k\d*|\d+p\d*|rj\d+|gen\d+|\d+gen\d*|\d+ch|x\d+|\d+x|2024|2025|2026)$/;
export function modelCodes(title) {
  const t = low(title).replace(/[()[\],/|·]+/g, ' ');
  const out = new Set();
  const toks = t.split(/\s+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].replace(/^[^a-z0-9]+|[^a-z0-9+-]+$/g, '');
    const c = w.replace(/[-+]/g, '');
    if (c.length >= 2 && c.length <= 14 && /[a-z]/.test(c) && /\d/.test(c) && !SPEC.test(c) && !NOT_MODEL.test(c)) out.add(c);
    // "WH 1000XM5", "Band 10" 처럼 띄어 쓴 모델: 글자 단어 + 숫자 단어를 붙여서도 봐요
    const n = (toks[i + 1] || '').replace(/[^a-z0-9]/g, '');
    if (/^[a-z]{1,4}$/.test(c) && /\d/.test(n) && !SPEC.test(n)) out.add(c + n);
  }
  return [...out];
}
export function sameModel(a, b) {
  const ba = brandOf(a), bb = brandOf(b);
  if (ba && bb && ba !== bb) return false;
  if (!ba && !bb) return false;
  if (variantMismatch(a, b)) return false;
  const ca = modelCodes(a), cb = modelCodes(b);
  return ca.some((x) => cb.includes(x));
}
