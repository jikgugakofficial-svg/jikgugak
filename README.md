# 직구각

해외직구 최종 체감가(상품가 + 국제 배송비 + 관부가세)를 국내 최저가와 비교해 **직구할 각인지** 판정해 주는 사이트입니다.

## 페이지

| 주소 | 내용 |
| --- | --- |
| `/` | 홈 · 오늘의 직구각, 카테고리·판정 필터, 검색 |
| `/p/상품주소` | 판정 상세 · 체감가 영수증, 면세 신호등, 리스크, 구매 버튼 |
| `/calculator` | 관세 계산기 |
| `/calendar` | 세일 캘린더 (구글 캘린더 추가, `.ics` 구독) |
| `/guide` | 직구 가이드 · 영문 주소, 통관부호, 면세 한도, 합산과세 |
| `/disclosure`, `/privacy` | 광고·제휴 고지, 개인정보처리방침 |

## 내용 고치는 곳 (코딩 없이)

모든 내용은 `data` 폴더의 파일 3개에서 바뀝니다. GitHub 웹에서 파일을 열고 연필 아이콘으로 고친 뒤 저장(Commit)하면 Vercel이 1~2분 안에 사이트를 다시 만듭니다.

### `data/products.json` · 상품

```json
{
  "slug": "multivitamin-120",        // 주소에 쓰일 영문 이름 (/p/multivitamin-120)
  "name": "종합비타민 120정",
  "store": "iherb",                  // iherb · amazon · aliexpress · coupang
  "category": "supplement",          // it · home · apparel · supplement · book
  "origin": "us",                    // us(미국) · other(그 외)
  "method": "express",               // express(특송·직배송) · post(우편)
  "priceUsd": 22.40,                 // 해외 가격(달러). 아마존은 null로 두기
  "shipUsd": 3.90,                   // 국제 배송비(달러)
  "domesticKrw": 54900,              // 국내 최저가(원)
  "domesticSource": "네이버쇼핑 최저가",
  "domesticStore": "쿠팡",           // 국내 구매 버튼에 표시할 쇼핑몰 이름
  "domesticUrl": "",                 // 국내 제휴 링크(쿠팡 파트너스 단축 링크 등)
  "buyUrl": "",                      // 해외 제휴 링크. 둘 다 비어 있으면 '구매 링크 준비 중'
  "sample": true,                    // 실제 가격으로 바꾸면 false
  "risks": ["목록통관 배제 품목"],
  "summary": ["직구 전에 알아둘 3줄"]
}
```

판정이 **국내가 나음**이면 국내 구매 버튼이 위(빨간 버튼)에, 아니면 해외 구매 버튼이 위에 나옵니다.

**아마존 상품은 `priceUsd`를 `null`로 두세요.** 아마존 규정상 가격은 API(Creators API) 승인 전까지 직접 적을 수 없어서, 사이트는 국내 최저가로 계산한 **손익분기 가격**만 보여 주고 방문자가 아마존 가격을 직접 넣어 판정하게 합니다.

### `data/settings.json` · 사이트 설정

- `fx.usdKrw`, `fx.label`: 관세청 과세환율. 매주 [UNI-PASS](https://unipass.customs.go.kr/)에서 확인해 바꿔 주세요.
- `rule`: 직구각 판정 기준 (기본: 20% 이상, 15,000원 이상 저렴)
- `contactEmail`, `operator`: 문의 메일과 운영자 이름 (지금은 `[ ]` 빈칸)
- `ga4Id`: 구글 애널리틱스 측정 ID (`G-`로 시작)
- `googleVerification`, `naverVerification`: 서치 콘솔·서치어드바이저 소유 확인 코드

### `data/events.json` · 세일 캘린더

행사 이름, 날짜(`YYYY-MM-DD`), 쇼핑몰, 한 줄 안내. `settings.json`의 `featuredEvent`에 적힌 행사가 홈 배너에 나옵니다.

## 내 컴퓨터에서 미리 보기 (선택)

Node.js 18 이상이 있으면:

```bash
npm test        # 관세 계산 규칙 점검
npm run preview # http://localhost:4173
```

## 배포

Vercel에서 이 저장소를 가져오면 `vercel.json` 설정대로 `npm run build` 후 `dist` 폴더가 배포됩니다. 추가 패키지는 없습니다.
