// Claude Code 차단 장치 (2026-11-06, 영상 '하네스 엔지니어링'에서 가져옴)
// CLAUDE.md에 글로만 적힌 규칙 중 어기면 되돌릴 수 없는 것을, 도구가 실행되기 전에 막아요.
// - 강제 덮어쓰기: git push --force/-f, git reset --hard (다른 세션 작업이 사라질 수 있음)
// - --affiliate 옵션: 제휴 링크(link.coupang.com, s.click.aliexpress.com, tag=jikgugak-20) 열기 (직구각 절대 규칙 1)
// 막으면 종료 코드 2 + 이유를 stderr로 → Claude가 그 이유를 읽고 다른 방법을 찾아요.
import fs from 'node:fs';

const affiliateMode = process.argv.includes('--affiliate');
let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const tool = String(input.tool_name || '');
const ti = input.tool_input || {};

const block = (why) => { process.stderr.write('[차단 장치] ' + why + '\n'); process.exit(2); };

const AFFILIATE = /(link\.coupang\.com|s\.click\.aliexpress\.com|[?&]tag=jikgugak-20)/i;
const isShell = tool === 'Bash' || tool === 'PowerShell';
const cmd = isShell ? String(ti.command || '') : '';

// 1) 되돌릴 수 없는 git 명령
if (isShell) {
  const parts = cmd.split(/&&|\|\||;|\n|\|/);
  for (const p of parts) {
    if (/\bgit\b.*\bpush\b/.test(p) && /(\s--force(-with-lease)?\b|\s-f\b|\s\+[\w\/.-]+)/.test(p))
      block('git 강제 push는 막혀 있어요. 다른 세션이 올린 작업이 사라질 수 있어요. git pull --rebase 후 일반 push를 하세요.');
    if (/\bgit\b.*\breset\b.*--hard\b/.test(p))
      block('git reset --hard는 막혀 있어요. 커밋 안 한 작업(다른 세션 것 포함)이 사라져요. 특정 파일만 되돌리려면 git restore <파일>을 쓰세요.');
  }
}

// 2) 제휴 링크 열기 (직구각)
if (affiliateMode) {
  const msg = '제휴 링크는 열 수 없어요(CLAUDE.md 절대 규칙 1, 어기면 제휴 계정 정지). 가격 확인은 domesticCheckUrl·overseasCheckUrl 일반 주소로 하세요.';
  // 주소를 직접 여는 도구: 브라우저 이동·새 탭·미리보기, 웹 읽기
  if (/(navigate|preview_start|tabs_create|WebFetch)$/.test(tool) || tool === 'WebFetch') {
    if (AFFILIATE.test(String(ti.url || ''))) block(msg);
  }
  // 페이지 안 자바스크립트로 이동
  if (/javascript_tool$/.test(tool) && AFFILIATE.test(String(ti.text || ''))) block(msg);
  // 명령어로 내려받기·열기 (코드 검색처럼 주소를 글자로만 다루는 건 허용)
  if (isShell && AFFILIATE.test(cmd) &&
      /\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm|Start-Process|start|explorer(\.exe)?|open|xdg-open)\b/i.test(cmd))
    block(msg);
}
process.exit(0);
