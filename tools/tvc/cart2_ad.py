# 21초 세로 릴스 "광군제 장바구니, 다 더하면?" v2 — 11/3 운영자 승인 릴스 기준(말·움직임 칸 분리, 움직임이 되는 말) 적용
#   python3 tools/tvc/cart2_ad.py            → content/2026-11-04-reel-cart3-v2/publish/reel-cart3-v2.mp4
#   STILLS=1 python3 tools/tvc/cart2_ad.py   → 박마다 정지 화면
# 숫자는 굽는 순간 빌드한 상품 페이지의 '체감가 영수증'(상품가·배송비·관세·부가세)과 국내 최저가에서 읽어요. 판정이 예상과 다르면 멈춰요.
# 120 BPM, 한 박 0.5초, 42박 = 21초. 장면표는 content/2026-11-04-reel-cart3-v2/storyboard.md
import html, json, os, re, subprocess, sys, time, wave
from datetime import datetime, timedelta, timezone
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-11-04-reel-cart3-v2')
OUT = os.path.join(D, 'publish')
NAME = 'reel-cart3-v2'
BPM, BEATS = 120, 42
B = 60 / BPM
DUR = BEATS * B
PICKS = [  # [slug, 화면 이름(12자 이내), 기대 판정]
    ['ali-ugreen-7in1-usbc-hub', '유그린 USB-C 허브', '직구각'],
    ['ali-aula-f75-keyboard', 'AULA F75 키보드', '애매'],
    ['ali-edifier-m90-speaker', '에디파이어 M90', '국내가 나음'],
]
SHOT = 'ali-edifier-m90-speaker'
WON = lambda s: int(s.replace('₩', '').replace(',', ''))


def read_numbers():
    subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, capture_output=True, text=True, check=True)
    rounds = []
    for slug, label, want in PICKS:
        s = open(os.path.join(ROOT, 'dist/p', slug + '.html'), encoding='utf-8').read()
        seg = s[s.find('class="receipt"'):]
        seg = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '|', seg[:3000])))
        g = lambda pat: WON(re.search(pat, seg).group(1))
        item = g(r'상품가[^|]*[|\s]*(₩[\d,]+)')
        ship = g(r'국제 배송비[^|]*[|\s]*(₩[\d,]+)')
        duty = g(r'관세 [\d.]+%\s*[|\s]*(₩[\d,]+)')
        vat = g(r'부가세 10%\s*[|\s]*(₩[\d,]+)')
        total = g(r'합계\s*[|\s]*(₩[\d,]+)')
        usd = float(re.search(r'\$([\d.]+) 상당', seg).group(1))
        dom = WON(re.search(r'국내 최저가 (₩[\d,]+)에 사기', s).group(1))
        verdict = re.search(r'class="vhero[^"]*"><span class="vword">([^<]+)<', s).group(1)
        assert item + ship + duty + vat == total, f'{label} 영수증 합이 안 맞아요'
        if verdict != want:
            sys.exit(f'멈춤: {label} 판정이 {want} → {verdict}로 바뀌었어요')
        rounds.append({'slug': slug, 'label': label, 'verdict': verdict, 'item': item, 'ship': ship, 'duty': duty, 'vat': vat,
                       'ali': total, 'cp': dom, 'diff': abs(dom - total), 'usd': usd, 'limit': round(item * 150 / usd)})
    return rounds


def site_shot():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765'], cwd=os.path.join(ROOT, 'dist'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        env = dict(os.environ, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, shell=os.name == 'nt').stdout.strip())
        subprocess.run(['node', os.path.join(ROOT, 'tools/tvc/site_shot.cjs'), SHOT, os.path.join(D, 'site.png'), os.path.join(D, 'site-rows.json')], check=True, env=env)
    finally:
        srv.terminate()


def build_tl(rounds):
    kst = datetime.now(timezone(timedelta(hours=9)))
    return {
        'bpm': BPM, 'beats': BEATS, 'date': f'{kst.month}.{kst.day}', 'rounds': rounds,
        'rows': json.load(open(os.path.join(D, 'site-rows.json'), encoding='utf-8')),
        'shot': list(__import__('PIL.Image', fromlist=['Image']).open(os.path.join(D, 'site.png')).size),
        # 저울에 떨어지는 블록: [라운드, 박, 종류, 쪽]  종류 = cp(쿠팡) item(알리 상품가) ship(배송비) tax(관세·부가세 0원) duty vat
        'drops': [[0, 4.5, 'cp', 'R'], [0, 5.5, 'item', 'L'], [0, 6.5, 'ship', 'L'], [0, 7, 'tax0', 'L'],
                  [1, 12.5, 'cp', 'R'], [1, 13, 'item', 'L'],
                  [2, 17.5, 'cp', 'R'], [2, 18.5, 'item', 'L'], [2, 24, 'duty', 'L'], [2, 24.5, 'vat', 'L']],
        'clear': [11.5, 16.5], 'limit': [21.5, 22],  # 라운드 끝 블록 빠짐, 150달러 선 등장·넘침
        'verdict': [8, 14, 25.5], 'R': [[4, 12], [12, 17], [17, 29]],
        'navy': [[29, 33.5]], 'site': [29, 33.5], 'cta': [33.5, 38], 'gap': 37.72, 'end': 38,
    }


def music(path, TL):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    # 0~4박: 저울이 생김(점 → 대 → 받침 → 접시), 박마다 올라가는 음
    for k, f in enumerate((440.0, 523.25, 659.25, 880.0)):
        add(mel, bt(k), R.pluck(f, 0.4), 1.3); add(mel, bt(k), R.pluck(f / 2, 0.4), 0.6)
        add(dr, bt(k + 0.5), R.hat(), 0.45)
    add(fx, bt(0.5), R.thud(), 0.5); add(fx, bt(1), R.thud(), 0.6)
    add(fx, bt(2.5), R.riser(bt(3.9) - bt(2.5)), 0.6)
    # 4~29박 그루브(라운드 첫 박·판정 박은 큰 킥)
    big = {4, 12, 17} | {int(v) for v in TL['verdict']}
    for k in range(4, 29):
        add(dr, bt(k), R.kick(k in big), 0.95)
        add(dr, bt(k + 0.5), R.hat(), 0.6)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.6)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
    for i, (s, e) in enumerate(TL['R']):
        add(fx, bt(s) - 0.1, R.whoosh(0.3), 0.7); add(mel, bt(s), R.stab(ch[i % 4], 0.45), 1.0)
    # 블록이 떨어질 때 쿵(무거울수록 크게), 0원 칩은 가벼운 째깍
    for ri, b, kind, side in TL['drops']:
        r = TL['rounds'][ri]
        v = {'cp': r['cp'], 'item': r['item'], 'ship': r['ship'], 'tax0': 0, 'duty': r['duty'], 'vat': r['vat']}[kind]
        if v == 0:
            add(fx, bt(b), R.tick(), 0.8); add(mel, bt(b), R.pluck(1318.5, 0.15), 0.5)
        else:
            add(fx, bt(b), R.thud(), min(1.0, 0.45 + v / 300000))
    for b in TL['clear']:
        add(fx, bt(b), R.whoosh(0.35), 0.7)
    # 150달러 선: 나타날 때 째깍, 넘칠 때 경고음 두 번
    add(fx, bt(TL['limit'][0]), R.tick(), 0.9)
    for d in (0, 0.18):
        add(fx, bt(TL['limit'][1]) + d, R.bell(1567.98), 0.6)
    add(fx, bt(23), R.riser(bt(23.9) - bt(23)), 0.7)
    # 판정: 직구각 밝게, 애매 가볍게, 뒤집힘(국내가 나음)은 가장 크게
    for v, r in zip(TL['verdict'], TL['rounds']):
        a = bt(v)
        add(fx, a, R.crash(1.1), 0.6)
        if r['verdict'] == '직구각':
            add(fx, a, R.bell(1760.0), 0.9); add(mel, a, R.stab((523.25, 659.25, 783.99), 0.6), 1.1)
        elif r['verdict'] == '애매':
            add(fx, a, R.bell(1174.66), 0.6); add(mel, a, R.stab((440.0, 523.25, 622.25), 0.4), 0.8)
        else:
            add(fx, a, R.bell(1318.5), 0.7); add(mel, a, R.stab((392.0, 466.16, 587.33), 0.6), 1.0)
    add(fx, bt(24.5), R.boom(), 1.0)  # 부가세가 떨어져 저울이 뒤집히는 순간
    s0, s1 = TL['site']
    add(fx, bt(s0) - 0.15, R.whoosh(0.35), 0.8)
    add(mel, bt(s0), R.pad(ch[1], bt(s1 - s0)), 1.1)
    for k in range(s0, int(TL['cta'][1])):
        add(dr, bt(k), R.kick(), 0.5 if k < s1 else 0.75)
        add(dr, bt(k + 0.5), R.hat(), 0.35)
    for b in (s0 + 1.5, s0 + 2, s0 + 2.5):  # 영수증 줄이 차례로 켜짐(더하기)
        add(fx, bt(b), R.tick(), 0.7); add(mel, bt(b), R.pluck(987.77, 0.2), 0.6)
    add(fx, bt(s1) - 0.1, R.whoosh(0.3), 0.7); add(mel, bt(s1), R.stab(ch[2], 0.5), 0.9)
    for k in range(5):
        add(fx, bt(TL['cta'][0] + 1.5) + k * 0.09, R.tick(), 0.45)  # 말풍선 타이핑
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
    silence(24.28, 24.5)  # 뒤집히기 직전 비움
    silence(TL['gap'], e)
    duck = np.ones(N)
    for k in list(range(4, 38)) + [e, e + 1, e + 2]:
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
    print('숫자', [(r['label'], r['verdict'], r['item'], r['duty'], r['vat'], r['ali'], r['cp'], r['diff']) for r in rounds])
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
