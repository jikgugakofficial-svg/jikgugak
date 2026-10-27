# 15초 세로 광고 C안 "신호등 저울" — 박자 표 한 곳에서 화면(timeline.js)과 음악(music.wav)을 같이 만들고 굽기
#   python3 tools/tvc/c_ad.py            → content/2026-10-27-tvc-15s-c/publish/tvc-c.mp4
#   STILLS=1 python3 tools/tvc/c_ad.py   → 박마다 정지 화면(publish/tvc-c_stills/)
#   SUB=8 python3 tools/tvc/c_ad.py      → 모션 블러 서브프레임 수(기본 4)
# 120 BPM, 한 박 0.5초, 15초 = 30박. 곡은 numpy로 직접 합성(저작권 없음)해서 박 시각이 샘플 단위로 정확해요.
# 레퍼런스 분석: content/2026-10-27-tvc-15s-c/analysis.md
import json, os, subprocess, sys, wave
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R  # 악기(킥·클랩·하이햇·베이스·효과음) 재사용

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-10-27-tvc-15s-c')
OUT = os.path.join(D, 'publish')
BPM, BEATS = 120, 30
B = 60 / BPM
DUR = BEATS * B

# ── 박자 표 (화면과 소리가 같이 읽어요) ────────────────────
TL = {
    'bpm': BPM, 'beats': BEATS,
    # 1막: 저울이 생김
    'dot': 0, 'beam': 1, 'base': 2, 'pans': 3, 'gap': 3.72, 'drop': 4,
    # 2막: 무게가 박마다 떨어짐 [이름, 박, 무게, 쪽]
    'round1': [['dom', 4, 10, 'L'], ['prod', 6, 5, 'R'], ['ship', 8, 3.5, 'R'], ['duty', 9, 1.2, 'R'], ['vat', 10, 5, 'R']],
    'lampPop': 12, 'lampSplit': 12.5, 'cycle1': [13, 14], 'hit1': 14,
    'flood1': [14, 14.7], 'contract1': [16, 16.8], 'swap': 15.2,
    'round2': [['dom2', 17, 10, 'L'], ['prod2', 18, 3, 'R'], ['tax2', 19, 1, 'R']],
    'cycle2': [19.25, 20], 'hit2': 20,
    'gap2': 21.7, 'slant': 22, 'gap3': 25.72, 'end': 26, 'url': 28, 'hold': 28.6,
}
# 자막: [글자, 박, 나가는 박, x, y, 크기, 색, 글꼴, 기울기, 어긋남]
WORDS = [
    ['직구가', 0.5, 3.7, 0, 400, 92, 'ink', 'D', -8, 0],
    ['진짜', 1.0, 3.7, 0, 400, 92, 'ink', 'D', -8, 0],
    ['더 쌀까?', 1.5, 3.7, 0, 400, 92, 'orange', 'D', -8, 0],
    ['국내 최저가', 4.5, 6, 0, 400, 88, 'navy', 'D', -8, 0],
    ['직구는', 6.5, 8, 0, 400, 88, 'orange', 'D', -8, 0],
    ['가벼워 보여도', 7.0, 8, 0, 400, 88, 'ink', 'D', -8, 0],
    ['배송비', 8, 9, 0, 400, 120, 'orange', 'D', -10, 1],
    ['관세', 9, 10, 0, 400, 120, 'orange', 'D', -10, 1],
    ['부가세', 10, 11, 0, 400, 120, 'orange', 'D', 10, 1],
    ['다 더하면', 11, 12.5, 0, 400, 92, 'ink', 'D', -8, 0],
    ['더 비싸요', 11.5, 12.5, 0, 400, 92, 'blue', 'D', -8, 0],
    ['이번엔', 15, 16, 0, 900, 96, 'white', 'D', -8, 0],
    ['국내가 나음', 15.5, 16, 0, 1040, 132, 'white', 'D', 8, 1],
    ['다른 상품은?', 16.75, 19.5, 0, 400, 92, 'ink', 'D', -8, 0],
    ['이번엔', 20, 22, 0, 400, 96, 'ink', 'D', -8, 0],
    ['직구각!', 20.5, 22, 0, 400, 120, 'green', 'D', 10, 1],
    ['한눈에', 22.5, 26, 0, 780, 104, 'salmon', 'D', -8, 0],
    ['비교하니까', 23, 26, 0, 780, 104, 'white', 'D', -8, 0],
    ['더 저렴하고,', 24, 26, 0, 960, 130, 'white', 'D', -6, 1],
    ['현명한 쇼핑', 25, 26, 0, 1130, 130, 'salmon', 'D', 6, 1],
    ['직구각', 27, None, 0, 1000, 160, 'white', 'D', -6, 1],
    ['관세까지 다 더해서 판정', 27.5, None, 0, 1140, 54, 'white', 'P', 0, 0],
]
# 같은 줄에 있는 단어는 x를 자동으로 나눠요(화면에서 계산)
TL['words'] = WORDS


def write_timeline():
    with open(os.path.join(D, 'timeline.js'), 'w', encoding='utf-8') as f:
        f.write('window.TL=' + json.dumps(TL, ensure_ascii=False) + ';\n')


# ── 음악 ────────────────────────────────────────────────
def music(path):
    add, N, SR = R.add, int(R.SR * DUR), R.SR
    assert N == R.N, '음악 길이가 15초가 아니에요'
    bt = lambda n: n * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    # 0~4박 인트로: 저울이 생길 때마다 음이 올라가는 뜯는 소리, 반박 째깍, 상승음
    for n, f in zip(range(4), (440.0, 523.25, 659.25, 880.0)):
        add(mel, bt(n), R.pluck(f, 0.4), 1.5)
        add(mel, bt(n), R.pluck(f / 2, 0.4), 0.8)
    for k in range(7):
        add(dr, bt(0.5 + k * 0.5), R.hat(), 0.5)
    add(fx, bt(0.5), R.riser(bt(TL['gap']) - bt(0.5)), 0.7)
    for b in (0.5, 1.0, 1.5):
        add(fx, bt(b), R.tick(), 0.9)
    # 4박 드롭(직전 0.14초는 비움)
    add(fx, bt(4), R.boom(), 1.0)
    add(fx, bt(4), R.crash(1.4), 0.7)
    add(mel, bt(4), R.stab(ch[0], 0.5), 1.1)
    # 4~12박 그루브
    for n in range(4, 12):
        add(dr, bt(n), R.kick(n == 4), 1.0)
        add(dr, bt(n + 0.5), R.hat(), 0.75)
        if n % 2 == 1:
            add(dr, bt(n), R.clap(), 0.7)
        add(mel, bt(n + 0.5), R.bass(roots[(n // 2) % 4], B * 0.45))
    # 추가 떨어질 때 쿵(무게만큼 크게)
    for name, b, w, side in TL['round1']:
        add(fx, bt(b), R.thud(), min(1.0, 0.45 + w * 0.06))
    add(fx, bt(10), R.bell(1318.5), 0.6)  # 부가세에 기울어 넘어가는 순간
    for b in (8, 9, 10):
        add(fx, bt(b), R.tick(), 0.7)
    # 12~14박 빌드: 신호등 불이 16분음표로 돌 때마다 째깍, 스네어 연타, 상승음
    add(mel, bt(12), R.pluck(587.33, 0.3), 1.2)
    add(fx, bt(12.5), R.whoosh(0.25), 0.6)
    add(dr, bt(12), R.kick(), 0.9)
    add(dr, bt(13), R.kick(), 0.9)
    c0, c1 = TL['cycle1']
    for k in range(int((c1 - c0) * 4)):
        t = bt(c0 + k * 0.25)
        add(fx, t, R.tick(), 0.9)
        add(dr, t, R.snare(0.25 + k * 0.08), 1.0)
    add(fx, bt(12.5), R.riser(bt(13.95) - bt(12.5)), 0.8)
    # 14박 첫 판정: 쾅 + 번짐
    add(fx, bt(14), R.boom(), 1.0)
    add(fx, bt(14), R.crash(), 0.8)
    add(fx, bt(14), R.whoosh(0.35), 0.7)
    add(mel, bt(14), R.stab(ch[3], 0.6), 1.1)
    for n in range(14, 21):
        add(dr, bt(n), R.kick(n in (14, 16, 20)), 1.0)
        add(dr, bt(n + 0.5), R.hat(), 0.7)
        add(dr, bt(n + 0.25), R.hat(), 0.35)
        add(dr, bt(n + 0.75), R.hat(), 0.35)
        if n % 2 == 1:
            add(dr, bt(n), R.clap(), 0.7)
        add(mel, bt(n + 0.5), R.bass(roots[(n // 2) % 4], B * 0.45))
        add(mel, bt(n), R.bass(roots[(n // 2) % 4], B * 0.3), 0.5)
    add(fx, bt(15.5), R.thud(), 0.6)  # "국내가 나음" 착지
    add(fx, bt(16), R.whoosh(0.4), 0.7)  # 색이 불로 다시 줄어듦
    for name, b, w, side in TL['round2']:
        add(fx, bt(b), R.thud(), min(1.0, 0.45 + w * 0.06))
    c0, c1 = TL['cycle2']
    for k in range(int((c1 - c0) * 4)):
        add(fx, bt(c0 + k * 0.25), R.tick(), 0.8)
    add(fx, bt(20), R.bell(1760.0), 0.8)
    add(fx, bt(20), R.crash(1.2), 0.6)
    add(mel, bt(20), R.stab((523.25, 659.25, 783.99), 0.6), 1.1)
    add(fx, bt(20.5), R.thud(), 0.6)
    # 21.7 비우고 22박 남색 사선(쉬는 구간): 패드 + 단어마다 가벼운 킥·클랩
    add(fx, bt(21.5), R.whoosh(0.3), 0.8)
    add(mel, bt(22), R.pad(ch[1], bt(4)), 1.1)
    add(dr, bt(22), R.kick(True), 0.8)
    for b, g in ((22.5, 0.5), (23, 0.6), (24, 0.9), (25, 0.9)):
        add(dr, bt(b), R.kick(), g)
        add(fx, bt(b), R.thud(), g * 0.6)
    add(dr, bt(23), R.clap(), 0.5)
    add(dr, bt(25), R.clap(), 0.6)
    for n in range(22, 25):
        add(dr, bt(n + 0.5), R.hat(), 0.4)
    for k in range(6):
        add(dr, bt(24.25 + k * 0.25), R.snare(0.3 + k * 0.1))
    add(fx, bt(24.5), R.riser(bt(TL['gap3']) - bt(24.5)), 0.8)
    # 26박 마지막 강타 → 로고
    add(fx, bt(26), R.boom(), 1.0)
    add(fx, bt(26), R.crash(), 0.9)
    add(mel, bt(26), R.stab(ch[0], 0.6), 1.2)
    for n in (26, 27, 28):
        add(dr, bt(n), R.kick(n in (26, 28)), 1.0)
    add(dr, bt(27), R.clap(), 0.7)
    add(fx, bt(26.25), R.tick(), 0.8)
    add(mel, bt(26.5), R.pluck(880.0, 0.4), 1.2)
    add(fx, bt(27), R.thud(), 0.7)
    add(mel, bt(27), R.stab(ch[2], 0.5), 0.9)
    add(fx, bt(27.5), R.tick(), 0.6)
    add(mel, bt(28), R.stab((440.0, 523.25, 659.25, 880.0), 2.0), 1.2)
    add(mel, bt(28), R.bass(110.0, 1.6), 1.0)
    add(fx, bt(28), R.bell(1760.0), 0.5)
    # 강타 직전 비우기(gap): 모든 소리를 0.14초 끔
    def silence(b0, b1):
        i, j = int(bt(b0) * SR), int(bt(b1) * SR)
        for arr in (dr, mel, fx):
            arr[i:j] *= np.linspace(1, 0, j - i) ** 6
    silence(TL['gap'], 4)
    silence(TL['gap2'], 22)
    silence(TL['gap3'], 26)
    # 킥 박마다 멜로디를 살짝 눌러 펌핑
    duck = np.ones(N)
    for n in list(range(4, 22)) + [26, 27, 28]:
        i = int(bt(n) * SR); m = int(0.2 * SR); j = min(N, i + m)
        duck[i:j] = np.minimum(duck[i:j], 0.45 + 0.55 * np.arange(j - i) / m)
    mix = dr * 0.8 + mel * duck * 0.9 + fx * 0.8
    mix = R.sosfilt(R.sos('highpass', 30), mix)
    k = int(0.35 * SR); mix[-k:] *= np.linspace(1, 0, k)
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    d = int(0.012 * SR); right = mix.copy(); right[d:] = 0.88 * mix[d:] + 0.12 * mix[:-d]
    st = np.stack([mix, right], 1); st = st / (np.abs(st).max() + 1e-9) * 0.7
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    write_timeline()
    html = os.path.join(D, 'ad.html')
    r = ['node', os.path.join(ROOT, 'tools/tvc/render_html.mjs'), html]
    if os.environ.get('STILLS'):
        ts = os.environ.get('T') or ','.join(f'{b * B + 0.12:.2f}' for b in range(30))
        subprocess.run(r + [os.path.join(OUT, 'tvc-c.mp4'), '--stills', ts], check=True)
        return
    snd = os.path.join(OUT, 'music.wav')
    music(snd)
    subprocess.run(r + [os.path.join(OUT, 'tvc-c.mp4'), '--음악', snd, '--sub', os.environ.get('SUB', '4'), '--dur', str(DUR)], check=True)


if __name__ == '__main__':
    main()
