# 17초 세로 릴스 "광군제 면세 한도, 원화로 얼마?" — 화요일 퀴즈(3지선다 + 장바구니 게이지), 11/9 팀장 장면표
#   python tools/tvc/limitquiz_ad.py            → content/2026-11-10-reel-limitquiz/publish/reel-limitquiz.mp4
#   STILLS=1 python tools/tvc/limitquiz_ad.py   → 박마다 정지 화면
# 숫자는 굽는 순간 data/settings.json 과세환율(fx)로 계산해요: 150달러·200달러 원화값(원 미만 버림). 상품·가격은 안 써요.
# 120 BPM, 한 박 0.5초, 34박 = 17초. 장면표는 content/2026-11-10-reel-limitquiz/storyboard.md
import json, os, re, subprocess, sys, time, wave
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-11-10-reel-limitquiz')
OUT = os.path.join(D, 'publish')
NAME = 'reel-limitquiz'
BPM, BEATS = 120, 34
B = 60 / BPM
DUR = BEATS * B
PORT = '8791'  # 8765는 다른 세션이 쓰고 있을 때가 있어요


def read_numbers():
    s = json.load(open(os.path.join(ROOT, 'data/settings.json'), encoding='utf-8'))
    fx = s['fx']['usdKrw']
    m = re.search(r'\((\d{4})\.(\d{2})\.(\d{2})~(\d{2})\.(\d{2})', s['fx']['label'])
    period = f'{int(m[2])}.{int(m[3])}~{int(m[4])}.{int(m[5])}' if m else ''
    return {'fx': fx, 'fxText': f'{fx:,.2f}', 'period': period, 'k150': int(150 * fx), 'k200': int(200 * fx)}


def site_shot():
    subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, capture_output=True, text=True, check=True)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', PORT, '--bind', '127.0.0.1'], cwd=os.path.join(ROOT, 'dist'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        env = dict(os.environ, SHOT_PORT=PORT, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, shell=os.name == 'nt').stdout.strip())
        rows = json.dumps({'goods': '#panel-cart .receipt .r-row', 'fx': '#panel-cart .receipt + p'})
        subprocess.run(['node', os.path.join(ROOT, 'tools/tvc/page_clip.cjs'), '/calculator.html', os.path.join(D, 'site.png'), os.path.join(D, 'site-rows.json'),
                        '#panel-cart .receipt', '#panel-cart .receipt + p', rows, '#tab-cart'], check=True, env=env)
    finally:
        srv.terminate()


def build_tl(n):
    return {
        'bpm': BPM, 'beats': BEATS, **n,
        'rows': json.load(open(os.path.join(D, 'site-rows.json'), encoding='utf-8')),
        'shot': list(__import__('PIL.Image', fromlist=['Image']).open(os.path.join(D, 'site.png')).size),
        'cards': [4, 4.5, 5],          # 보기 ①②③ 꽂힘(0.5박 간격)
        'drops': [6.5, 7.25, 8],       # 상자가 장바구니에 떨어짐 → 게이지 한 칸씩
        'pass1': 7.25,                 # ① 선 지나감(불 안 켜짐, 카드 회색으로 떨어짐)
        'hit': 9, 'gear': [13, 16], 'third': [16, 18], 'over': [18, 23],
        'navy': [[23, 27.5]], 'site': [23, 27.5], 'cta': [27.5, 32], 'gap': 31.72, 'end': 32,
    }


def music(path, TL):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    # 0~4박: 게이지 기둥이 솟고 물음표가 흔들림
    for k, f in enumerate((392.0, 440.0, 523.25, 587.33)):
        add(mel, bt(k), R.pluck(f, 0.35), 1.2)
    add(fx, bt(0.5), R.riser(bt(3.8) - bt(0.5)), 0.5)
    for b in TL['cards']:  # 보기 카드 탁탁탁
        add(fx, bt(b), R.thud(), 0.8); add(fx, bt(b), R.tick(), 0.8)
    big = {4, 9, 18}
    for k in range(4, 23):
        add(dr, bt(k), R.kick(k in big), 0.95)
        add(dr, bt(k + 0.5), R.hat(), 0.6)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.6)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
    for i, b in enumerate(TL['drops']):  # 상자 쿵, 게이지가 오를수록 음이 올라감
        add(fx, bt(b), R.thud(), 0.7); add(mel, bt(b), R.pluck((659.25, 783.99, 880.0)[i], 0.25), 0.8)
    add(fx, bt(TL['pass1']) + 0.05, R.whoosh(0.3), 0.6)  # ① 카드가 접혀 떨어짐
    add(fx, bt(8.3), R.riser(bt(8.9) - bt(8.3)), 0.7)
    h = bt(TL['hit'])  # 정답 ②
    add(fx, h, R.crash(1.1), 0.7); add(fx, h, R.bell(1760.0), 0.9); add(mel, h, R.stab((523.25, 659.25, 783.99), 0.6), 1.1)
    g0, g1 = TL['gear']  # 톱니가 돌며 째깍 2번, 동전
    add(fx, bt(g0) - 0.1, R.whoosh(0.3), 0.6)
    for b in (g0 + 1, g0 + 1.5):
        add(fx, bt(b), R.tick(), 0.9)
    add(fx, bt(g0 + 2.2), R.bell(2093.0), 0.6)
    add(fx, bt(TL['third'][0]), R.whoosh(0.35), 0.8)  # ③ 밀려남
    o0, o1 = TL['over']  # 넘침: 경고음 두 번, 쿵
    for d in (0, 0.18):
        add(fx, bt(o0 + 1) + d, R.bell(1567.98), 0.6)
    add(fx, bt(o0 + 2.5), R.boom(), 0.9)
    add(fx, bt(o0 + 3.5), R.thud(), 0.9)
    s0, s1 = TL['site']
    add(fx, bt(s0) - 0.15, R.whoosh(0.35), 0.8)
    add(mel, bt(s0), R.pad(ch[1], bt(s1 - s0)), 1.1)
    for k in range(int(s0), int(TL['cta'][1])):
        add(dr, bt(k), R.kick(), 0.5 if k < s1 else 0.75)
        add(dr, bt(k + 0.5), R.hat(), 0.35)
    for b in (s0 + 1.5, s0 + 2.5):
        add(fx, bt(b), R.tick(), 0.7); add(mel, bt(b), R.pluck(987.77, 0.2), 0.6)
    add(fx, bt(s1) - 0.1, R.whoosh(0.3), 0.7); add(mel, bt(s1), R.stab(ch[2], 0.5), 0.9)
    for k in range(8):
        add(fx, bt(TL['cta'][0] + 1.2) + k * 0.09, R.tick(), 0.45)  # 타이핑
    add(fx, bt(TL['cta'][0] + 3), R.thud(), 0.6)  # 담기 눌림
    e = TL['end']
    for k in range(6):
        add(dr, bt(e - 1.75 + k * 0.25), R.snare(0.3 + k * 0.1))
    add(fx, bt(e - 1.5), R.riser(bt(TL['gap']) - bt(e - 1.5)), 0.8)
    add(fx, bt(e), R.boom(), 1.0); add(fx, bt(e), R.crash(), 0.9)
    add(mel, bt(e), R.stab(ch[0], 0.6), 1.2)
    for k in (e, e + 1):
        add(dr, bt(k), R.kick(True), 1.0)
    add(mel, bt(e + 1), R.stab((440.0, 523.25, 659.25, 880.0), 1.0), 1.2)
    add(mel, bt(e + 1), R.bass(110.0, 0.9), 1.0)

    def silence(b0, b1):
        i, j = int(bt(b0) * SR), int(bt(b1) * SR)
        for arr in (dr, mel, fx):
            arr[i:j] *= np.linspace(1, 0, j - i) ** 6
    silence(TL['hit'] - 0.2, TL['hit'])  # 정답 직전 0.1초 멈춤
    silence(TL['gap'], e)
    duck = np.ones(N)
    for k in list(range(4, 32)) + [e, e + 1]:
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
    n = read_numbers()
    print('숫자', n)
    site_shot()
    TL = build_tl(n)
    with open(os.path.join(D, 'timeline.js'), 'w', encoding='utf-8') as f:
        f.write('window.TL=' + json.dumps(TL, ensure_ascii=False) + ';\n')
    r = ['node', os.path.join(ROOT, 'tools/tvc/render_html.mjs'), os.path.join(D, 'ad.html')]
    mp4 = os.path.join(OUT, NAME + '.mp4')
    if os.environ.get('STILLS'):
        ts = os.environ.get('T') or ','.join(f'{b * B + 0.3:.2f}' for b in range(BEATS))
        subprocess.run(r + [mp4, '--stills', ts], check=True)
        return
    snd = os.path.join(OUT, 'music.wav')
    music(snd, TL)
    subprocess.run(r + [mp4, '--음악', snd, '--sub', os.environ.get('SUB', '6'), '--dur', str(DUR)], check=True)


if __name__ == '__main__':
    main()
