# 자동 게시 (인스타그램·스레드, Meta 공식 API)

운영자가 미리보기를 보고 "게시해"라고 하면 매니저가:
1. `python3 tools/publish/prepare.py content/<폴더>` → `publish/*.jpg` 생성(인스타 API는 JPEG·공개 주소만 받아요. 빌드가 `www.jikgugak.com/social/<폴더>/`로 올려요)
2. `content/<폴더>/publish.json`을 `"approved": true`로 만들어 push

GitHub Actions(`.github/workflows/publish.yml`)가 push 직후와 매시 7분에 돌면서, 예약 시간이 지난 승인 글을 올리고 결과를 `publish-result.json`(게시물 주소 포함)으로 커밋해요.

```json
{
  "approved": true,
  "schedule": "2026-10-23T11:00:00Z",
  "channels": {
    "instagram": { "images": ["publish/01.jpg", "publish/02.jpg"], "text": "캡션 #광고" },
    "threads": { "texts": ["첫 글 #광고", "이어지는 글(답글로 붙어요)"], "topicTag": "해외직구" }
  }
}
```
- `schedule`은 UTC(한국 저녁 8시 = 같은 날 11:00Z). 비우면 바로. 예약은 매시 7분 점검이라 최대 1시간 늦을 수 있어요.
- 인스타 이미지는 1~10장. 스레드 글은 각 500자 이하, 두 번째부터 앞 글의 답글로 이어져요.
- 한 번 처리한 폴더는 `publish-result.json`이 생겨 다시 안 올라가요(실패한 채널을 다시 올리려면 그 파일을 지워요).
- 연결 확인: Actions → publish → Run workflow(mode: check) → `content/_publish-status.json`에 계정 이름이 기록돼요.

## 비밀값 (GitHub 저장소 Settings → Secrets and variables → Actions, 채팅·코드에 적지 않기)
- `IG_TOKEN`: 인스타그램 장기 토큰(Meta 앱 → Instagram → API setup with Instagram login → 토큰 생성)
- `THREADS_TOKEN`: 스레드 장기 토큰(Meta 앱 Threads 사용 사례 → 사용자 토큰 생성기)
- `GH_PAT`: 토큰 자동 연장용(이 저장소 Secrets 읽기·쓰기만 준 fine-grained 토큰). `refresh-tokens.yml`이 매주 월요일 연장해요. 토큰은 60일 안 쓰면 만료.

네이버 블로그는 공식 API가 없고 Claude 브라우저에서도 열리지 않아서, 매니저가 붙여 넣기용 게시 키트를 만들고 운영자가 직접 올려요.

## 릴스 (2026-10-26 추가)
- 영상 만들기: `python3 tools/cards/reel.py content/<폴더>` → `publish/reel.mp4`(1080×1920, 장당 3초, 배경음은 직구각 자작곡 `tools/cards/bgm/` 3곡 중 하나 — 인스타 음악은 API로 못 붙여요)
- publish.json 채널에 추가:
```json
"reels": { "video": "publish/reel.mp4", "text": "캡션(첫 줄 #광고)", "shareToFeed": false }
```
- `shareToFeed: false`면 프로필 그리드에는 안 올라가고 릴스 탭에만 올라가요(같은 내용의 카드뉴스와 겹치지 않게). 팔로워가 아닌 사람에게 퍼지는 건 릴스 쪽이에요.

## 게시 직전 환율 확인 (`fxCheck`)
카드·글에 달러를 원화로 바꾼 숫자(면세 한도, 아마존 손익분기)가 있으면 publish.json에 `fxCheck`를 적어요. 게시 직전에 `https://www.jikgugak.com/live.json`(매일 11:30 최신 환율로 다시 빌드)과 비교해서, 2천 원 넘게(만 원 반올림 숫자는 7천 원) 어긋나면 그 폴더는 올리지 않고 작업을 실패로 끝내요. GitHub가 실패 메일을 보내고, 매니저가 숫자를 고쳐 다시 렌더·push하면 다음 정시에 올라가요.
```json
"fxCheck": [
  { "usd": 200, "rate": "customs", "shown": "26만 6천 원", "note": "면세 한도 200달러" },
  { "usd": 150, "rate": "customs", "shown": "20만 원", "round": "10000" },
  { "breakeven": "amazon-sony-wh-1000xm6", "shown": "30만 8천 원" }
]
```
- `rate`: `customs`(관세청 과세환율, 면세 한도·무료배송 기준) 또는 `pay`(결제 환율). `breakeven`은 사이트가 계산한 아마존 손익분기 달러 × 결제 환율, 천 원 아래 버림.

## 스토리 공유 (2026-10-27~)
- 인스타(카드·릴스)가 새로 올라가면 같은 릴스 영상(없으면 카드 1장)을 **스토리로 한 번 더** 올려요. 승인된 글을 그대로 쓰는 것이라 따로 승인받지 않아요(운영자 10/27 "다 해줘").
- 결과는 publish-result.json에 `kind: "story"`로 남아요. 실패해도 본 게시는 그대로예요.
- 끄려면 그 폴더 publish.json에 `"story": false`.
- 스토리는 24시간 뒤 사라지니, 하이라이트(`docs/marketing/ig-profile.md` 6번)로 모으는 건 운영자가 앱에서 해요.

## 이미 올린 글에 답글·댓글 (2026-10-28 추가, 정정·추가 안내용)
새 폴더의 publish.json에 이렇게 적어요(운영자 승인 필수). 원 글 id는 그 글 폴더의 `publish-result.json`에 있어요.
```json
"channels": {
  "threadsReply": { "replyTo": "18118671422603330", "text": "정정: …" },
  "igComment": { "mediaId": "17949523632389088", "text": "정정: …" }
}
```
인스타 댓글은 토큰에 댓글 권한(instagram_business_manage_comments)이 있어야 해요. 없으면 그 채널만 실패로 남고 나머지는 올라가요.
