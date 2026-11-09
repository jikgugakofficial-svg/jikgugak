# 예약 작업 목록 (Claude 예약 작업 + GitHub Actions)

Claude 예약 작업은 저장소 밖에 있어서 여기에 적어 둬요. 새로 만들거나 고치거나 끝나면 이 표도 고쳐요.

**11/3 운영자: 예약 작업을 운영자 PC의 Claude 앱(Code 탭, 저장소 `C:\Users\User\Documents\jikgugak`)으로 옮김.** 앱 예약 작업은 앱이 켜져 있을 때만 돌고, 꺼져 있던 시각의 작업은 다음에 켤 때 돌아요. 볼 때는 `list_scheduled_tasks`, 고칠 때는 아래 ID로 `update_scheduled_task`(작업 파일 `C:\Users\User\.claude\scheduled-tasks\<ID>\SKILL.md`). 앱 내장 브라우저로 쿠팡 일반 주소·아이허브·`/api/item`은 되고 알리 상품 화면은 안 떠요. 11/4부터 이 PC에 python(Python312 전체 경로)·gh(로그인 완료)가 있어서 **Actions 수동 실행·네이버 키트·릴스 굽기도 여기서 돼요**(11/4 ffmpeg·Playwright 설치, 굽는 법은 status.md 7장).

마지막 확인: 2026-11-03 19:00 KST

## 1. 매일·매주 반복 (Claude 앱, 이 PC)
| 이름 | 언제 (KST) | 하는 일 | ID |
| --- | --- | --- | --- |
| 직구각 스레드 당일 확인 | 일~금 08:20 | 그날 `content/<오늘>-th-*/publish.json` livecheck → approved:true(5% 규칙), 게시 시각 넘겨 실행되면 승인 안 하고 보고. 없는 날은 그냥 끝 | jikgugak-thread-livecheck |
| 직구각 아침 점검 (가격·세일) | 매일 08:47 | 가격(매니저 브라우저)·세일(sale-scout)·월요일 과세환율·후보 확인, site-inspector 점검 → 바뀐 것만 커밋, 3~6줄 보고 | jikgugak-morning-check |
| 직구각 저녁 점검 (가격만) | 매일 20:47 | 가격만, 브라우저 안 열리면 건너뜀 | jikgugak-evening-check |
| 직구각 상품 찾기·등록 | **매일 13:30**(11/9 운영자: 상품 서치·등록 꾸준히) | product-scout 1~3명 후보 → 쿠팡 공식 API·아마존 ASIN 웹 검색·알리 /api/item·아이허브 화면 확인 → 통과만 등록, 제휴 링크는 gh로 Actions links → 빌드·점검·푸시 | jikgugak-weekly-candidates |

## 2. 한 번만
| 이름 | 언제 (KST) | 하는 일 | 어디 · ID |
| --- | --- | --- | --- |
| 블프 후보 쿠팡·아마존 확인 | 11/4 14:10 | `candidates.json` blackfriday 등급 A 6개 쿠팡 최저가·아마존 한국 배송 확인 → 통과만 등록 | 앱 · jikgugak-bf-candidates-1104 |
| 11/4 릴스 v2 숫자 재확인·다시 굽기 | 11/4 10:00 | `tools/tvc/cart2_ad.py`로 다시 굽고 판정·5% 확인, 안 되면 v1로 대체 | claude.ai · trig_01PwNnwuCNhwVTuu73T6ddbE |
| 11/4 릴스 게시 확인 | 11/4 12:35 | publish-result.json 확인, 빠졌으면 gh로 수동 실행 | claude.ai · trig_019MtuHfLBwocXm2zkbEoZnT |

claude.ai에 남은 두 개는 python·gh가 필요해서 옮기지 않았어요(릴스는 운영자 릴스 세션 담당). 11/3에 끈 claude.ai 작업: 아침(trig_01H4ck…)·저녁(trig_01JwQs…)·주간 후보(trig_019Nvm…)·11/4 스레드 확인(trig_01NhVs…, 다음 날 이어 예약하던 방식 → 앱 매일 작업으로 바꿈)·블프 후보(trig_01MBKC…).

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
