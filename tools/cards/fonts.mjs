// 카드·캡처 폰트 통일: Pretendard(본문·제목)를 시스템에 설치해요. 이미 있으면 아무것도 안 해요.
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function ensureFonts() {
  try { if (/Pretendard/.test(execSync('fc-list', { encoding: 'utf8' }))) return; } catch { return; }
  const src = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');
  const dst = path.join(os.homedir(), '.local/share/fonts');
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(src)) if (f.endsWith('.ttf')) copyFileSync(path.join(src, f), path.join(dst, f));
  try { execSync('fc-cache -f', { stdio: 'ignore' }); } catch {}
}
