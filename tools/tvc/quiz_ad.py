# 16초 세로 릴스 "150달러, 이거 헷갈리죠?" O/X 퀴즈 — 박자 표 한 곳에서 화면(timeline.js)과 음악(music.wav)을 같이 만들고 굽기
#   python3 tools/tvc/quiz_ad.py            → content/2026-11-03-reel-150quiz/publish/reel-150quiz.mp4
#   STILLS=1 python3 tools/tvc/quiz_ad.py   → 박마다 정지 화면
# 120 BPM, 한 박 0.5초, 16초 = 32박. 답의 근거: storyboard.md (관세청 FAQ·2022.11.17 합산 기준 변경, 사이트 가이드)
import json, os, subprocess, sys, wave
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-11-03-reel-150quiz')
OUT = os.path.join(D, 'publish')
NAME = 'reel-150quiz'
BPM, BEATS = 120, 32
B = 60 / BPM
DUR = BEATS * B

QS = [  # [질문 1줄, 질문 2줄, 답, 설명, 보조]
    ['배송비도', '150달러에 들어갈까?', 'X', '일반 물품은 국제 배송비 빼고 봐요', '영양제는 배송비까지 더해요'],
    ['같은 날 도착하면', '무조건 합칠까?', 'X', '2022년 11월부터 안 합쳐요', '같은 판매자·같은 날 산 건 합쳐질 수 있어요'],
    ['한도를 넘으면', '배송비에도 세금?', 'O', '넘으면 배송비까지 더해서 매겨요', '관세·부가세 둘 다요'],
]
TL = {
    'bpm': BPM, 'beats': BEATS,
    'q': [4, 12, 20],          # 문제 시작 박(문제마다 8박 = 4초)
    'navy': [12, 20],          # 2번 문제는 남색 배경
    'gap': 27.72, 'end': 28,   # 마지막 강타 → 정지 엔드 카드 2초
    'qs': QS,
}
# 문제 안 박(시작 박 기준): 0 글자, 1 O·X 버튼, 1.5·2.5·3.5 째깍(3·2·1), 4 정답 쾅, 4.5 설명, 5 보조, 8 퇴장


def music(path):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    # 0~4박 훅: 뜯는 음이 올라가고 물음표 셋 톡톡
    for k, f in enumerate((440.0, 523.25, 659.25, 880.0)):
        add(mel, bt(k), R.pluck(f, 0.4), 1.3); add(mel, bt(k), R.pluck(f / 2, 0.4), 0.6)
        add(dr, bt(k + 0.5), R.hat(), 0.45)
    add(fx, bt(0.5), R.thud(), 0.7); add(fx, bt(1), R.thud(), 0.6)
    for b in (1.5, 2, 2.5):
        add(fx, bt(b), R.tick(), 0.8)
    add(fx, bt(3), R.riser(bt(3.9) - bt(3)), 0.6)
    for qi, q0 in enumerate(TL['q']):
        # 문제 나올 때 휙 + 화음, 그루브
        add(fx, bt(q0) - 0.1, R.whoosh(0.3), 0.7)
        add(mel, bt(q0), R.stab(ch[qi % 4], 0.45), 1.0)
        for k in range(q0, q0 + 8):
            big = k == q0 or k == q0 + 4
            add(dr, bt(k), R.kick(big), 1.0 if k >= q0 + 4 else 0.75)
            add(dr, bt(k + 0.5), R.hat(), 0.6)
            if k % 2 == 1:
                add(dr, bt(k), R.clap(), 0.6)
            add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
        add(fx, bt(q0 + 1), R.pluck(1174.66, 0.25), 0.7)
        for j, b in enumerate((1.5, 2.5, 3.5)):  # 3·2·1 째깍, 점점 높게
            add(fx, bt(q0 + b), R.tick(), 0.9); add(mel, bt(q0 + b), R.pluck((659.25, 783.99, 987.77)[j], 0.2), 0.8)
        add(fx, bt(q0 + 2.5), R.riser(bt(q0 + 3.9) - bt(q0 + 2.5)), 0.6)
        # 정답 쾅: O면 밝은 종, X면 낮은 쿵
        a = bt(q0 + 4)
        add(fx, a, R.boom(), 0.8); add(fx, a, R.crash(1.0), 0.5)
        if QS[qi][2] == 'O':
            add(fx, a, R.bell(1318.5), 0.9); add(mel, a, R.stab((523.25, 659.25, 783.99), 0.5), 1.0)
        else:
            add(fx, a, R.thud(), 1.0); add(mel, a, R.stab((392.0, 466.16, 587.33), 0.5), 0.9)
        add(fx, bt(q0 + 4.5), R.thud(), 0.5)
    # 26박부터 스네어 연타 → 무음 → 28박 마지막 강타
    for k in range(6):
        add(dr, bt(26.25 + k * 0.25), R.snare(0.3 + k * 0.1))
    add(fx, bt(26.5), R.riser(bt(TL['gap']) - bt(26.5)), 0.8)
    e = TL['end']
    add(fx, bt(e), R.boom(), 1.0); add(fx, bt(e), R.crash(), 0.9)
    add(mel, bt(e), R.stab(ch[0], 0.6), 1.2)
    for k in (e, e + 1, e + 2):
        add(dr, bt(k), R.kick(k in (e, e + 2)), 1.0)
    add(dr, bt(e + 1), R.clap(), 0.7)
    add(mel, bt(e + 1), R.stab(ch[2], 0.5), 0.8)
    add(mel, bt(e + 2), R.stab((440.0, 523.25, 659.25, 880.0), 2.0), 1.2)
    add(mel, bt(e + 2), R.bass(110.0, 1.6), 1.0)

    def silence(b0, b1):
        i, j = int(bt(b0) * SR), int(bt(b1) * SR)
        for arr in (dr, mel, fx):
            arr[i:j] *= np.linspace(1, 0, j - i) ** 6
    for q0 in TL['q']:
        silence(q0 + 3.78, q0 + 4)  # 정답 직전 0.11초 비움
    silence(TL['gap'], e)
    duck = np.ones(N)
    for k in list(range(4, 28)) + [e, e + 1, e + 2]:
        i = int(bt(k) * SR); m = int(0.2 * SR); j = min(N, i + m)
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
    with open(os.path.join(D, 'timeline.js'), 'w', encoding='utf-8') as f:
        f.write('window.TL=' + json.dumps(TL, ensure_ascii=False) + ';\n')
    r = ['node', os.path.join(ROOT, 'tools/tvc/render_html.mjs'), os.path.join(D, 'ad.html')]
    mp4 = os.path.join(OUT, NAME + '.mp4')
    if os.environ.get('STILLS'):
        ts = os.environ.get('T') or ','.join(f'{b * B + 0.3:.2f}' for b in range(BEATS))
        subprocess.run(r + [mp4, '--stills', ts], check=True)
        return
    snd = os.path.join(OUT, 'music.wav')
    music(snd)
    subprocess.run(r + [mp4, '--음악', snd, '--sub', os.environ.get('SUB', '6'), '--dur', str(DUR)], check=True)


if __name__ == '__main__':
    main()
