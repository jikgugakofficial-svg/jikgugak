# 20초 세로 릴스 "국내 30만 8천 원, 아마존은 얼마면?" — 수요일 판정 쇼(림보 바: 국내가 기둥 위로 목표가 바가 내려와 멈춤), 11/16 작가 장면표
#   python tools/tvc/bftarget3_ad.py            → content/2026-11-18-reel-bftarget3/publish/reel-bftarget3.mp4
#   STILLS=1 python tools/tvc/bftarget3_ad.py   → 박마다 정지 화면
# 숫자는 굽는 순간 data/products.json 국내가 + 빌드(dist/live.json) 목표가(breakeven, 달러) + settings 결제 환율(payFx)로:
#   원화 = 목표가 달러 × 결제 환율, 천 원 단위 버림(블프 페이지 표와 같은 방식). 아마존 가격은 안 써요.
# 120 BPM, 한 박 0.5초, 40박 = 20초. 장면표는 content/2026-11-18-reel-bftarget3/storyboard.md
import json, os, re, subprocess, sys, time, wave
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-11-18-reel-bftarget3')
OUT = os.path.join(D, 'publish')
NAME = 'reel-bftarget3'
BPM, BEATS = 120, 40
B = 60 / BPM
DUR = BEATS * B
PORT = '8793'
# 순서: 11/16 매니저(비츠 솔로 4 → 가민 포러너 265 교체). 마지막이 훅의 30만 8천 원(에어팟)
#   목표가 달러는 결제 환율(매일 바뀜)에 따라 1달러쯤 움직여요 → 게시 날 아침 다시 구우면 영상·캡션·livecheck 숫자가 그날 값으로 같이 바뀌어요.
#   (승인 때 값과 비교는 매니저가 5% 규칙으로: 판정 단어가 없는 목표가 글이라 차이 금액 = 목표가 원화)
ITEMS = [('amazon-elgato-stream-deck-mk2', '스트림 덱 MK.2', '엘가토 스트림 덱 MK.2'),
         ('amazon-garmin-forerunner-265', '가민 포러너 265', '가민 포러너 265(46mm)'),
         ('amazon-apple-airpods-pro-3', '에어팟 프로 3', '에어팟 프로 3')]
CIRCLE = '①②③'


def manwon(n):
    k = n // 1000
    return f'{k // 10}만' + (f' {k % 10}천' if k % 10 else '') + ' 원'


def read_numbers():
    subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, capture_output=True, check=True)
    P = json.load(open(os.path.join(ROOT, 'data/products.json'), encoding='utf-8'))
    P = P if isinstance(P, list) else P['products']
    L = json.load(open(os.path.join(ROOT, 'dist/live.json'), encoding='utf-8'))
    L = L.get('products', L)
    pf = json.load(open(os.path.join(ROOT, 'data/settings.json'), encoding='utf-8'))['payFx']
    pay = pf['usdKrw']
    items = []
    for i, (slug, name, _) in enumerate(ITEMS):
        p = next(x for x in P if (x.get('slug') or x.get('id')) == slug)
        dom, usd = p['domesticKrw'], L[slug]['breakeven']
        b0 = 4 + 8 * i
        items.append({'name': name, 'dom': dom, 'usd': usd, 'won': int(usd * pay) // 1000 * 1000,
                      'b0': b0, 'b1': 30 if i == len(ITEMS) - 1 else b0 + 8, 'land': b0 + 3})
    return {'items': items, 'payFx': pay, 'payDate': pf['date'], 'endLine1': '내일 오후 5시 1분', 'endLine2': '블프 위크 시작'}


def sync_caption(n):
    """캡션 ①②③ 줄·결제 환율 줄과 livecheck expect를 굽는 숫자와 같게."""
    f = os.path.join(D, 'publish.json')
    pj = json.load(open(f, encoding='utf-8'))
    t = pj['channels']['reels']['text']
    for i, ((_, _, cap), it) in enumerate(zip(ITEMS, n['items'])):
        line = f"{CIRCLE[i]} {cap}: {it['usd']}달러(약 {manwon(it['won'])}), 국내 {it['dom']:,}원"
        t = re.sub(rf'^{CIRCLE[i]} [^\n]*$', line, t, flags=re.M)
    hook = manwon(n['items'][-1]['dom'])  # 훅·둘째 문단의 '국내 ○만 ○천 원'은 마지막 상품(에어팟) 국내가
    t = re.sub(r'^국내 \d+만(?: \d천)? 원, 아마존은 얼마면\?', f'국내 {hook}, 아마존은 얼마면?', t, flags=re.M)
    t = re.sub(r'\d+만(?: \d천)? 원은 에어팟 프로 3의', f'{hook}은 에어팟 프로 3의', t)
    m, d = n['payDate'][5:7], n['payDate'][8:10]
    t = re.sub(r'결제 환율 [\d,.]+원\(\d+\.\d+\)', f"결제 환율 {n['payFx']:,.2f}원({m}.{d})".replace('.00원', '원'), t)
    pj['channels']['reels']['text'] = t
    for it in pj['livecheck']['items']:
        for x in n['items']:
            if x['name'].split()[0] in it['what']:
                it['expect'] = re.sub(r'목표가 \d+달러 이하\(약 [^,]+원', f"목표가 {x['usd']}달러 이하(약 {manwon(x['won'])}", it['expect'])
                it['inText'] = re.sub(r'\d+달러\(약 [^)]+\)', f"{x['usd']}달러(약 {manwon(x['won'])})", it['inText'])
                it['inText'] = re.sub(r'국내 \d+만(?: \d천)? 원', f"국내 {manwon(x['dom'])}", it['inText'])
                it['inText'] = re.sub(r'국내 [\d,]+원', f"국내 {x['dom']:,}원", it['inText'])
                it['expect'] = re.sub(r'^쿠팡 [\d,]+원', f"쿠팡 {x['dom']:,}원", it['expect'])
    json.dump(pj, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(f, 'a', encoding='utf-8').write('\n')


def site_shot():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', PORT, '--bind', '127.0.0.1'], cwd=os.path.join(ROOT, 'dist'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        env = dict(os.environ, SHOT_PORT=PORT, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, shell=os.name == 'nt').stdout.strip())
        rows = json.dumps({'title': '#bf-target', 'head': 'p.warn-line + .bf-table-wrap thead', 'warn': 'p.warn-line'})
        subprocess.run(['node', os.path.join(ROOT, 'tools/tvc/page_clip.cjs'), '/deals/blackfriday.html', os.path.join(D, 'site.png'), os.path.join(D, 'site-rows.json'),
                        '#bf-target', 'a[href="/p/amazon-sony-wh-1000xm6"]', rows], check=True, env=env)
    finally:
        srv.terminate()


def build_tl(n):
    return {
        'bpm': BPM, 'beats': BEATS, **n,
        'rows': json.load(open(os.path.join(D, 'site-rows.json'), encoding='utf-8')),
        'shot': list(__import__('PIL.Image', fromlist=['Image']).open(os.path.join(D, 'site.png')).size),
        'site': [30, 36], 'navy': [[30, 36]], 'gap': 35.72, 'end': 36,
    }


def music(path, TL):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    for k, f in enumerate((392.0, 440.0, 523.25, 587.33)):  # 0~4박: 기둥이 솟음
        add(mel, bt(k), R.pluck(f, 0.35), 1.2)
    add(fx, bt(0.2), R.thud(), 0.8)
    add(fx, bt(0.5), R.riser(bt(3.8) - bt(0.5)), 0.5)
    for k in range(4, 30):
        add(dr, bt(k), R.kick(k in (4, 12, 20)), 0.95)
        add(dr, bt(k + 0.5), R.hat(), 0.6)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.6)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
    for i, it in enumerate(TL['items']):
        add(fx, bt(it['b0']) + 0.1, R.thud(), 0.8)  # 기둥 쿵
        land = bt(it['land'])
        add(fx, land - 0.55, R.whoosh(0.5 if i == 2 else 0.4), 0.8)  # 바 슈웅
        add(fx, land, R.tick(), 0.9); add(mel, land, R.stab((523.25, 659.25, 783.99) if i < 2 else (587.33, 739.99, 880.0), 0.5), 1.0)
        if i == 2:
            add(fx, land, R.crash(1.1), 0.8); add(fx, land, R.boom(), 0.8)
        add(fx, land + 0.3, R.bell(1760.0 + 220 * i), 0.6)
    a, b = TL['site']
    add(fx, bt(a) - 0.15, R.whoosh(0.35), 0.8)
    add(mel, bt(a), R.pad(ch[1], bt(b - a)), 1.1)
    for k in range(int(a), int(b)):
        add(dr, bt(k), R.kick(), 0.6)
        add(dr, bt(k + 0.5), R.hat(), 0.35)
    for x in (a + 1.2, a + 2.2, a + 3.4):
        add(fx, bt(x), R.tick(), 0.7); add(mel, bt(x), R.pluck(987.77, 0.2), 0.6)
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
    silence(TL['gap'], e)
    duck = np.ones(N)
    for k in list(range(4, 36)) + [e, e + 1]:
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
    print('숫자', [(i['name'], i['dom'], i['usd'], i['won']) for i in n['items']], n['payFx'], n['payDate'])
    sync_caption(n)
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
