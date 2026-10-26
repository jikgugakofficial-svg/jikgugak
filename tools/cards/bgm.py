# 릴스 배경음악을 코드로 직접 만들어요(직구각 자작곡이라 저작권 문제 없음).
#   python3 tools/cards/bgm.py            → tools/cards/bgm/bgm-1.m4a, bgm-2.m4a, bgm-3.m4a (각 32초)
# reel.py가 폴더 이름에 따라 셋 중 하나를 골라 영상 길이에 맞춰 넣어요(끝 1초 페이드아웃).
# 분위기: 잔잔하고 밝은 로파이(일렉 피아노 코드 + 베이스 + 부드러운 킥·하이햇). 말소리·가사 없음.
import os, subprocess, wave
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), 'bgm')
LEN = 32.0
rng = np.random.default_rng(7)

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

def rel(x, ms=40):
    # 음 끝을 부드럽게 줄여서 '틱' 소리(클릭)가 안 나게
    n = min(len(x), int(SR * ms / 1000))
    x[-n:] *= np.linspace(1, 0, n) ** 2
    return x

def epiano(freq, dur, vel=0.18):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 1.6) * (1 - np.exp(-t * 80))
    tone = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 3)
            + 0.12 * np.sin(2 * np.pi * 3 * freq * t) * np.exp(-t * 5))
    trem = 1 + 0.08 * np.sin(2 * np.pi * 4.5 * t)
    return rel(vel * env * tone * trem)

def bass(freq, dur, vel=0.22):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1, t * 60) * np.exp(-t * 1.2)
    return rel(vel * env * (np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(2 * np.pi * 2 * freq * t)), 60)

def kick(vel=0.5):
    t = np.arange(int(SR * 0.35)) / SR
    f = 50 + 70 * np.exp(-t * 30)
    return rel(vel * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * np.minimum(1, t * 400))

def hat(vel=0.05):
    t = np.arange(int(SR * 0.06)) / SR
    n = rng.standard_normal(len(t))
    n = np.diff(n, prepend=0)  # 고음만 남기기
    return rel(vel * n * np.exp(-t * 70) * np.minimum(1, t * 2000), 10)

def add(buf, x, at):
    i = int(at * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i]

# (템포, 코드 진행[근음 MIDI, 구성음 반음들], 멜로디 반짝임 여부)
VARIANTS = [
    (88, [(48, [0, 4, 7, 11]), (45, [0, 3, 7, 10]), (41, [0, 4, 7, 11]), (43, [0, 4, 7, 10])], True),   # C maj7 - Am7 - Fmaj7 - G7
    (94, [(41, [0, 4, 7, 11]), (43, [0, 4, 7, 9]), (45, [0, 3, 7, 10]), (40, [0, 3, 7, 10])], True),    # Fmaj7 - G6 - Am7 - Em7
    (82, [(50, [0, 3, 7, 10]), (43, [0, 4, 7, 11]), (48, [0, 4, 7, 11]), (45, [0, 3, 7, 10])], False),  # Dm7 - Gmaj7 - Cmaj7 - Am7
]

def song(bpm, prog, sparkle):
    buf = np.zeros(int(SR * LEN) + SR)
    beat = 60 / bpm
    bar = beat * 4
    bars = int(LEN / bar) + 1
    for b in range(bars):
        root, iv = prog[b % len(prog)]
        t0 = b * bar
        for k, s in enumerate(iv):  # 코드: 살짝 흩어 치기
            add(buf, epiano(midi(root + 12 + s), bar * 0.95, 0.13), t0 + k * 0.012)
            add(buf, epiano(midi(root + 12 + s), beat * 1.4, 0.07), t0 + beat * 2.5 + k * 0.01)
        add(buf, bass(midi(root - 12), beat * 1.8), t0)
        add(buf, bass(midi(root - 12 + 7), beat * 0.9, 0.16), t0 + beat * 2)
        if b >= 1:  # 첫 마디는 피아노만
            for q in range(4):
                if q in (0, 2): add(buf, kick(0.42), t0 + q * beat)
                add(buf, hat(0.02), t0 + q * beat + beat / 2)
                add(buf, hat(0.011), t0 + q * beat)
            add(buf, hat(0.014), t0 + 3.75 * beat)
        if sparkle and b % 2 == 1:  # 2마디마다 짧은 위 멜로디
            notes = [iv[-1], iv[2], iv[1]]
            for k, s in enumerate(notes):
                add(buf, epiano(midi(root + 24 + s), beat, 0.05), t0 + beat * (1 + k * 0.5))
    buf = buf[: int(SR * LEN)]
    # 아주 짧은 잔향(지연 합성) + 부드럽게
    for d, g in ((0.11, 0.22), (0.23, 0.12), (0.37, 0.06)):
        n = int(d * SR)
        buf[n:] += g * buf[:-n].copy()
    buf = np.tanh(buf * 1.2)
    fade = int(SR * 0.6)
    buf[:fade] *= np.linspace(0, 1, fade)
    buf /= np.max(np.abs(buf)) + 1e-9
    return (buf * 0.8 * 32767).astype(np.int16)

os.makedirs(OUT, exist_ok=True)
for i, (bpm, prog, sp) in enumerate(VARIANTS, 1):
    x = song(bpm, prog, sp)
    st = np.stack([x, x], axis=1)
    tmp = f'{OUT}/bgm-{i}.wav'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'aac', '-b:a', '192k', f'{OUT}/bgm-{i}.m4a'], check=True)
    os.remove(tmp)
    print(f'{OUT}/bgm-{i}.m4a  {bpm}bpm {LEN:.0f}s')
