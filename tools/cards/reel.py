# 카드뉴스(cards/NN.png, 1080x1350)를 릴스·쇼츠용 세로 영상(1080x1920, 9:16)으로 만들어요.
#   python3 tools/cards/reel.py content/<폴더>   → content/<폴더>/publish/reel.mp4
# 표지는 2.5초, 나머지는 장마다 3초, 마지막 장은 3.5초. 장 사이 0.3초 페이드. 무음 오디오 트랙을 넣어요(앱 호환).
# 위아래 여백은 남색, 카드는 가운데. 릴스 화면 아래쪽(캡션·버튼 자리)은 카드 바깥이라 글자가 가려지지 않아요.
import glob, os, subprocess, sys

d = sys.argv[1].rstrip('/')
cards = sorted(glob.glob(f'{d}/cards/[0-9][0-9].png'))
if not cards:
    sys.exit(f'{d}/cards/NN.png 가 없어요. 먼저 render.mjs를 돌려 주세요.')
os.makedirs(f'{d}/publish', exist_ok=True)
out = f'{d}/publish/reel.mp4'
fade = 0.3
durs = [2.5] + [3.0] * (len(cards) - 2) + [3.5] if len(cards) > 1 else [4.0]

args = ['ffmpeg', '-y', '-loglevel', 'error']
for c, t in zip(cards, durs):
    args += ['-loop', '1', '-t', f'{t + fade:.2f}', '-i', c]
args += ['-f', 'lavfi', '-t', f'{sum(durs) + fade:.2f}', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100']

parts = []
for i in range(len(cards)):
    parts.append(f'[{i}:v]scale=1080:1350,pad=1080:1920:0:285:color=0x1F2E57,setsar=1,fps=30,format=yuv420p[v{i}]')
chain, last, offset = [], 'v0', 0.0
for i in range(1, len(cards)):
    offset += durs[i - 1]
    nxt = f'x{i}'
    chain.append(f'[{last}][v{i}]xfade=transition=fade:duration={fade}:offset={offset - fade * (i - 1):.2f}[{nxt}]')
    last = nxt
fc = ';'.join(parts + chain)
args += ['-filter_complex', fc, '-map', f'[{last}]', '-map', f'{len(cards)}:a',
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', '-r', '30', out]
subprocess.run(args, check=True)
dur = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout.strip()
print(f'릴스 {out} · {len(cards)}장 · {float(dur):.1f}초 · {os.path.getsize(out) // 1024} KB')
