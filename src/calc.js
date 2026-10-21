// 직구각 계산 규칙. 사이트 빌드(Node)와 관세 계산기(브라우저)가 같은 파일을 씁니다.
// 근거: 관세법 시행규칙 제45조(물품가격 150달러), FTA관세특례법(미국발 특송 목록통관 200달러),
// 특송물품 고시 별표1(목록통관 배제 품목). 세율은 품목별 기본세율 예시라 실제와 다를 수 있습니다.

export const CATEGORIES = {
  it: { label: 'IT 액세서리·전자기기', sub: '관세 0% 예시', rate: 0, listClearance: true },
  home: { label: '주방·생활용품', sub: '관세 8% 예시', rate: 0.08, listClearance: true },
  apparel: { label: '의류·신발', sub: '관세 13%', rate: 0.13, listClearance: true },
  supplement: { label: '건강기능식품', sub: '관세 8% · 목록통관 배제', rate: 0.08, listClearance: false },
  book: { label: '도서', sub: '관세 0%', rate: 0, listClearance: true }
};

export const DEFAULT_RULE = { minSaveKrw: 10000, minSavePct: 0.2 };

// 원 미만 버림 (관세청 계산 방식과 같게)
const won = (n) => Math.floor(n);

export function dutyFreeLimit({ origin, method, category }) {
  const cat = CATEGORIES[category] || CATEGORIES.home;
  return origin === 'us' && method === 'express' && cat.listClearance ? 200 : 150;
}

// 해외 최종 체감가(원). 면세 판단은 국제 배송비를 뺀 물품가격으로, 과세는 배송비 포함 전체에.
export function landedCost({ priceUsd, shipUsd = 0, origin, method, category, fx }) {
  const cat = CATEGORIES[category] || CATEGORIES.home;
  const limit = dutyFreeLimit({ origin, method, category });
  const price = Math.max(0, Number(priceUsd) || 0);
  const ship = Math.max(0, Number(shipUsd) || 0);
  const dutyFree = price <= limit;
  // 과세가격은 달러 합계를 한 번에 원화로 바꿔요. 영수증 줄이 합계와 맞도록 배송비 줄은 차액으로 표시.
  const cif = won((price + ship) * fx);
  const goodsKrw = won(price * fx);
  const shipKrw = cif - goodsKrw;
  const duty = dutyFree ? 0 : won(cif * cat.rate);
  const vat = dutyFree ? 0 : won((cif + duty) * 0.1);
  const total = cif + duty + vat;
  let signal = 'green';
  if (!dutyFree) signal = 'red';
  else if (price > limit * 0.85) signal = 'yellow';
  return { limit, dutyFree, price, ship, goodsKrw, shipKrw, duty, vat, total, signal, rate: cat.rate };
}

// 판정: 20% 이상 그리고 10,000원 이상 싸면 직구각, 조금이라도 싸면 애매, 아니면 국내가 나음
export function judge(domesticKrw, totalKrw, rule = DEFAULT_RULE) {
  const dom = Number(domesticKrw) || 0;
  if (dom <= 0) return { verdict: 'none', diff: 0, pct: 0 };
  const diff = dom - totalKrw;
  const pct = diff / dom;
  if (diff >= rule.minSaveKrw && pct >= rule.minSavePct) return { verdict: 'good', diff, pct };
  if (diff > 0) return { verdict: 'meh', diff, pct };
  return { verdict: 'bad', diff, pct };
}

// 손익분기 상품가(달러): 이 가격 이하면 직구각. 어떤 가격이어도 안 되면 null.
export function breakevenUsd({ domesticKrw, shipUsd = 0, origin, method, category, fx }, rule = DEFAULT_RULE) {
  const cat = CATEGORIES[category] || CATEGORIES.home;
  const limit = dutyFreeLimit({ origin, method, category });
  const dom = Number(domesticKrw) || 0;
  const ship = Math.max(0, Number(shipUsd) || 0);
  const target = Math.min(dom * (1 - rule.minSavePct), dom - rule.minSaveKrw);
  if (target <= 0) return null;
  const freeMax = target / fx - ship;
  if (freeMax <= 0) return null;
  if (freeMax <= limit) return Math.floor(freeMax);
  const taxedMax = target / (fx * (1 + cat.rate) * 1.1) - ship;
  return Math.floor(taxedMax > limit ? taxedMax : limit);
}

export const formatKrw = (n) => Math.round(n).toLocaleString('ko-KR');
