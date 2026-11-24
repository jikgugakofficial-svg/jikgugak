# 20초 세로 릴스 "200달러 넘으면 포기할까요?" — 목요일 질문형, 11/26 보스 QC 울트라 헤드폰 2세대. tools/tvc/bfceiling_ad.py 틀에서 상품·훅·끝 글자만 바꿈. 원래 설명: 목요일 질문형(200달러 천장을 뚫어도 세금까지 넣은 목표가가 20% 싼 선에 닿으면 직구각), 11/16 작가 장면표
#   python tools/tvc/bfceiling2_ad.py            → content/2026-11-26-reel-bfceiling2/publish/reel-bfceiling2.mp4
#   STILLS=1 python tools/tvc/bfceiling2_ad.py   → 박마다 정지 화면
# 숫자는 굽는 순간: data/products.json 국내가·확인 날짜 + 빌드(dist/live.json) 목표가(breakeven) + settings 결제 환율(payFx).
#   원화 = 목표가 달러 × 결제 환율, 천 원 단위 버림. 캡션·livecheck의 목표가·환율 숫자도 같이 맞춰요. 아마존 가격은 안 써요.
# 120 BPM, 한 박 0.5초, 40박 = 20초.
import json, os, re, subprocess, sys, wave
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-11-26-reel-bfceiling2')
OUT = os.path.join(D, 'publish')
NAME = 'reel-bfceiling2'
BPM, BEATS = 120, 40
B = 60 / BPM
DUR = BEATS * B
SLUG = 'amazon-bose-qc-ultra-headphones-2'
OPT = '로켓배송'   # 캡션·livecheck 괄호 안에 쓰는 쿠팡 쪽 조건(기록에 색이 없어 색은 안 써요)


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
    p = next(x for x in P if (x.get('slug') or x.get('id')) == SLUG)
    usd = L[SLUG]['breakeven']
    assert usd > 200, '목표가가 200달러 이하면 이 영상(천장을 뚫는 이야기)이 안 맞아요'
    m = re.search(r'(\d{4})\.(\d{2})\.(\d{2})', p['checkedAt'])
    return {'dom': p['domesticKrw'], 'usd': usd, 'won': int(usd * pf['usdKrw']) // 1000 * 1000, 'payFx': pf['usdKrw'], 'payDate': pf['date'],
            'checked': f'{m[2]}.{m[3]}', 'taxPct': '18.8', 'taxNote': '관세 8% + 부가세 10%',
            'endSmall': '블프는 내일, 27일 금요일', 'hook1': '200달러 넘으면', 'hook2': '포기할까요?',
            'domLabel': '보스 QC 울트라 2세대'}  # 기둥 위 작은 글자(소리 없이 봐도 무슨 상품인지 보이게, 11/24 팀장 검수)


def sync_caption(n):
    f = os.path.join(D, 'publish.json')
    pj = json.load(open(f, encoding='utf-8'))
    pay = f"{n['payFx']:,.2f}".replace('.00', '')
    pd = f"{n['payDate'][5:7]}.{n['payDate'][8:10]}"
    t = pj['channels']['reels']['text']
    t = re.sub(r'\d{3}달러\(약 [^)]+\)', f"{n['usd']}달러(약 {manwon(n['won'])})", t)
    t = re.sub(r'결제 환율 [\d,.]+원\(\d+\.\d+\)', f'결제 환율 {pay}원({pd})', t)
    t = re.sub(r'쿠팡에서 [\d,]+원이에요\(' + OPT + r', \d+\.\d+ 확인\)', f"쿠팡에서 {n['dom']:,}원이에요({OPT}, {n['checked']} 확인)", t)
    pj['channels']['reels']['text'] = t
    it = pj['livecheck']['items'][0]
    it['expect'] = f"쿠팡 {n['dom']:,}원({n['checked']}), 목표가 {n['usd']}달러 이하(약 {manwon(n['won'])}, 결제 환율 {pay}원 {pd} 기준), 표에 '넘음'"
    it['inText'] = f"쿠팡 {n['dom']:,}원({OPT}, {n['checked']}), {n['usd']}달러(약 {manwon(n['won'])}) 이하"
    json.dump(pj, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(f, 'a', encoding='utf-8').write('\n')


def build_tl(n):
    pd = f"{n['payDate'][5:7]}.{n['payDate'][8:10]}"
    return {'bpm': BPM, 'beats': BEATS, **n, 'subLine': f"쿠팡 {n['checked']} 확인 · 결제 환율 {pd}",
            'cross': 5, 'hit': 8, 'line': [14, 22], 'touch': [22, 28], 'chip': [28, 34], 'gap': 33.72, 'end': 34}


def music(path, TL):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    add(fx, bt(0.6), R.thud(), 0.9); add(fx, bt(0.6), R.boom(), 0.5)  # 천장 쿵
    for k, f in enumerate((392.0, 440.0, 523.25, 587.33)):
        add(mel, bt(k), R.pluck(f, 0.35), 1.2)
    add(fx, bt(1), R.riser(bt(TL['cross']) - bt(1)), 0.6)
    c = bt(TL['cross'])
    add(fx, c, R.crash(0.8), 0.7); add(fx, c, R.thud(), 0.9); add(fx, c + 0.05, R.tick(), 0.9)  # 쩍
    for k in range(4, 34):
        add(dr, bt(k), R.kick(k in (8, 14, 22, 28)), 0.95)
        add(dr, bt(k + 0.5), R.hat(), 0.6)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.6)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
    h = bt(TL['hit'])
    add(fx, h - 0.15, R.whoosh(0.3), 0.6); add(fx, h, R.crash(1.1), 0.7); add(fx, h, R.bell(1760.0), 0.9); add(mel, h, R.stab((523.25, 659.25, 783.99), 0.6), 1.1)
    l0 = bt(TL['line'][0])
    add(fx, l0, R.thud(), 0.8)
    for k in range(8):
        add(fx, l0 + 0.35 + k * 0.08, R.tick(), 0.6)  # 선이 그어지며 타닥
    t0 = bt(TL['touch'][0])
    add(fx, t0 + 0.1, R.whoosh(0.4), 0.7); add(fx, t0 + 0.375, R.thud(), 0.9); add(fx, t0 + 0.375, R.bell(2093.0), 0.7)
    add(mel, t0 + 0.375, R.stab((587.33, 739.99, 880.0), 0.5), 1.0)
    a, b = TL['chip']
    add(fx, bt(a), R.tick(), 0.8); add(mel, bt(a), R.pad(ch[1], bt(b - a)), 1.0)
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
    silence(TL['hit'] - 0.2, TL['hit'])
    silence(TL['gap'], e)
    duck = np.ones(N)
    for k in list(range(4, 34)) + [e, e + 1]:
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
    sync_caption(n)
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
