# 직구각 운영 규칙 (모든 세션·직원 공통)

직구각(www.jikgugak.com)은 해외직구 최종 체감가(상품가 + 국제 배송비 + 관세·부가세)를 국내 최저가와 비교해 "직구각 / 애매 / 국내가 나음"을 판정하는 제휴 사이트예요. 운영자는 한승호(비개발자 1인 창업자), 문의 메일은 jikgugak.official@gmail.com.

**새 세션은 일을 시작하기 전에 `docs/status.md`(지금 상황·할 일·결정 사항)를 먼저 읽고, 일을 끝내면 그 파일을 고쳐 둬요.** 작업 전 `git pull --rebase`(다른 세션이 동시에 일해요).

## 문서 지도 (어디에 무엇이 있나)
| 문서 | 내용 |
| --- | --- |
| `docs/status.md` | 지금 상황·확정 방향·하지 않기로 한 것·일정·할 일 (원본) |
| `docs/marketing/product-context.md` | 직구각 한 장: 고객·경쟁·망설임·사람들의 말·배운 것 |
| `docs/marketing/voice.md` · `hook-rules.md` · `playbook.md` | 말투 · 훅 규칙 · 채널별 형식(블로그·릴스·캡션·댓글·스레드) |
| `docs/marketing/review-checklist.md` · `card-spec.md` · `motion-reference.md` · `ig-profile.md` | 검수표 · 카드 규격 · 영상 기법 · 인스타 프로필 점검 |
| `docs/handoffs.md` · `docs/court.md` · `docs/affiliate-terms.md` · `docs/faq.md` | 일 맡기는 쪽지 · 큰 결정 법정 · 제휴 약관 점검표 · 고객 문의 답변 기준 |
| `content/_plans/2026-10-26-5week-plan.md` | 10/27~11/30 5주 계획 (지난 계획은 `_plans/_archive/`) |
| `content/YYYY-MM-DD-주제/` · `content/guides/` · `content/_archive/` | 홍보 세트 · 검색어별 가이드(`/guide/<슬러그>`) · 지난 콘텐츠 |

## 구조
- `data/products.json` 상품, `data/events.json` 세일 일정, `data/settings.json` 환율·판정 기준·제휴 ID, `data/deals.json` 딜 페이지.
- `src/calc.js` 관세·판정 계산(사이트와 브라우저가 같이 씀), `scripts/build.mjs` 정적 사이트 생성 → `dist/`(상품 페이지 FAQ·구조화 데이터, `/llms.txt`, 사이트맵 포함).
- `api/search.js`·`api/item.js` 알리 제휴 API 검색·상품(Vercel 서버 함수, 키는 Vercel 환경 변수에만).
- `api/coupang.js` 쿠팡 실시간 검색: 같은 검색어는 Redis에 하루 저장(7일까지 지난 결과), 새 검색은 사이트 전체 1시간 1회, 쿠팡 거부 시 `cp:stop` 멈춤 → 운영자가 `/admin`에서 풀기. 키는 Vercel `COUPANG_ACCESS_KEY`·`COUPANG_SECRET_KEY`. 알리·쿠팡 이름 끝 등급(Pro·Max·Plus·미니 등)이 다르면 "모델이 다를 수 있어요"를 먼저 보여 줘요.
- 쿠팡 파트너스 공식 API: `scripts/lib/coupang.mjs`(서명·호출)·`scripts/coupang.mjs`(check·deeplink·links·prices·report)·`.github/workflows/coupang.yml`(매시간). 키는 GitHub Secrets에만. **검색은 1시간 10회 제한 → Actions 7회 + 사이트 1회**, 403·429가 한 번이라도 나면 `data/coupang-guard.json`에 멈춤 표시(사람이 지울 때까지 검색 안 함). 검색 결과 `productUrl`·딥링크는 제휴 링크라 열지 않아요. 결과 `data/coupang-status.json`, 실적 `data/coupang-report.json`.
- **등록 상품 가격 자동 반영(10/27 운영자 결정):** 매시간 쿠팡 5개(같은 상품 번호, itemId까지 같으면 ±30%, 없으면 ±15%)·알리 3개(같은 상품 번호 ±15%)를 products.json에 반영하고 checkedAt을 "날짜 쿠팡|알리 자동"으로. 국내가에 배송비가 따로 붙는 상품(domesticSource '+ 배송비 ₩')은 배송비를 더해 비교. 변화가 크거나, 판정 단어가 바뀌거나, 요약에 금액을 직접 쓴 문장이 있으면 반영하지 않고 `data/price-alerts.json`에 → 매니저·price-checker가 처리하고 지워요. 아이허브·아마존은 사람이 확인.
- **상품 후보:** 웹 검색 먼저(10/27 운영자): product-scout가 직구가 싸다는 근거가 있는 상품을 `data/candidates.json`(source:"web")에 → 매니저가 브라우저로 쿠팡 최저가(로켓직구 포함)·알리 일반가·같은 옵션 확인 → 통과하면 등록(A안), API가 가격을 이어서 갱신. API 자동 발굴(시간당 2개)은 보조. 새 상품 쿠팡 링크는 Actions coupang mode=deeplink/links.
- 홍보: `content/YYYY-MM-DD-주제/`(brief·blog·instagram·reel·threads·cards·review·publish.json), 카드 `tools/cards/render.mjs`, 영상 `tools/tvc/`, 게시 `tools/publish/`(README), 네이버 키트 `tools/publish/naver/kit.py`.
- 방문자 의견: 의견 창(`public/assets/app.js`) → `api/feedback.js`가 Upstash Redis에 저장(1년 자동 삭제) → `/admin`(ADMIN_KEY)에서 확인, 구매 링크 클릭도 여기. 환경 변수: KV_REST_API_URL·KV_REST_API_TOKEN·ADMIN_KEY(선택 RESEND_API_KEY).
- 확인: `npm test`(계산) → `npm run build` → `node scripts/audit.mjs`(점검). 배포는 main에 push하면 Vercel이 자동으로 해요.

## 판정 규칙
- 직구각 = 국내보다 20% 이상 **그리고** ₩10,000 이상 쌀 때. 조금이라도 싸면 애매, 아니면 국내가 나음.
- 면세 한도: 미국 특송 $200, 그 외·우편 $150, 건강기능식품·식품은 어디서든 $150(영양제 6병). **한도 판단은 일반 물품은 물품가(국제 배송비 제외), 건강기능식품·식품(정식 수입신고)은 배송비를 합친 금액**(관세청 FAQ, 10/28 반영). 넘으면 배송비 포함 전체에 과세.
- 아이허브: ₩40,000 미만 주문은 배송비 ₩6,000. 알리는 신규 회원가가 아닌 일반가, **일반가 = 알리 제휴 API 가격**(10/27 운영자 결정). 화면과 크게 다르면(옵션 차이 의심) 매니저가 확인.
- **같은 제품 확인(바코드 우선, 10/26 운영자 지시):** 상품마다 `match`를 기록해요. ① 쿠팡 "Global Trade Item Number"(바코드)와 아이허브 UPC·알리/아마존 상세의 바코드가 같으면 `method:"barcode"`. ② 한쪽에 바코드가 없으면(알리 대부분) 제조사 모델번호·옵션(색·축·용량·맛)을 맞춰 `method:"model"`. ③ 바코드가 다르지만 내용물이 같은 포장·용량·지역판 차이면 `method:"variant"` + `note`에 차이, 요약에도 밝혀요. 바코드가 같아도 상품 사진의 모델명·용량을 한 번 더 봐요. 안 맞으면 등록하지 않아요. 형식: `"match": {"method":"barcode","domestic":"쿠팡 바코드","overseas":"해외 바코드","model":"모델·옵션","note":"","checkedAt":"2026.10.26"}`. `scripts/audit.mjs`가 빠지거나 어긋난 걸 잡아요.
- **세일 일정 상태(10/28 운영자: "내가 검수 안 해도 되게"):** `confirmed`는 공식 출처 주소(`source`) 필수(블프 같은 고정 날짜는 `fixedDate:true`), 블로그·쿠폰 사이트만 2곳 이상 일치하면 `reported`(사이트 "공식 발표 전"), 그 밖엔 `expected`. audit가 출처 없는 확정을 잡고, 매니저는 2주 안에 시작하는 reported·expected 세일을 매일 아침 공식 페이지로 다시 확인해요.
- 환율 두 가지: 관세·면세 판단은 관세청 주간 과세환율(`fx`), 달러 결제 금액은 매매기준율(`payFx`). 빌드 때 `scripts/fx.mjs`가 API 키(KOREAEXIM_KEY·DATA_GO_KR_KEY)로 최신값을 받고, 실패하면 settings.json 값. 매일 11:30 Vercel Cron이 다시 만들어요.
- 요약 문장 속 손익분기는 `{be}`(달러)·`{beKrw}`(원화), 가격 차이는 `{diff}`·`{pct}`, 해외 체감가는 `{total}` 토큰으로. 판정 단어가 들어간 문장은 가격이 바뀔 때 price-checker가 다시 써요(바뀌면 빌드가 자동 문장으로 바꾸고 로그에 "⚠ 판정이 바뀌어").

## 절대 규칙 (어기면 제휴 계정이 정지돼요)
1. **제휴 링크를 직접 열거나 누르지 않기.** link.coupang.com, s.click.aliexpress.com, `tag=jikgugak-20`이 붙은 아마존 주소. 가격 확인은 `domesticCheckUrl`·`overseasCheckUrl`(일반 주소)만.
2. **아마존 가격을 사이트·글에 적지 않기.** "아마존가 $○○ 이하면 직구각"(손익분기)만. 아마존 가격 API 승인 전까지.
3. **긁어 온 데이터(비공식 API·스크래핑 서비스) 쓰지 않기.**
4. **구매·결제·가입·로그인·비밀번호 입력 금지.** 메시지·메일 발송도 사람이 확인한 뒤에만.
5. **광고 표시:** 홍보 글은 맨 위에 제휴 수수료 문구, 인스타는 "유료 광고 포함"/#광고. 쿠팡 링크가 있는 글엔 "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."
6. **브랜드 로고·남의 사진 쓰지 않기.** 상품 사진은 제휴 프로그램이 주는 이미지(쿠팡 파트너스, 알리 제휴 API)만.

## 직원(서브에이전트) — `.claude/agents/`
| 직원 | 하는 일 | 모델 |
| --- | --- | --- |
| price-checker | 상품 가격 확인·데이터 갱신 | sonnet |
| sale-scout | 세일 일정 확인·추가, 주간 환율 | haiku |
| site-inspector | 빌드·점검·화면 확인, 문제 보고(수정 안 함) | haiku |
| product-scout | 새 상품 후보 발굴·판정 초안 | sonnet |
| cs-responder | 고객 문의·댓글 답장 초안(발송 안 함) | sonnet |
| **마케팅팀** (모두 `product-context.md`부터 읽음) | | |
| marketing-lead (팀장) | 기획안·주간 계획, 최종 검수(숫자·규칙·말투)·직접 수정, 법정 | opus |
| trend-scout | 소재·상위 글 구조·훅 패턴·경쟁 서비스 조사 | haiku |
| blog-writer | 네이버 블로그 글 | sonnet |
| social-writer | 릴스 대본·캡션·스레드·카드 문구 | sonnet |
| card-designer | 카드 이미지(1080×1350) 제작·확인 | sonnet |
| seo-strategist | 사이트 페이지 검색·AI 답변 노출 점검, 새 페이지 후보, 월간 노출 점검(제안만) | sonnet |

매니저(메인 세션)가 일을 나눠 맡기고, 결과를 검토한 뒤 커밋·푸시해요. 직원은 커밋·푸시하지 않아요.

## 매니저 배정 규칙 (운영자는 담당자를 지정하지 않아요)
운영자는 "무엇을 원하는지"만 말해요. 매니저가 맞는 직원을 고르고, 여러 직원이 필요하면 나눠서 동시에 맡겨 결과를 합쳐 한 번에 보고해요. 간단한 일·한 줄 질문은 매니저가 바로 해요. 가벼운 확인은 haiku, 판단이 필요한 일은 sonnet, 매니저는 배정·검토·최종 결정.

| 이런 말·상황이면 | 맡길 직원 |
| --- | --- |
| 가격·판정이 틀렸다, 가격 바뀌었나, 정기 가격 점검 | price-checker → site-inspector |
| 세일·행사·캘린더·블프·환율 | sale-scout → site-inspector |
| 상품 추가, 이런 상품도 판정해 줘, 상품이 적다 | product-scout → (매니저 브라우저 확인·제휴 링크 생성) → site-inspector |
| 검색 유입, SEO, 구글·네이버·AI 검색에 안 잡힘, 새 페이지 기획 | seo-strategist → (사이트 수정은 매니저) → site-inspector |
| 홍보, 블로그, 릴스, 스레드, 방문자 늘리기 | (소재가 없으면 trend-scout) → marketing-lead 기획 → blog-writer·social-writer 동시 → (카드면 card-designer) → marketing-lead 검수 → 게시 승인 요청 |
| 고객 문의·메일·댓글·DM 내용, 답장 | cs-responder (판정 오류 신고면 price-checker 추가) |
| 큰 결정(새 기능·채널·직원·방향 전환), "법정 열어 줘" | 매니저가 `docs/court.md` 법정 → 운영자 결정 |
| 사이트 확인, 점검, 배포 전, 뭔가 이상하다 | site-inspector → 문제 유형별 직원 |
| 코드·디자인·화면 수정, 새 기능 | 매니저가 직접 (끝나면 site-inspector) |

## 운영 원칙 (운영자 지시)
- **모든 결정은 방문자가 가장 편한 방향으로.**
- **새 직원은 운영자 승인 후 채용:** 지금 직원으로 감당이 안 되는 일이 반복되면 새 직원(역할·모델·도구·이유)을 제안하고 승인 뒤에만 `.claude/agents/`에 추가. 기존 직원 역할을 크게 바꿀 때도 같아요.
- **일 맡기는 쪽지:** 직원을 부를 때 `docs/handoffs.md`의 쪽지 빈칸(기준 날짜·결과 파일·하지 말 것 필수)을 채워 프롬프트 맨 앞에. 직원은 쪽지에 없는 숫자·날짜를 지어내지 않고, 꼭 필요한 빈칸은 보고 맨 위에 "빈칸: 무엇".
- **이번 주 핵심 3개:** 매주 월요일(또는 그 주 첫 세션) 매니저가 `docs/status.md` 0장에 11/30 목표에 가장 가까운 일 3개와 안 할 일을 적고, 들어온 일이 부딪히면 운영자에게 알려요.
- **제품 맥락 한 장:** 마케팅 일이 끝나면 매니저가 `product-context.md` 9장 '배운 것'에 한 줄(날짜·근거) 추가, 버전 올림.
- **큰 결정은 법정 먼저:** 되돌리기 어렵거나 크게 드는 결정은 `docs/court.md`로 판결과 '뒤집히는 조건'을 받아 운영자에게 같이 보여 줘요. 판결문은 홍보에 쓰지 않아요.
- **제휴 약관 점검:** 새 제휴 승인·약관 변경·새 채널에 제휴 링크를 넣기 전에 `docs/affiliate-terms.md` 표를 채워요. "확인 안 됨" 칸의 행동은 하지 않아요.
- **게시 전 실물 확인(매니저 필수):** 글에 나오는 모든 상품을 매니저가 브라우저로 다시 확인. ① 쿠팡 일반 주소 가격·같은 모델(15초 간격) ② 아마존은 한국 배송 가능 여부(가격 기록 안 함) ③ 알리·아이허브 가격·배송비. 하나라도 달라졌으면 넘기지 않고 팀장에게 수정. 직원들은 웹 페이지를 직접 못 열어요.
- **게시:** 운영자가 미리보기를 보고 "게시해"(또는 시간 지정)라고 해야만. 인스타·스레드는 `content/<폴더>/publish.json`(approved: true) push → GitHub Actions가 Meta 공식 API로 게시(인스타는 스토리 자동 공유 1회). 핸들 @jikgugak.official. 네이버 블로그는 Claude 브라우저에서 열리지 않고 글쓰기 API도 없어서, 매니저가 게시 키트(아티팩트 + 사진 zip)를 주고 운영자가 직접 올려요. 비공식 자동 포스팅·댓글·팔로우·DM 자동화는 하지 않아요.
- 직원 결과는 매니저가 숫자·규칙 위반을 검토한 뒤에만 사이트에 반영해요.
- 운영자 확인이 꼭 필요한 일(제휴 가입·로그인·결제·글 게시·메일 발송·되돌리기 어려운 변경)만 운영자에게 물어요.
