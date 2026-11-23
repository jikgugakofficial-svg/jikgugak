# 17초 세로 릴스 "블프 위크, 마지막 날은?" — 화요일 퀴즈(달력 + 보기 3개 → 30일까지 칠하기 → 27일·30일 도장 → 세일 캘린더 캡처)
#   bfclock_ad.py 틀을 다시 쓴 것(11/19 운영자: 만든 틀 재사용). 시계 장면은 빼고 달력 장면만 늘렸어요.
#   python tools/tvc/bfend_ad.py            → content/2026-11-24-reel-bfend/publish/reel-bfend.mp4
#   STILLS=1 python tools/tvc/bfend_ad.py   → 박마다 정지 화면
# 숫자는 날짜뿐: data/events.json amazon-bf-week-2026(끝 30일), black-friday(27일), cyber-monday(30일). 가격·환율 없음.
#   "오늘부터 N일"은 publish.json 게시 날짜부터 30일까지(둘 다 포함)로 세요. 게시가 밀리면 다시 구우면 바뀌어요.
# 120 BPM, 한 박 0.5초, 34박 = 17초. 장면표는 content/2026-11-24-reel-bfend/storyboard.md
import json, os, subprocess, sys, time, wave
from datetime import date
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-11-24-reel-bfend')
OUT = os.path.join(D, 'publish')
NAME = 'reel-bfend'
BPM, BEATS = 120, 34
B = 60 / BPM
DUR = BEATS * B
PORT = '8793'


def read_numbers():
    ev = json.load(open(os.path.join(ROOT, 'data/events.json'), encoding='utf-8'))
    ev = ev if isinstance(ev, list) else next(v for v in ev.values() if isinstance(v, list))
    wk = next(e for e in ev if e['id'] == 'amazon-bf-week-2026')
    bf = next(e for e in ev if e['id'] == 'black-friday') if any(e['id'] == 'black-friday' for e in ev) else None
    s, e = date.fromisoformat(wk['date']), date.fromisoformat(wk['end'])
    assert wk['status'] == 'confirmed' and '오후 5시 1분' in wk['note'], '아마존 블프 위크 시작 시각이 events.json과 달라요'
    assert (s.month, s.day, e.month, e.day) == (11, 19, 11, 30), f'날짜가 바뀌었어요: {s}~{e} → 장면(달력·시계)을 다시 맞춰야 해요'
    if bf: assert bf['date'] == '2026-11-27', '블랙프라이데이 날짜가 27일이 아니에요'
    cm = next((x for x in ev if x['id'] == 'cyber-monday'), None)
    assert cm and cm['date'] == '2026-11-30' and cm.get('status') == 'confirmed', '사이버먼데이가 11/30 확정이 아니에요'
    pf = os.path.join(D, 'publish.json')
    pj = json.load(open(pf, encoding='utf-8')) if os.path.exists(pf) else {}
    sch = pj.get('schedule') or next((c.get('schedule') for c in (pj.get('channels') or {}).values() if isinstance(c, dict) and c.get('schedule')), None)
    post = date.fromisoformat(os.environ.get('POST') or (sch[:10] if sch else '2026-11-24'))  # 게시 12:25 KST는 UTC로도 같은 날
    assert s <= post <= e, f'게시 날짜 {post}가 블프 위크 밖이에요'
    return {'days': (e - s).days + 1, 'range': f'{s.month}/{s.day}~{e.month}/{e.day}', 'post': post.day, 'left': (e - post).days + 1}


def site_shot():
    subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, capture_output=True, text=True, check=True)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', PORT, '--bind', '127.0.0.1'], cwd=os.path.join(ROOT, 'dist'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        env = dict(os.environ, SHOT_PORT=PORT, HIDE='.ev-dday', NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, shell=os.name == 'nt').stdout.strip())
        li = 'li[data-id="amazon-bf-week-2026"]'
        rows = json.dumps({'title': f'{li} .ev-title', 'range': f'{li} .ev-range', 'text': f'{li} p'})
        subprocess.run(['node', os.path.join(ROOT, 'tools/tvc/page_clip.cjs'), '/calendar.html', os.path.join(D, 'site.png'), os.path.join(D, 'site-rows.json'),
                        li, li, rows], check=True, env=env)
    finally:
        srv.terminate()


def build_tl(n):
    return {
        'bpm': BPM, 'beats': BEATS, **n,
        'rows': json.load(open(os.path.join(D, 'site-rows.json'), encoding='utf-8')),
        'shot': list(__import__('PIL.Image', fromlist=['Image']).open(os.path.join(D, 'site.png')).size),
        'pins': [4, 4.5, 5], 'hit': 8,
        'cal': [0, 14], 'paint': [10.4, 13.4],
        'stamp': [14, 24], 'stamp2': 20, 'site': [24, 30], 'navy': [[24, 30]], 'gap': 29.72, 'end': 30,
    }


def music(path, TL):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    # 0~4박: 시계가 째깍, 올라가는 음
    for k, f in enumerate((392.0, 440.0, 523.25, 587.33)):
        add(mel, bt(k), R.pluck(f, 0.35), 1.2)
    for k in range(8):
        add(fx, bt(k * 0.5), R.tick(), 0.5)
    add(fx, bt(0.5), R.riser(bt(3.8) - bt(0.5)), 0.5)
    for b in TL['pins']:  # 핀 탁탁탁
        add(fx, bt(b), R.thud(), 0.8); add(fx, bt(b), R.tick(), 0.8)
    big = {4, 8, 14, 20}
    for k in range(4, 24):
        add(dr, bt(k), R.kick(k in big), 0.95)
        add(dr, bt(k + 0.5), R.hat(), 0.6)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.6)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
    add(fx, bt(7.3), R.riser(bt(7.9) - bt(7.3)), 0.7)
    h = bt(TL['hit'])  # 정답 ②
    add(fx, h, R.crash(1.1), 0.7); add(fx, h, R.bell(1760.0), 0.9); add(mel, h, R.stab((523.25, 659.25, 783.99), 0.6), 1.1)
    add(fx, h + 0.05, R.whoosh(0.3), 0.5)  # 틀린 핀 떨어짐
    p0, p1 = TL['paint']  # 달력 칸 12개 타닥
    for d in range(12):
        tt = bt(p0) + d * (bt(p1) - bt(p0)) / 11
        add(fx, tt, R.tick(), 0.8); add(mel, tt, R.pluck(523.25 * 2 ** (d / 12), 0.15), 0.5)
    st = bt(TL['stamp'][0])  # 도장 쿵
    add(fx, st - 0.12, R.whoosh(0.25), 0.6); add(fx, st, R.boom(), 0.9); add(fx, st, R.thud(), 0.9)
    s2 = bt(TL['stamp2'])  # 30일 도장 쿵
    add(fx, s2 - 0.12, R.whoosh(0.25), 0.6); add(fx, s2, R.boom(), 0.9); add(fx, s2, R.thud(), 0.9); add(fx, s2, R.bell(2093.0), 0.6)
    a, b = TL['site']
    add(fx, bt(a) - 0.15, R.whoosh(0.35), 0.8)
    add(mel, bt(a), R.pad(ch[1], bt(b - a)), 1.1)
    for k in range(int(a), int(b)):
        add(dr, bt(k), R.kick(), 0.6)
        add(dr, bt(k + 0.5), R.hat(), 0.35)
    for x in (a + 1.5, a + 2.5, a + 3.5):
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
    silence(TL['hit'] - 0.2, TL['hit'])  # 정답 직전 0.1초 멈춤
    silence(TL['gap'], e)
    duck = np.ones(N)
    for k in list(range(4, 30)) + [e, e + 1]:
        i = int(bt(k) * SR); m = int(0.2 * SR); j = min(N, i + m)
        duck[i:j] = np.minimum(duck[i:j], 0.45 + 0.55 * np.arange(j - i) / m)
    mix = dr * 0.8 + mel * duck * 0.9 + fx * 0.8
    mix = R.sosfilt(R.sos('highpass', 30), mix)
    k = int(0.35 * SR); mix[-k:] *= np.linspace(1, 0, k)
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    d = int(0.012 * SR); right = mix.copy(); right[d:] = 0.88 * mix[d:] + 0.12 * mix[:-d]
    st2 = np.stack([mix, right], 1); st2 = st2 / (np.abs(st2).max() + 1e-9) * 0.7
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st2 * 32767).astype(np.int16).tobytes())


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
