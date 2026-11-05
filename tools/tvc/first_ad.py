# 18초 세로 릴스 "알리 그 가격, 나한테도?" — 목요일 질문형(11/3 운영자: 화 퀴즈·수 판정 쇼·목 질문)
#   python tools/tvc/first_ad.py            → content/2026-11-05-reel-firstprice/publish/reel-firstprice.mp4
#   STILLS=1 python tools/tvc/first_ad.py   → 박마다 정지 화면
# 첫 구매 특가 스티커를 떼면 일반가(알리 제휴 API 가격) → 쿠팡 가격표와 나란히 → 판정 도장.
# 숫자는 굽는 순간 빌드한 상품 페이지의 체감가 영수증·국내 최저가에서 읽어요. 판정이 예상과 다르거나 배송비·세금이 붙으면 멈춰요.
# 첫 구매 특가 숫자는 확인할 수 없어서 화면에 숫자를 쓰지 않아요(₩??,???).
# 120 BPM, 한 박 0.5초, 36박 = 18초. 장면표는 content/2026-11-05-reel-firstprice/storyboard.md
import html, json, os, re, subprocess, sys, time, wave
from datetime import datetime, timedelta, timezone
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-11-05-reel-firstprice')
OUT = os.path.join(D, 'publish')
NAME = 'reel-firstprice'
BPM, BEATS = 120, 36
B = 60 / BPM
DUR = BEATS * B
PICKS = [  # [slug, 화면 이름(12자 이내), 기대 판정]
    ['ali-qcy-h3-anc-headphones', 'QCY H3 헤드폰', '국내가 나음'],
    ['ali-edifier-evobuds-pro', '에보버즈 프로', '직구각'],
]
SHOT = 'ali-edifier-evobuds-pro'
PORT = '8791'  # 8765는 다른 세션이 쓰고 있을 때가 있어요
WON = lambda s: int(s.replace('₩', '').replace(',', ''))


def read_numbers():
    subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, capture_output=True, text=True, check=True)
    rounds = []
    for slug, label, want in PICKS:
        s = open(os.path.join(ROOT, 'dist/p', slug + '.html'), encoding='utf-8').read()
        seg = s[s.find('class="receipt"'):]
        seg = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '|', seg[:3000])))
        item = WON(re.search(r'상품가[^|]*[|\s]*(₩[\d,]+)', seg).group(1))
        total = WON(re.search(r'합계\s*[|\s]*(₩[\d,]+)', seg).group(1))
        dom = WON(re.search(r'국내 최저가 (₩[\d,]+)에 사기', s).group(1))
        verdict = re.search(r'class="vhero[^"]*"><span class="vword">([^<]+)<', s).group(1)
        if total != item:
            sys.exit(f'멈춤: {label} 배송비·세금이 붙어요({item} → {total}). 이 릴스는 상품가 = 합계인 상품만 써요')
        if verdict != want:
            sys.exit(f'멈춤: {label} 판정이 {want} → {verdict}로 바뀌었어요')
        rounds.append({'slug': slug, 'label': label, 'verdict': verdict, 'ali': total, 'cp': dom, 'diff': abs(dom - total), 'cpDate': cp_date(slug)})
    return rounds


def cp_date(slug):
    # 쿠팡 가격을 마지막으로 확인한 날: checkedAt '쿠팡 자동'(API가 같은 값 확인), 가격 기록의 쿠팡 변경, domesticSource 'M/D 확인' 중 가장 늦은 날
    ps = json.load(open(os.path.join(ROOT, 'data/products.json'), encoding='utf-8'))
    p = next(x for x in (ps if isinstance(ps, list) else ps.get('products', ps.values())) if (x.get('slug') or x.get('id')) == slug)
    ds = []
    m = re.match(r'(\d{4})\.(\d{2})\.(\d{2}) 쿠팡', p.get('checkedAt', ''))
    if m: ds.append((int(m[2]), int(m[3])))
    for e in p.get('priceLog', []):
        if e.get('field') == 'domesticKrw':
            y, mo, d = e['at'].split('.'); ds.append((int(mo), int(d)))
    for mo, d in re.findall(r'(\d{1,2})/(\d{1,2}) 확인', p.get('domesticSource', '')):
        ds.append((int(mo), int(d)))
    mo, d = max(ds)
    return f'{mo}.{d}'


def site_shot():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', PORT, '--bind', '127.0.0.1'], cwd=os.path.join(ROOT, 'dist'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        env = dict(os.environ, SHOT_PORT=PORT, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, shell=os.name == 'nt').stdout.strip())
        subprocess.run(['node', os.path.join(ROOT, 'tools/tvc/site_shot.cjs'), SHOT, os.path.join(D, 'site.png'), os.path.join(D, 'site-rows.json')], check=True, env=env)
    finally:
        srv.terminate()


def build_tl(rounds):
    kst = datetime.now(timezone(timedelta(hours=9)))
    return {
        'bpm': BPM, 'beats': BEATS, 'date': f'{kst.month}.{kst.day}', 'rounds': rounds,
        'rows': json.load(open(os.path.join(D, 'site-rows.json'), encoding='utf-8')),
        'shot': list(__import__('PIL.Image', fromlist=['Image']).open(os.path.join(D, 'site.png')).size),
        # 라운드마다 [가격표 등장, 스티커 떼기, 쿠팡 가격표, 판정, 끝]
        'R': [[0, 6, 8, 10.5, 15], [15, 16.5, 17.5, 19.5, 24]],
        'navy': [[24, 29.5]], 'site': [24, 29.5], 'cta': [29.5, 34], 'gap': 33.72, 'end': 34,
    }


def music(path, TL):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    # 0~6박: 물음표 질문(뜯는 음이 올라가다 멈춤), 스티커가 떨림
    for k, f in enumerate((523.25, 587.33, 659.25, 783.99)):
        add(mel, bt(k * 0.75), R.pluck(f, 0.35), 1.2)
    for k in (3, 3.5, 4, 4.5, 5, 5.5):
        add(fx, bt(k), R.tick(), 0.7)
    add(fx, bt(4.5), R.riser(bt(5.95) - bt(4.5)), 0.7)
    big = {6, 15, 16} | {int(r[3]) for r in TL['R']}
    for k in range(6, 24):
        add(dr, bt(k), R.kick(k in big), 0.95)
        add(dr, bt(k + 0.5), R.hat(), 0.6)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.6)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
    for i, (a, peel, cp, v, e) in enumerate(TL['R']):
        rd = TL['rounds'][i]
        if i:
            add(fx, bt(a) - 0.1, R.whoosh(0.3), 0.7)
        add(fx, bt(peel), R.whoosh(0.25), 0.9); add(mel, bt(peel), R.stab(ch[i % 4], 0.4), 1.0)  # 스티커 뜯김
        add(fx, bt(cp) - 0.08, R.whoosh(0.25), 0.6); add(fx, bt(cp), R.thud(), 0.7)  # 쿠팡 가격표 착지
        add(fx, bt(v) - 0.6, R.riser(0.55), 0.6)
        a0 = bt(v)
        add(fx, a0, R.crash(1.1), 0.6); add(fx, a0, R.thud(), 1.0)  # 도장 쾅
        if rd['verdict'] == '직구각':
            add(fx, a0, R.bell(1760.0), 0.9); add(mel, a0, R.stab((523.25, 659.25, 783.99), 0.6), 1.1)
        else:
            add(fx, a0, R.bell(1318.5), 0.7); add(mel, a0, R.stab((392.0, 466.16, 587.33), 0.6), 1.0)
    s0, s1 = TL['site']
    add(fx, bt(s0) - 0.15, R.whoosh(0.35), 0.8)
    add(mel, bt(s0), R.pad(ch[1], bt(s1 - s0)), 1.1)
    for k in range(int(s0), int(TL['cta'][1])):
        add(dr, bt(k), R.kick(), 0.5 if k < s1 else 0.75)
        add(dr, bt(k + 0.5), R.hat(), 0.35)
    for b in (s0 + 1.5, s0 + 2.5):
        add(fx, bt(b), R.tick(), 0.7); add(mel, bt(b), R.pluck(987.77, 0.2), 0.6)
    add(fx, bt(s1) - 0.1, R.whoosh(0.3), 0.7); add(mel, bt(s1), R.stab(ch[2], 0.5), 0.9)
    for k in range(6):
        add(fx, bt(TL['cta'][0] + 1.5) + k * 0.09, R.tick(), 0.45)  # 링크 붙여 넣기 타이핑
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
    for r in TL['R']:
        silence(r[3] - 0.22, r[3])  # 도장 직전 비움
    silence(TL['gap'], e)
    duck = np.ones(N)
    for k in list(range(6, 34)) + [e, e + 1]:
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
