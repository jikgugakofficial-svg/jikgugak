# 예약 작업 목록 (Claude 예약 작업 + GitHub Actions)

Claude 예약 작업은 저장소 밖(claude.ai 계정)에 있어서 여기에 적어 둬요. 새로 만들거나 고치거나 끝나면 이 표도 고쳐요. 예약 작업을 볼 때는 `list_triggers`, 고칠 때는 아래 ID로 `update_trigger`.

마지막 확인: 2026-11-03 17:20 KST

## 1. 매일·매주 반복 (Claude)
| 이름 | 언제 (KST) | 하는 일 | ID |
| --- | --- | --- | --- |
| 직구각 아침 점검 (가격·세일) | 매일 08:47 | price-checker 가격 확인(브라우저 연결 시), sale-scout 세일 확인·월요일 과세환율, site-inspector 점검 → 바뀐 것만 커밋, 3~6줄 보고 | trig_01H4ckXecQRyZNwn1qcboKcx |
| 직구각 저녁 점검 (가격만) | 매일 20:47 | price-checker 가격만, 컴퓨터 미연결이면 건너뜀 | trig_01JwQsfpXkRdnRwFsr1Jsosk |
| 직구각 주간 상품 후보 찾기 | 매주 월 08:46 | 웹 후보 5개 미만이면 product-scout 10개 → 브라우저 확인 → 통과만 등록(A안) | trig_019Nvm5rDoYYgxsqwYZ4T8kU |

## 2. 한 번만 (Claude, 11/3 기준 남은 것)
| 이름 | 언제 (KST) | 하는 일 | ID |
| --- | --- | --- | --- |
| 11/4 펨도필러스 스레드 당일 확인 | 11/4 08:20 | 그날 스레드 livecheck → approved:true(5% 규칙), 끝나면 다음 게시일 확인을 이어서 예약(11/8까지) | trig_01NhVsVK2uaWDcLMGFuAUJSJ |
| 11/4 릴스 v2 숫자 재확인·다시 굽기 | 11/4 10:00 | `tools/tvc/cart2_ad.py`로 다시 굽고 판정·5% 확인, 안 되면 v1로 대체 | trig_01PwNnwuCNhwVTuu73T6ddbE |
| 블프 후보 쿠팡·아마존 확인 | 11/4 14:10 | `candidates.json` blackfriday 등급 A 6개 쿠팡 최저가·아마존 한국 배송 확인 → 통과만 등록 | trig_01MBKCk98LDErxDzy52gtdHL |
| 11/4 릴스 게시 확인 | 11/4 12:35 | publish-result.json 확인, 빠졌으면 수동 실행 | trig_019MtuHfLBwocXm2zkbEoZnT |

릴스 v2·게시 확인 두 개는 운영자 컴퓨터(hans-win)에 묶여 있어요. 컴퓨터가 꺼져 있으면 돌지 않아요.

## 3. GitHub Actions (`.github/workflows/`)
| 작업 | 언제 (KST) | 하는 일 |
| --- | --- | --- |
| `coupang.yml` | 매시 41분, 실적 매일 09:20 | 등록 상품 가격 자동 반영, 후보 발굴, 사진 채우기, 실적 |
| `publish.yml` | 매시 07분 + 09:23·11:23·12:23·12:26·17:53·20:23 | 승인된 `publish.json` 게시(인스타·릴스·스레드·스토리), 직전 환율 확인. 예약 실행이 가끔 늦거나 빠짐 → status.md 7장 수동 실행 |
| `insights.yml` | 매일 23:10 | SNS 성과 → `content/_insights/latest.json` |
| `indexnow.yml` | 매일 12:10 | 오늘 고친 페이지를 IndexNow에 알림 |
| `refresh-tokens.yml` | 매주 월 10:00 | Meta 게시 토큰 갱신 |
| `fetch-assets.yml` | `content/_assets/request.txt` 푸시 때·수동 | 상품 사진(제휴 제공 이미지) 내려받기(카드·캡처용) |
| Vercel Cron (`vercel.json`) | 매일 11:30 | 환율 받아 사이트 다시 만들기 |
