# 20초 세로 릴스 "광군제 3개, 관문 두 개 넘을까?" — 수요일 판정 쇼(관문 통과 레이스), 11/9 팀장 장면표
#   python tools/tvc/gates_ad.py            → content/2026-11-11-reel-gates/publish/reel-gates.mp4
#   STILLS=1 python tools/tvc/gates_ad.py   → 박마다 정지 화면
# 판정 기준 두 개(1만 원·20%)가 트랙 위 관문. 밴드(국내가 나음) → 에보버즈(애매) → XH1(직구각).
# 숫자는 굽는 순간 빌드한 상품 페이지 영수증·국내 최저가에서 읽고, 판정이 다르거나 세금·배송비가 붙으면 멈춰요.
# 120 BPM, 한 박 0.5초, 40박 = 20초. 장면표는 content/2026-11-11-reel-gates/storyboard.md
import html, json, os, re, subprocess, sys, time, wave
from datetime import datetime, timedelta
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R
from first_ad import cp_date

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-11-11-reel-gates')
OUT = os.path.join(D, 'publish')
NAME = 'reel-gates'
BPM, BEATS = 120, 40
B = 60 / BPM
DUR = BEATS * B
PICKS = [  # [slug, 화면 이름(12자 이내), 보조 줄, 기대 판정]
    ['ali-xiaomi-smart-band-10-pro', '샤오미 밴드 10 프로', '국내 정식판 vs 글로벌판', '국내가 나음'],
    ['ali-edifier-evobuds-pro', '에보버즈 프로', '같은 실버끼리', '애매'],
    ['ali-baseus-inspire-xh1', '베이스어스 XH1', '같은 코스믹 블랙끼리', '직구각'],
]
SHOT = 'ali-baseus-inspire-xh1'
PORT = '8791'
WON = lambda s: int(s.replace('₩', '').replace(',', ''))


def read_numbers():
    subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, capture_output=True, text=True, check=True)
    ps = json.load(open(os.path.join(ROOT, 'data/products.json'), encoding='utf-8'))
    L = ps if isinstance(ps, list) else ps.get('products', list(ps.values()))
    runners, dates = [], []
    for slug, label, sub, want in PICKS:
        s = open(os.path.join(ROOT, 'dist/p', slug + '.html'), encoding='utf-8').read()
        seg = s[s.find('class="receipt"'):]
        seg = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '|', seg[:3000])))
        item = WON(re.search(r'상품가[^|]*[|\s]*(₩[\d,]+)', seg).group(1))
        total = WON(re.search(r'합계\s*[|\s]*(₩[\d,]+)', seg).group(1))
        dom = WON(re.search(r'국내 최저가 (₩[\d,]+)에 사기', s).group(1))
        verdict = re.search(r'class="vhero[^"]*"><span class="vword">([^<]+)<', s).group(1)
        if total != item:
            sys.exit(f'멈춤: {label} 배송비·세금이 붙어요({item} → {total})')
        if verdict != want:
            sys.exit(f'멈춤: {label} 판정이 {want} → {verdict}로 바뀌었어요')
        p = next(x for x in L if (x.get('slug') or x.get('id')) == slug)
        m = re.match(r'\d{4}\.(\d{2})\.(\d{2})', p.get('checkedAt', ''))
        if m: dates.append((int(m[1]), int(m[2])))
        # 쿠팡 확인 날짜: 매시간 쿠팡 공식 API가 같은 상품 번호로 같은 값을 확인한 날(KST), 없으면 가격 기록
        cp = json.load(open(os.path.join(ROOT, 'data/coupang-prices.json'), encoding='utf-8'))['items'].get(slug, {})
        if cp.get('found') and cp.get('apiPrice') == dom:
            k = datetime.fromisoformat(cp['at'].replace('Z', '+00:00')) + timedelta(hours=9); dates.append((k.month, k.day))
        else:
            mo, d = map(int, cp_date(slug).split('.')); dates.append((mo, d))
        diff = dom - total
        runners.append({'slug': slug, 'label': label, 'sub': sub, 'verdict': verdict, 'ali': total, 'cp': dom, 'diff': diff, 'pct': round(diff / dom * 100)})
    a, b = min(dates), max(dates)
    when = f'{a[0]}.{a[1]}' + (f'~{b[0]}.{b[1]}' if a != b else '')
    return runners, when


def site_shot():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', PORT, '--bind', '127.0.0.1'], cwd=os.path.join(ROOT, 'dist'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        env = dict(os.environ, SHOT_PORT=PORT, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, shell=os.name == 'nt').stdout.strip())
        subprocess.run(['node', os.path.join(ROOT, 'tools/tvc/site_shot.cjs'), SHOT, os.path.join(D, 'site.png'), os.path.join(D, 'site-rows.json')], check=True, env=env)
    finally:
        srv.terminate()


def build_tl(runners, when):
    return {
        'bpm': BPM, 'beats': BEATS, 'runners': runners, 'when': when,
        'rows': json.load(open(os.path.join(D, 'site-rows.json'), encoding='utf-8')),
        'shot': list(__import__('PIL.Image', fromlist=['Image']).open(os.path.join(D, 'site.png')).size),
        'gates': [1.5, 2.5], 'lights': [4.5, 5],
        # 주자마다 [등장, 출발, 판정 도장, 끝]
        'R': [[6, 7.5, 9, 11], [11, 12, 16, 18], [18, 20, 24, 27]],
        'g1': [13, 20.6], 'bounce': 15, 'g2': 21.6,
        'navy': [[27, 32]], 'site': [27, 32], 'cta': [32, 37], 'gap': 36.72, 'end': 37,
    }


def music(path, TL):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    add(fx, bt(0.3), R.whoosh(0.4), 0.6)
    for b in TL['gates']:
        add(fx, bt(b), R.thud(), 1.0); add(fx, bt(b), R.crash(0.4), 0.3)
    for b in TL['lights']:
        add(fx, bt(b), R.tick(), 0.9); add(mel, bt(b), R.pluck(1046.5, 0.25), 0.7)
    big = {6, 11, 18, 20}
    for k in range(4, 27):
        add(dr, bt(k), R.kick(k in big), 0.95)
        add(dr, bt(k + 0.5), R.hat(), 0.6)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.6)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
    r1, r2, r3 = TL['R']
    add(fx, bt(r1[1]), R.whoosh(0.35), 0.8)  # 밴드: 뒤로 미끄러짐
    for k, f in enumerate((659.25, 587.33, 523.25, 440.0)):
        add(mel, bt(r1[1]) + k * 0.08, R.pluck(f, 0.15), 0.7)
    add(fx, bt(r2[1]), R.whoosh(0.3), 0.8)
    add(fx, bt(TL['g1'][0]), R.bell(1318.5), 0.7)  # 1만 원 문 땡
    add(fx, bt(TL['bounce']), R.thud(), 0.9)  # 20% 문에 튕김
    for k in range(4):
        add(fx, bt(r3[0]) + k * B, R.tick(), 0.9)  # 출발 전 깜빡임 연타
    add(fx, bt(r3[1]), R.riser(0.3), 0.6)
    for b in (TL['g1'][1], TL['g2']):
        add(fx, bt(b), R.boom(), 0.9); add(fx, bt(b), R.crash(0.6), 0.6)
    for (a, go, v, e), r in zip(TL['R'], TL['runners']):  # 판정 도장
        x = bt(v)
        add(fx, x, R.crash(1.1), 0.6); add(fx, x, R.thud(), 1.0)
        if r['verdict'] == '직구각':
            add(fx, x, R.bell(1760.0), 0.9); add(mel, x, R.stab((523.25, 659.25, 783.99), 0.6), 1.1)
        elif r['verdict'] == '애매':
            add(fx, x, R.bell(1174.66), 0.6); add(mel, x, R.stab((440.0, 523.25, 622.25), 0.4), 0.8)
        else:
            add(fx, x, R.bell(1318.5), 0.7); add(mel, x, R.stab((392.0, 466.16, 587.33), 0.6), 1.0)
    s0, s1 = TL['site']
    add(fx, bt(s0) - 0.15, R.whoosh(0.35), 0.8)
    add(mel, bt(s0), R.pad(ch[1], bt(s1 - s0)), 1.1)
    for k in range(int(s0), int(TL['cta'][1])):
        add(dr, bt(k), R.kick(), 0.5 if k < s1 else 0.75)
        add(dr, bt(k + 0.5), R.hat(), 0.35)
    for b in (s0 + 1.5, s0 + 2, s0 + 2.5):
        add(fx, bt(b), R.tick(), 0.7); add(mel, bt(b), R.pluck(987.77, 0.2), 0.6)
    add(fx, bt(s1) - 0.1, R.whoosh(0.3), 0.7); add(mel, bt(s1), R.stab(ch[2], 0.5), 0.9)
    for k in range(5):
        add(fx, bt(TL['cta'][0] + 1.5) + k * 0.09, R.tick(), 0.45)
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
    for r in TL['R']:
        silence(r[2] - 0.22, r[2])
    silence(TL['gap'], e)
    duck = np.ones(N)
    for k in list(range(4, 37)) + [e, e + 1, e + 2]:
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
    runners, when = read_numbers()
    print('숫자', when, [(r['label'], r['verdict'], r['ali'], r['cp'], r['diff'], r['pct']) for r in runners])
    site_shot()
    TL = build_tl(runners, when)
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
