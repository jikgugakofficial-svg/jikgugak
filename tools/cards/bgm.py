# 릴스 배경음악을 코드로 직접 만들어요(직구각 자작곡이라 저작권 문제 없음).
#   python3 tools/cards/bgm.py            → tools/cards/bgm/bgm-1.m4a, bgm-2.m4a, bgm-3.m4a (각 32초)
# reel.py가 폴더 이름에 따라 셋 중 하나를 골라 영상 길이에 맞춰 넣어요(끝 페이드아웃).
# 분위기: 120 BPM 경쾌한 팝(첫 박부터 킥, 매 박 킥 + 2·4박 클랩, 통통 튀는 베이스, 1마디 반복 훅).
# 120 BPM = 한 박 0.5초라서, reel.py의 카드 길이(2초·3초·4초)와 넘김 순간이 항상 박자에 맞아요. 말소리·가사 없음.
import os, subprocess, wave
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), 'bgm')
LEN = 32.0
BPM = 120
BEAT = 60 / BPM
BAR = BEAT * 4
rng = np.random.default_rng(11)

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

def tt(dur): return np.arange(int(SR * dur)) / SR

def rel(x, ms=25):
    # 음 끝을 부드럽게 줄여서 '틱' 소리(클릭)가 안 나게
    n = min(len(x), int(SR * ms / 1000))
    x[-n:] *= np.linspace(1, 0, n) ** 2
    return x

def saw(freq, t, n=8):
    # 고음이 거칠지 않게 배음 수를 제한한 톱니파
    return sum(((-1) ** (k + 1)) * np.sin(2 * np.pi * k * freq * t) / k for k in range(1, n + 1) if k * freq < 9000)

def pluck(freq, dur, vel, bright=6):
    t = tt(dur)
    env = (1 - np.exp(-t * 300)) * np.exp(-t * 7)
    return rel(vel * env * saw(freq, t, bright))

def stab(freq, dur, vel):
    t = tt(dur)
    env = (1 - np.exp(-t * 200)) * np.exp(-t * 5)
    return rel(vel * env * (0.6 * saw(freq, t, 5) + 0.4 * np.sin(2 * np.pi * freq * t)))

def bass(freq, dur, vel=0.30):
    t = tt(dur)
    env = (1 - np.exp(-t * 400)) * np.exp(-t * 4)
    return rel(vel * env * (np.sin(2 * np.pi * freq * t) + 0.25 * saw(freq, t, 4)))

def kick(vel=0.9):
    t = tt(0.32)
    f = 48 + 110 * np.exp(-t * 35)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)
    click = rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.25
    return rel(vel * (body + click) * np.minimum(1, t * 2000))

def clap(vel=0.32):
    t = tt(0.22)
    n = np.diff(rng.standard_normal(len(t)), prepend=0)
    env = np.exp(-t * 22)
    for d in (0.0, 0.011, 0.022):  # 손뼉 여러 번 겹친 느낌
        env = env + 0.6 * np.exp(-np.maximum(t - d, 0) * 120) * (t >= d)
    body = 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return rel(vel * (n * env * 0.5 + body))

def hat(vel=0.03, open_=False):
    t = tt(0.18 if open_ else 0.05)
    n = np.diff(rng.standard_normal(len(t)), prepend=0)
    return rel(vel * n * np.exp(-t * (18 if open_ else 90)) * np.minimum(1, t * 3000), 10)

def riser(dur, vel=0.06):
    # 4마디마다 다음 마디로 끌어올리는 짧은 바람 소리
    t = tt(dur)
    n = np.diff(rng.standard_normal(len(t)), prepend=0)
    return rel(vel * n * (t / dur) ** 2)

def add(buf, x, at):
    i = int(round(at * SR))
    if i >= len(buf): return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i]

# (코드 진행[근음 MIDI, 구성음], 훅[(박 위치, 코드 구성음 인덱스, 옥타브)], 이름)
VARIANTS = [
    ([(48, [0, 4, 7]), (43, [0, 4, 7]), (45, [0, 3, 7]), (41, [0, 4, 7])],      # C - G - Am - F (밝은 팝)
     [(0, 2, 1), (0.75, 1, 1), (1.5, 2, 1), (2, 0, 2), (3, 2, 1), (3.5, 1, 1)], 'bright'),
    ([(45, [0, 3, 7]), (41, [0, 4, 7]), (48, [0, 4, 7]), (43, [0, 4, 7])],      # Am - F - C - G (힘 있는 마이너)
     [(0, 0, 2), (0.5, 2, 1), (1, 0, 2), (1.75, 1, 1), (2.5, 2, 1), (3, 1, 1)], 'drive'),
    ([(40, [0, 3, 7]), (48, [0, 4, 7]), (43, [0, 4, 7]), (50, [0, 4, 7])],      # Em - C - G - D (경쾌한 펑키)
     [(0.5, 2, 1), (1, 1, 1), (1.5, 2, 1), (2.25, 0, 2), (2.75, 2, 1), (3.5, 0, 2)], 'funky'),
]

def song(prog, hook, name):
    n = int(SR * LEN) + SR
    drums, music = np.zeros(n), np.zeros(n)
    bars = int(LEN / BAR) + 1
    for b in range(bars):
        root, iv = prog[b % len(prog)]
        t0 = b * BAR
        # 드럼: 첫 박부터 바로 시작(첫 1초에 멈추지 않게)
        for q in range(4):
            add(drums, kick(), t0 + q * BEAT)
            add(drums, hat(0.045, open_=True), t0 + q * BEAT + BEAT / 2)
            for s in (0.25, 0.75):
                add(drums, hat(0.018), t0 + q * BEAT + BEAT * s)
            if q in (1, 3): add(drums, clap(), t0 + q * BEAT)
        if b % 4 == 3:
            add(drums, riser(BAR * 0.9), t0 + BAR * 0.1)
        # 베이스: 엇박 8분음표(통통 튀는 느낌)
        for e in range(8):
            off = 12 if e % 2 else 0
            add(music, bass(midi(root - 12 + off), BEAT * 0.45, 0.30 if e % 2 else 0.22), t0 + e * BEAT / 2)
        # 코드 스탭: 엇박마다
        for e in (0.5, 1.5, 2.5, 3.25):
            for s in iv:
                add(music, stab(midi(root + 12 + s), BEAT * 0.4, 0.05), t0 + e * BEAT)
        # 훅: 1마디짜리 같은 리듬을 코드만 바꿔 반복(귀에 남게). 첫 두 마디는 훅만 살짝 작게
        hv = 0.07 if b < 2 else 0.10
        for pos, idx, octv in hook:
            add(music, pluck(midi(root + 12 * (octv + 1) + iv[idx]), BEAT * 0.6, hv), t0 + pos * BEAT)
    # 킥이 칠 때 나머지 소리를 살짝 눌러 펌핑감(사이드체인)
    t = np.arange(n) / SR
    since = np.mod(t, BEAT)
    duck = 1 - 0.45 * np.exp(-since * 14)
    mix = drums + music * duck
    # 짧은 잔향
    for d, g in ((0.09, 0.14), (0.19, 0.07)):
        k = int(d * SR)
        mix[k:] += g * (music * duck)[:-k]
    mix = mix[: int(SR * LEN)]
    mix = np.tanh(mix * 1.1)
    f = int(SR * 0.01)
    mix[:f] *= np.linspace(0, 1, f)
    mix /= np.max(np.abs(mix)) + 1e-9
    return (mix * 0.89 * 32767).astype(np.int16)

os.makedirs(OUT, exist_ok=True)
for i, (prog, hook, name) in enumerate(VARIANTS, 1):
    x = song(prog, hook, name)
    st = np.stack([x, x], axis=1)
    tmp = f'{OUT}/bgm-{i}.wav'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'aac', '-b:a', '192k', f'{OUT}/bgm-{i}.m4a'], check=True)
    os.remove(tmp)
    print(f'{OUT}/bgm-{i}.m4a  {name} {BPM}bpm {LEN:.0f}s')
