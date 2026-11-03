# 20초 세로 릴스 "광군제 장바구니, 3개 재 봤어요" — 신호등 판정 쇼 2탄
#   python3 tools/tvc/cart_ad.py            → content/2026-11-04-reel-cart3/publish/reel-cart3.mp4
#   STILLS=1 python3 tools/tvc/cart_ad.py   → 박마다 정지 화면
# 숫자는 굽는 순간 빌드 결과(사이트 판정과 같은 값)에서 읽고, 사이트 화면도 그때 찍어요. 판정이 예상과 다르면 멈춰요.
# 120 BPM, 한 박 0.5초, 20초 = 40박. 검수표 4장 릴스 구조 신호 반영(화면 글자 12자, 장면 길이 다르게, 실제 사이트 화면·확인 날짜, 마지막 요청 하나).
import json, os, re, subprocess, sys, time, wave
from datetime import datetime, timedelta, timezone
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-11-04-reel-cart3')
OUT = os.path.join(D, 'publish')
NAME = 'reel-cart3'
BPM, BEATS = 120, 40
B = 60 / BPM
DUR = BEATS * B
# [slug, 화면 이름(12자 이내), 기대 판정]
PICKS = [
    ['ali-ugreen-7in1-usbc-hub', '유그린 USB-C 허브', '직구각'],
    ['ali-aula-f75-keyboard', 'AULA F75 키보드', '애매'],
    ['ali-xiaomi-smart-band-10-pro', '샤오미 밴드 10 프로', '국내가 나음'],
]
SHOT = 'ali-xiaomi-smart-band-10-pro'  # 사이트 화면으로 보여 줄 상품


def read_numbers():
    out = subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    names = {p['slug']: p['name'] for p in json.load(open(os.path.join(ROOT, 'data/products.json'), encoding='utf-8'))}
    got = {}
    for line in out.splitlines():
        m = re.match(r'^\s+(.+?)\s+(직구각|애매|국내가 나음) \(₩([\d,]+) vs ₩([\d,]+)\)', line)
        if m:
            got[m.group(1).strip()] = (m.group(2), int(m.group(3).replace(',', '')), int(m.group(4).replace(',', '')))
    rounds = []
    for slug, label, want in PICKS:
        v, landed, dom = got[names[slug]]
        if v != want:
            sys.exit(f'멈춤: {label} 판정이 {want} → {v}로 바뀌었어요. 상품을 다시 고르거나 운영자 확인')
        rounds.append({'slug': slug, 'label': label, 'verdict': v, 'ali': landed, 'cp': dom, 'diff': abs(dom - landed)})
    return rounds


def site_shot():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765'], cwd=os.path.join(ROOT, 'dist'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        env = dict(os.environ, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip())
        subprocess.run(['node', os.path.join(ROOT, 'tools/tvc/site_shot.cjs'), SHOT, os.path.join(D, 'site.png')], check=True, env=env)
    finally:
        srv.terminate()


def build_tl(rounds):
    kst = datetime.now(timezone(timedelta(hours=9)))
    return {
        'bpm': BPM, 'beats': BEATS, 'date': f'{kst.month}.{kst.day}', 'rounds': rounds,
        # 라운드마다 길이를 다르게: [시작, 막대, 불 돌기 시작, 판정, 끝]
        'R': [[4, 5, 6.5, 8, 12], [12, 12.5, 13.5, 14, 17], [17, 18, 19.5, 21, 26]],
        'navy': [[12, 17], [26, 31]],
        'site': [26, 31], 'cta': [31, 36], 'gap': 35.72, 'end': 36,
    }


def music(path, TL):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    for k, f in enumerate((440.0, 523.25, 659.25, 880.0)):
        add(mel, bt(k), R.pluck(f, 0.4), 1.3); add(mel, bt(k), R.pluck(f / 2, 0.4), 0.6)
        add(dr, bt(k + 0.5), R.hat(), 0.45)
    add(fx, bt(0.5), R.thud(), 0.6); add(fx, bt(1), R.thud(), 0.6)
    for b in (1.5, 2, 2.5):
        add(fx, bt(b), R.thud(), 0.7); add(fx, bt(b), R.tick(), 0.6)
    add(fx, bt(3), R.riser(bt(3.9) - bt(3)), 0.6)
    for i, (s, bar, cyc, hit, e) in enumerate(TL['R']):
        add(fx, bt(s) - 0.1, R.whoosh(0.3), 0.7)
        add(mel, bt(s), R.stab(ch[i % 4], 0.45), 1.0)
        for k in range(s, e):
            add(dr, bt(k), R.kick(k in (s, hit)), 0.95)
            add(dr, bt(k + 0.5), R.hat(), 0.6)
            if k % 2 == 1:
                add(dr, bt(k), R.clap(), 0.6)
            add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
        add(fx, bt(bar), R.riser(0.6), 0.4)
        add(fx, bt(bar) + 0.6, R.thud(), 0.5)
        n = int(round((hit - cyc) * 4))
        for k in range(n):
            add(fx, bt(cyc + k * 0.25), R.tick(), 0.85); add(dr, bt(cyc + k * 0.25), R.snare(0.25 + k * 0.06), 0.8)
        if hit - cyc > 1:
            add(fx, bt(cyc), R.riser(bt(hit) - bt(cyc) - 0.3), 0.7)
        v = TL['rounds'][i]['verdict']
        a = bt(hit)
        add(fx, a, R.crash(1.1), 0.6)
        if v == '직구각':
            add(fx, a, R.bell(1760.0), 0.9); add(mel, a, R.stab((523.25, 659.25, 783.99), 0.6), 1.1); add(fx, a, R.boom(), 0.7)
        elif v == '애매':
            add(fx, a, R.bell(1174.66), 0.6); add(mel, a, R.stab((440.0, 523.25, 622.25), 0.4), 0.8)
        else:
            add(fx, a, R.boom(), 1.0); add(fx, a, R.thud(), 1.0); add(mel, a, R.stab((392.0, 466.16, 587.33), 0.6), 1.0)
        add(fx, a + 0.25, R.thud(), 0.5)
    s0, s1 = TL['site']
    add(fx, bt(s0) - 0.15, R.whoosh(0.35), 0.8)
    add(mel, bt(s0), R.pad(ch[1], bt(s1 - s0)), 1.1)
    for k in range(s0, TL['cta'][1]):
        add(dr, bt(k), R.kick(), 0.5 if k < s1 else 0.75)
        add(dr, bt(k + 0.5), R.hat(), 0.35)
    add(fx, bt(s0 + 1.5), R.bell(1318.5), 0.5)
    add(fx, bt(s1) - 0.1, R.whoosh(0.3), 0.7)
    add(mel, bt(s1), R.stab(ch[2], 0.5), 0.9)
    add(dr, bt(s1 + 1), R.clap(), 0.5); add(dr, bt(s1 + 3), R.clap(), 0.6)
    e = TL['end']
    for k in range(6):
        add(dr, bt(e - 1.75 + k * 0.25), R.snare(0.3 + k * 0.1))
    add(fx, bt(e - 1.5), R.riser(bt(TL['gap']) - bt(e - 1.5)), 0.8)
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
    for r in TL['R']:
        silence(r[3] - 0.24, r[3])
    silence(TL['gap'], e)
    duck = np.ones(N)
    for k in list(range(4, 36)) + [e, e + 1, e + 2]:
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
    rounds = read_numbers()
    print('숫자', [(r['label'], r['verdict'], r['ali'], r['cp'], r['diff']) for r in rounds])
    site_shot()
    TL = build_tl(rounds)
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
