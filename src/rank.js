// 검색 결과 순위 매기기: 검색어와 상품명이 얼마나 맞는지 + 액세서리 내리기 + 판매량은 살짝만
// api/search.js(서버)에서 쓰고, scripts/test-rank.mjs로 확인해요.

// 상품명에 이 말이 있으면 '본품이 아니라 액세서리'일 가능성이 커요 (검색어에 같은 말이 있으면 예외)
export const ACCESSORY_WORDS = [
  '케이스', '커버', '키링', '열쇠고리', '키체인', '스트랩', '랜야드', '보호필름', '필름', '강화유리', '거치대', '홀더',
  '스티커', '파우치', '이어팁', '이어캡', '폼팁', '스킨', '교체용', '부품', '후크', '목걸이', '데칼', '범퍼', '프로텍터', '디스플레이 케이스', '진열장',
  'case', 'cover', 'keychain', 'keyring', 'strap', 'lanyard', 'film', 'protector', 'holder', 'sticker', 'pouch', 'skin',
  'replacement', 'decal', 'bumper',
  '분실 방지', '분실방지', '로프', '끈', '클리너', '청소', '이어훅', '이어패드', '교체형', '충전 스탠드', '충전 스테이션', '충전 패드', '충전기 패드', '무선 충전', 'cleaner', 'cleaning', 'earhook', '귀마개', '메모리폼', '이어 팁', '이어 패드', '교체 배터리', '배터리 교체', 'ear tips', 'eartips', 'ear tip'
];
// 정품이 아닌 호환·유사품 신호(살짝만 내려요)
const COMPAT_WORDS = ['호환', '스타일', '유사', 'compatible', 'style', 'for '];

// 한글 브랜드·제품명 ↔ 영어(알리 상품명은 둘이 섞여 있어요). 검색어 확장에도 써요.
export const ALIASES = {
  '에어팟': ['airpods', 'airpod'], '에어팟프로': ['airpods pro'], '아이폰': ['iphone'], '아이패드': ['ipad'], '맥북': ['macbook'], '애플워치': ['apple watch'],
  '갤럭시': ['galaxy'], '버즈': ['buds'], '갤럭시버즈': ['galaxy buds'], '레고': ['lego'], '다이슨': ['dyson'], '닌텐도': ['nintendo'], '스위치': ['switch'],
  '로지텍': ['logitech'], '소니': ['sony'], '샤오미': ['xiaomi'], '앤커': ['anker'], '베이스어스': ['baseus'], '유그린': ['ugreen'], '큐씨와이': ['qcy'],
  '키보드': ['keyboard'], '마우스': ['mouse'], '이어폰': ['earphone', 'earbuds'], '헤드폰': ['headphone', 'headphones'], '충전기': ['charger'],
  '보조배터리': ['power bank'], '허브': ['hub'], '텀블러': ['tumbler'], '스탠리': ['stanley'], '크록스': ['crocs'], '프로틴': ['protein'], '그라인더': ['grinder'],
  '스마트': ['smart'], '밴드': ['band'], '워치': ['watch'], '램프': ['lamp'], '헤드셋': ['headset'], '프로': ['pro'], '맥스': ['max'], '미니': ['mini'],
  '캡슐': ['capsule'], '보위': ['bowie'], '키크론': ['keychron'], '사운드피츠': ['soundpeats'], '사운드코어': ['soundcore'], '오왈라': ['owala'],
  '넥소드': ['nexode'], '스페이스': ['space'], '원': ['one'], '무선': ['wireless'], '기계식': ['mechanical'], '독거미': ['aula'], '에어로프레스': ['aeropress'],
  '칼하트': ['carhartt'], '비니': ['beanie'], '젠하이저': ['sennheiser'], '보스': ['bose'], '오디오테크니카': ['audio-technica', 'audiotechnica'], '삼성': ['samsung']
};
// 영어 → 한글 (알리 상품명이 한국어로 번역돼 있을 때도 영어 검색어가 걸리게)
const REVERSE = {};
for (const [ko, ens] of Object.entries(ALIASES)) for (const en of ens) (REVERSE[en.replace(/\s+/g, '')] ||= []).push(ko);
// 국내(쿠팡 등)에서도 같은 모델을 찾을 수 있는 브랜드
export const BRANDS = ['baseus', 'ugreen', 'anker', 'xiaomi', 'redmi', 'mi ', 'qcy', 'lenovo', 'logitech', 'sony', 'samsung', 'apple', 'lego', 'dyson', 'nintendo',
  'soundpeats', 'edifier', 'haylou', 'tronsmart', 'realme', 'oneplus', 'huawei', 'honor', 'tp-link', 'orico', 'essager', 'hoco', 'joyroom', 'remax', '70mai',
  'dreame', 'roborock', 'ecovacs', 'insta360', 'dji', 'fifine', 'maono', 'keychron', 'royal kludge', 'akko', 'ajazz', 'redragon', 'aula', 'attack shark',
  'philips', 'braun', 'jbl', 'bose', 'garmin', 'amazfit', 'xiaomi', 'ulefone', 'blackview', 'xteink', 'trimui', 'anbernic', 'miyoo', 'powkiddy', 'timemore', 'stanley',
  '베이스어스', '유그린', '앤커', '샤오미', '레드미', '큐씨와이', '레노버', '로지텍', '소니', '삼성', '애플', '레고', '다이슨', '닌텐도', '사운드피츠', '에디파이어',
  '하이루', '키크론', '로보락', '드리미', '어메이즈핏', '필립스', '타임모어', '스탠리', '앤버닉'];
const SPEC = /^\d+(\.\d+)?(w|mah|hz|khz|k|p|gb|tb|mm|cm|m|g|kg|v|a|ml|l|pcs|pc|in|ft|db|mbps|gbps|x|ch|bit)$/;
const NOT_MODEL = /^(usb\d*(\.\d)?|tws|rgb|pd\d*w?|qc\d*(\.\d)?|bt\d*|anc|hdmi\d*|ipx\d|ip\d+|type-?c|usb-?c|wifi\d*|wi-?fi\d*|5g|4g|3d|\d+-?in-?\d+|mp\d|h\d{3}|ddr\d|nvme|m2|1st|2nd|3rd|\d+th|v\d(\.\d)?|\d+s|\d+k\d*(hz)?|\d+p\d*|rj\d+|\d+gen\d*|gen\d+|\d+ch|x\d+|\d+x)$/;
// 상품명에서 브랜드·모델명 찾기 (둘 중 하나라도 있으면 국내 같은 상품과 비교할 수 있어요)
export function comparability(title) {
  const tl = String(title || '').toLowerCase();
  const brand = BRANDS.find((b) => (/[a-z]/.test(b) ? new RegExp(`(^|[^a-z])${b.trim()}([^a-z]|$)`).test(tl) : tl.includes(b)));
  const words = tl.split(/[\s,()/|\[\]+]+/).map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9-]+$/g, ''));
  const model = words.find((w) => w.length >= 2 && w.length <= 12 && /[a-z]/.test(w) && /\d/.test(w) && !SPEC.test(w) && !NOT_MODEL.test(w));
  return { brand: brand ? brand.trim() : '', model: model || '', comparable: Boolean(brand || model) };
}
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
  if (titleCompact.includes(t)) return true;
  return (ALIASES[t] || []).some((a) => titleCompact.includes(a.replace(/\s+/g, ''))) || (REVERSE[t] || []).some((k) => titleCompact.includes(k));
}

// 알리 API에 보낼 검색어 후보: 원래 검색어(한글·숫자 띄움) + 영어로 바꾼 검색어
export function queryVariants(q) {
  const toks = tokenize(q);
  const spaced = toks.join(' ');
  const english = toks.map((t) => (ALIASES[t] ? ALIASES[t][0] : t)).join(' ');
  return [...new Set([spaced, english].filter(Boolean))];
}

export function analyze(item, q) {
  const tokens = tokenize(q);
  const tl = lower(item.title);
  const tc = compact(item.title);
  const qc = compact(q);
  const hits = tokens.filter((t) => hasToken(tl, tc, t)).length;
  const coverage = tokens.length ? hits / tokens.length : 0;
  const words = tokens.filter((t) => !/^\d+$/.test(t));
  const wordHits = words.filter((t) => hasToken(tl, tc, t)).length;
  // 숫자 말고 '이름'이 들어 있어야 관련 상품: 단어 2개 이하면 전부, 3개 이상이면 60% 이상
  const relevant = words.length ? wordHits / words.length >= (words.length <= 2 ? 1 : 0.6) : hits > 0;
  const full = qc.length > 1 && tc.includes(qc);
  const qLower = lower(q);
  const accWord = ACCESSORY_WORDS.find((w) => tl.includes(w) && !qLower.includes(w));
  // "에어팟용", "아이폰 15용" 처럼 검색어 바로 뒤에 '용'이 붙으면 그 제품에 끼우는 액세서리
  const forUse = tokens.some((t) => t.length > 1 && !/^\d+$/.test(t) && new RegExp(`${t}[0-9a-z ]{0,8}용`).test(tl)) && !/용/.test(qLower);
  // "12/13/14/15", "2 3 4" 처럼 여러 모델 번호를 늘어놓은 상품명은 호환 액세서리인 경우가 많아요
  const modelList = /(\d+\s*[\/,]\s*){2,}\d+/.test(tl) || /(^|\s)(\d{1,2}\s+){3,}\d{1,2}(\s|$|용)/.test(tl);
  const compat = COMPAT_WORDS.some((w) => tl.includes(w) && !qLower.includes(w.trim()));
  return { coverage, relevant, full, accessory: Boolean(accWord || forUse || modelList), accWord: accWord || (forUse ? '~용' : modelList ? '여러 모델' : ''), compat };
}

const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export function rank(items, q, { limit = 12 } = {}) {
  const rows = items.map((it) => ({ it, a: analyze(it, q) })).filter((r) => r.a.relevant);
  // 기준 가격: 검색어를 다 담은 본품들의 중간값(없으면 전체)
  const core = rows.filter((r) => !r.a.accessory && r.a.coverage === 1).map((r) => r.it.price);
  const ref = median(core.length >= 3 ? core : rows.filter((r) => !r.a.accessory).map((r) => r.it.price)) || median(rows.map((r) => r.it.price));
  for (const r of rows) {
    const cheap = ref > 0 && r.it.price < ref * 0.3;
    r.flag = r.a.accessory || cheap;
    r.cmp = comparability(r.it.title);
    r.score = (r.cmp.comparable ? 0.7 : 0) + r.a.coverage * 3 + (r.a.full ? 1 : 0) - (r.a.accessory ? 3 : 0) - (cheap ? 1.5 : 0) - (r.a.compat ? 0.5 : 0) + Math.log10((r.it.orders || 0) + 1) * 0.3;
  }
  rows.sort((x, y) => y.score - x.score);
  return rows.slice(0, limit).map((r) => {
    const cheap = ref > 0 && r.it.price < ref * 0.3;
    const note = r.a.accessory ? '액세서리일 수 있어요' : r.a.compat ? '정품이 아닌 호환·유사품일 수 있어요' : cheap ? '다른 결과보다 훨씬 싸요 · 구성 확인' : '';
    return { ...r.it, accessory: r.flag, note, brand: r.cmp.brand, model: r.cmp.model, comparable: r.cmp.comparable, _score: Math.round(r.score * 100) / 100, _why: [r.a.accWord, r.a.compat ? '호환' : '', cheap ? '저가' : '', `일치 ${Math.round(r.a.coverage * 100)}%`].filter(Boolean).join(' ') };
  });
}
