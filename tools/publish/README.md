# 자동 게시 (인스타그램·스레드, Postiz)

운영자가 미리보기를 보고 "게시해"라고 하면, 매니저가 `content/<폴더>/publish.json`을 `"approved": true`로 만들어 push해요.
GitHub Actions(`.github/workflows/publish.yml`)가 Postiz로 올리고 결과를 `publish-result.json`에 커밋해요.

```json
{
  "approved": true,
  "schedule": "2026-10-23T11:00:00Z",
  "channels": {
    "instagram": { "images": ["cards/01.png", "cards/02.png"], "text": "캡션 #광고", "settings": { "post_type": "post" } },
    "threads": { "texts": ["첫 글 #광고"] }
  }
}
```
- `schedule`은 UTC. 비우면 2분 뒤. 한국 시간 저녁 8시 = 같은 날 11:00Z.
- 이미지는 폴더 안 경로. Postiz에 먼저 올린 뒤 그 주소로 게시해요.
- 한 번 올린 폴더는 `publish-result.json`이 생겨 다시 올라가지 않아요(다시 올리려면 그 파일을 지워요).
- 비밀값 `POSTIZ_API_KEY`는 GitHub 저장소 Settings → Secrets and variables → Actions에만 넣어요. 채팅·코드에 적지 않아요.
- 네이버 블로그는 공식 API가 없어서, 운영자 승인 뒤 매니저가 Claude in Chrome(운영자 크롬)으로 올려요.
