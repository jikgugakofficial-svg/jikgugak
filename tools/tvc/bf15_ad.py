# 18초 세로 릴스 "15달러 더 담으면, 세금은 얼마?" — 목요일 질문형(200달러 선이 그어진 상자), 11/9 팀장 장면표
#   python tools/tvc/bf15_ad.py            → content/2026-11-12-reel-bf15/publish/reel-bf15.mp4
#   STILLS=1 python tools/tvc/bf15_ad.py   → 박마다 정지 화면
# 숫자는 굽는 순간 빌드한 /deals/blackfriday 예시 표(195·210달러 특송 행)와 settings 과세환율에서 읽어요. 아마존 상품·가격 없음.
# 120 BPM, 한 박 0.5초, 36박 = 18초. 장면표는 content/2026-11-12-reel-bf15/storyboard.md
import html, json, os, re, subprocess, sys, time, wave
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-11-12-reel-bf15')
OUT = os.path.join(D, 'publish')
NAME = 'reel-bf15'
BPM, BEATS = 120, 36
B = 60 / BPM
DUR = BEATS * B
PORT = '8791'
WON = lambda s: int(s.replace('₩', '').replace(',', ''))


def read_numbers():
    subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, capture_output=True, text=True, check=True)
    s = open(os.path.join(ROOT, 'dist/deals/blackfriday.html'), encoding='utf-8').read()
    rows = {}
    for usd, how, tax, total in re.findall(r'<tr><th scope="row">(\d+)달러 · (특송|우편)</th><td>(₩[\d,]+)<span[^>]*>[^<]*</span></td><td>(₩[\d,]+)</td>', s):
        rows[(int(usd), how)] = {'tax': WON(tax), 'total': WON(total)}
    a, b = rows[(195, '특송')], rows[(210, '특송')]
    if a['tax'] != 0 or b['tax'] <= 0:
        sys.exit(f'멈춤: 블프 페이지 예시 표가 예상과 달라요 {rows}')
    st = json.load(open(os.path.join(ROOT, 'data/settings.json'), encoding='utf-8'))
    fx = st['fx']['usdKrw']
    m = re.search(r'\((\d{4})\.(\d{2})\.(\d{2})~(\d{2})\.(\d{2})', st['fx']['label'])
    period = f'{int(m[2])}.{int(m[3])}~{int(m[4])}.{int(m[5])}' if m else ''
    return {'t195': a['total'], 'tax210': b['tax'], 't210': b['total'], 'k200': int(200 * fx), 'period': period}


def site_shot():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', PORT, '--bind', '127.0.0.1'], cwd=os.path.join(ROOT, 'dist'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        env = dict(os.environ, SHOT_PORT=PORT, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, shell=os.name == 'nt').stdout.strip())
        sec = 'section[aria-labelledby="bf-200"]'
        rows = json.dumps({'r195': f'{sec} tbody tr:nth-child(1)', 'r210': f'{sec} tbody tr:nth-child(2)'})
        subprocess.run(['node', os.path.join(ROOT, 'tools/tvc/page_clip.cjs'), '/deals/blackfriday.html', os.path.join(D, 'site.png'), os.path.join(D, 'site-rows.json'),
                        f'{sec} h2', f'{sec} > p', rows], check=True, env=env)
    finally:
        srv.terminate()


def build_tl(n):
    return {
        'bpm': BPM, 'beats': BEATS, **n,
        'rows': json.load(open(os.path.join(D, 'site-rows.json'), encoding='utf-8')),
        'shot': list(__import__('PIL.Image', fromlist=['Image']).open(os.path.join(D, 'site.png')).size),
        'S': {'q': [0, 4], 'a195': [4, 7], 'drop': [7, 9], 'tax': [9, 13], 'all': [13, 16], 'rcpt': [16, 19], 'ship': [19, 22], 'krw': [22, 27]},
        'navy': [[27, 32]], 'site': [27, 32], 'gap': 31.72, 'end': 32,
    }


def music(path, TL):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    S = TL['S']
    for k, f in enumerate((440.0, 523.25, 587.33, 659.25)):
        add(mel, bt(k), R.pluck(f, 0.35), 1.2)
    add(fx, bt(1), R.tick(), 0.7); add(fx, bt(2.5), R.tick(), 0.7)
    big = {4, 9, 16, 22}
    for k in range(4, 27):
        add(dr, bt(k), R.kick(k in big), 0.95)
        add(dr, bt(k + 0.5), R.hat(), 0.6)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.6)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
    add(fx, bt(5), R.bell(1567.98), 0.6)  # 면세 칩
    add(fx, bt(7.5), R.thud(), 1.0)  # 15달러 쿵
    h = bt(S['tax'][0])  # 세금 쾅
    add(fx, h, R.crash(1.1), 0.7); add(fx, h, R.boom(), 1.0); add(mel, h, R.stab((392.0, 466.16, 587.33), 0.6), 1.0)
    add(fx, bt(13.5) - 0.1, R.whoosh(0.3), 0.7); add(fx, bt(14.2), R.tick(), 0.8)
    for k in range(8):
        add(fx, bt(16.3) + k * 0.07, R.tick(), 0.5)  # 영수증 출력
    add(fx, bt(20) - 0.1, R.whoosh(0.3), 0.7); add(fx, bt(20.4), R.thud(), 0.8)
    for b in (23, 23.5):
        add(fx, bt(b), R.tick(), 0.9)
    s0, s1 = TL['site']
    add(fx, bt(s0) - 0.15, R.whoosh(0.35), 0.8)
    add(mel, bt(s0), R.pad(ch[1], bt(s1 - s0)), 1.1)
    for k in range(int(s0), int(s1)):
        add(dr, bt(k), R.kick(), 0.5)
        add(dr, bt(k + 0.5), R.hat(), 0.35)
    for b in (s0 + 1.5, s0 + 2.5):
        add(fx, bt(b), R.tick(), 0.7); add(mel, bt(b), R.pluck(987.77, 0.2), 0.6)
    e = TL['end']
    for k in range(6):
        add(dr, bt(e - 1.75 + k * 0.25), R.snare(0.3 + k * 0.1))
    add(fx, bt(e - 1.5), R.riser(bt(TL['gap']) - bt(e - 1.5)), 0.8)
    add(fx, bt(e), R.boom(), 1.0); add(fx, bt(e), R.crash(), 0.9)
    add(mel, bt(e), R.stab(ch[0], 0.6), 1.2)
    for k in (e, e + 1, e + 2):
        add(dr, bt(k), R.kick(k in (e, e + 2)), 1.0)
    add(mel, bt(e + 2), R.stab((440.0, 523.25, 659.25, 880.0), 1.0), 1.2)
    add(mel, bt(e + 2), R.bass(110.0, 0.9), 1.0)

    def silence(b0, b1):
        i, j = int(bt(b0) * SR), int(bt(b1) * SR)
        for arr in (dr, mel, fx):
            arr[i:j] *= np.linspace(1, 0, j - i) ** 6
    silence(S['tax'][0] - 0.2, S['tax'][0])
    silence(TL['gap'], e)
    duck = np.ones(N)
    for k in list(range(4, 32)) + [e, e + 1, e + 2]:
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
