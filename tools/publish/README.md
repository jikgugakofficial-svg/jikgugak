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
    "threads": { "texts": ["첫 글 #광고", "이어지는 글(답글로 붙어요)"] }
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

네이버 블로그는 공식 API가 없어서, 운영자 승인 뒤 매니저가 Claude in Chrome(운영자 크롬)으로 올려요.
