# 15초 세로 광고 D안 "29개 다 더해 봤어요" — 숫자는 굽는 날 빌드 결과로 자동 집계, 박자 표 한 곳에서 화면과 음악을 같이 만들기
#   python3 tools/tvc/d_ad.py            → content/2026-10-28-tvc-15s-d/publish/tvc-d.mp4
#   STILLS=1 python3 tools/tvc/d_ad.py   → 박마다 정지 화면(publish/tvc-d_stills/)
#   SUB=8 python3 tools/tvc/d_ad.py      → 모션 블러 서브프레임 수(기본 4)
# 120 BPM, 한 박 0.5초, 15초 = 30박. 가독성 규칙: docs/marketing/motion-reference-vimeo.md 와 storyboard.md
import json, os, re, subprocess, sys, wave
from datetime import datetime, timedelta, timezone
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R  # 악기 재사용

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-10-28-tvc-15s-d')
OUT = os.path.join(D, 'publish')
BPM, BEATS = 120, 30
B = 60 / BPM
DUR = BEATS * B


# ── 숫자: 오늘 빌드 결과에서 직접 셈(확인 안 한 숫자 금지) ─────────
def count_verdicts():
    out = subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    prods = {p['name']: p for p in json.load(open(os.path.join(ROOT, 'data/products.json'), encoding='utf-8'))}
    res = {'good': [], 'meh': [], 'bad': []}
    key = {'직구각': 'good', '애매': 'meh', '국내가 나음': 'bad'}
    for line in out.splitlines():
        m = re.match(r'^\s+(.+?)\s+(직구각|애매|국내가 나음) \(₩', line)
        if m:
            res[key[m.group(2)]].append(prods.get(m.group(1).strip(), {'name': m.group(1)}))
    n = {k: len(v) for k, v in res.items()}
    n['all'] = sum(n.values())
    n['badSupp'] = sum(1 for p in res['bad'] if p.get('category') == 'supplement')
    stores = {p.get('domesticStore') for p in res['bad']}
    n['domName'] = '쿠팡이' if stores == {'쿠팡'} else '국내몰이'
    kst = datetime.now(timezone(timedelta(hours=9)))
    n['date'] = f'{kst.month}.{kst.day}'
    return n


def build_tl(n):
    tl = {
        'bpm': BPM, 'beats': BEATS, 'n': n,
        'pop': [0, 3],            # 점 n개가 차례로 톡톡
        'chips': [6, 6.5, 7],     # +배송비 +관세 +부가세
        'wave': [6, 8.5],         # 계산하는 물결
        'strobe': [9, 9.5],       # 글자 없는 0.25초 번쩍 2번 → 10박 드롭(3번째 타격)
        'drop': 10, 'hop': 10, 'merge': 12.5,
        'focusBad': [12.5, 16], 'focusGood': 16, 'pen': [16.5, 17.3],
        'wipe': 21, 'type1': [21.75, 22.5], 'type2': [22.5, 23], 'verdict': 23.25,
        'gap': 25.72, 'end': 26,
    }
    W = []  # [글자, 들어오는 박, 나가는 박, y, 크기, 색, 글꼴]
    W += [['해외몰이', 0.5, 5, 600, 150, 'navy', 'D'], ['늘 더 쌀까요?', 1.0, 5, 780, 150, 'orange', 'D']]
    W += [[f"{n['all']}개", 5.0, 9, 600, 210, 'orange', 'D'], ['다 더해 봤어요', 5.5, 9, 790, 120, 'navy', 'D']]
    W += [[f"{n['bad']}개는", 10.5, 16, 600, 190, 'blue', 'D'], [f"{n['domName']} 더 쌌어요", 11.0, 16, 790, 120, 'navy', 'D']]
    if n['badSupp']:
        W += [[f"그중 {n['badSupp']}개는 영양제예요", 12.5, 16, 905, 60, 'gray', 'P']]
    W += [['해외몰이 나은 건', 16.0, 21, 600, 120, 'navy', 'D'], [f"{n['good']}개", 16.5, 21, 780, 210, 'green', 'D']]
    if n['meh']:
        W += [[f"애매한 건 {n['meh']}개", 17.5, 21, 935, 60, 'gray', 'P']]
    W += [[f"{n['date']} 기준 · 직구각이 판정한 {n['all']}개(아마존 제외)", 5.0, 21, 340, 38, 'gray', 'P']]
    W += [['국내가만 넣으면', 21.5, 26, 600, 130, 'white', 'D'], ['바로 판정', 22.0, 26, 790, 160, 'salmon', 'D']]
    W += [['직구각', 26, None, 1000, 160, 'white', 'D'], ['관세까지 다 더해서 판정', 26, None, 1140, 54, 'white', 'P']]
    tl['words'] = W
    return tl


# ── 음악 ────────────────────────────────────────────────
def music(path, TL):
    add, N, SR = R.add, int(R.SR * DUR), R.SR
    assert N == R.N, '음악 길이가 15초가 아니에요'
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    # 0~5박: 점이 톡톡(가볍게), 박마다 올라가는 뜯는 음, 반박 하이햇
    n = TL['n']['all']
    p0, p1 = TL['pop']
    for i in range(n):
        add(fx, bt(p0) + i * (bt(p1) - bt(p0)) / n, R.tick(), 0.35)
    for k, f in enumerate((440.0, 523.25, 659.25, 783.99, 880.0)):
        add(mel, bt(k), R.pluck(f, 0.4), 1.3)
        add(mel, bt(k), R.pluck(f / 2, 0.4), 0.6)
        add(dr, bt(k + 0.5), R.hat(), 0.45)
    add(fx, bt(0.5), R.thud(), 0.5); add(fx, bt(1.0), R.thud(), 0.6)
    # 5박 "29개": 킥 + 화음, 5~9박 가벼운 그루브
    add(mel, bt(5), R.stab(ch[0], 0.5), 1.0)
    for k in range(5, 9):
        add(dr, bt(k), R.kick(k == 5), 0.9)
        add(dr, bt(k + 0.5), R.hat(), 0.6)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
    add(dr, bt(7), R.clap(), 0.6)
    for b, f in zip(TL['chips'], (987.77, 1174.66, 1318.51)):
        add(mel, bt(b), R.pluck(f, 0.25), 0.9)
    add(fx, bt(7.5), R.riser(bt(8.95) - bt(7.5)), 0.7)
    # 9·9.5 번쩍 연타(스네어+째깍), 9.72~10 무음, 10박 드롭
    for b in TL['strobe']:
        add(dr, bt(b), R.snare(0.9), 1.0); add(fx, bt(b), R.tick(), 0.9)
    add(fx, bt(10), R.boom(), 1.0); add(fx, bt(10), R.crash(1.3), 0.7)
    add(mel, bt(10), R.stab(ch[3], 0.5), 1.1)
    # 10~21박 그루브
    for k in range(10, 21):
        add(dr, bt(k), R.kick(k in (10, 16)), 1.0)
        add(dr, bt(k + 0.5), R.hat(), 0.7)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.7)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45))
    for i in range(n):  # 점이 줄로 착지할 때 째깍(작게)
        add(fx, bt(TL['hop']) + i * 0.025 + 0.42, R.tick(), 0.25)
    add(fx, bt(10.5), R.thud(), 0.6); add(fx, bt(11), R.thud(), 0.5)
    add(fx, bt(TL['merge']), R.whoosh(0.25), 0.6); add(mel, bt(TL['merge']), R.pluck(1174.66, 0.3), 0.9)
    add(mel, bt(16), R.stab((523.25, 659.25, 783.99), 0.5), 1.0); add(fx, bt(16.5), R.thud(), 0.6)
    add(fx, bt(TL['pen'][0]), R.whoosh(0.7), 0.5)
    add(fx, bt(TL['pen'][1]), R.bell(1760.0), 0.7)
    # 21박 남색 밀고 들어옴 → 쉬는 구간(패드), 타이핑 째깍, 23.25 판정 종
    add(fx, bt(20.8), R.whoosh(0.3), 0.8)
    add(mel, bt(21), R.pad(ch[1], bt(4.6)), 1.1)
    add(dr, bt(21), R.kick(True), 0.8)
    for k in range(6):
        add(fx, bt(TL['type1'][0]) + k * bt(0.75) / 6, R.tick(), 0.55)
    for k in range(4):
        add(fx, bt(TL['type2'][0]) + k * bt(0.5) / 4, R.tick(), 0.55)
    add(fx, bt(TL['verdict']), R.bell(1318.5), 0.8); add(mel, bt(TL['verdict']), R.stab((523.25, 659.25, 783.99), 0.5), 0.9)
    for b, g in ((22, 0.5), (23, 0.6), (24, 0.8), (25, 0.9)):
        add(dr, bt(b), R.kick(), g)
    add(dr, bt(23), R.clap(), 0.5); add(dr, bt(25), R.clap(), 0.6)
    for k in range(6):
        add(dr, bt(24.25 + k * 0.25), R.snare(0.3 + k * 0.1))
    add(fx, bt(24.5), R.riser(bt(TL['gap']) - bt(24.5)), 0.8)
    # 26박 마지막 강타 → 정지 엔드 카드
    add(fx, bt(26), R.boom(), 1.0); add(fx, bt(26), R.crash(), 0.9)
    add(mel, bt(26), R.stab(ch[0], 0.6), 1.2)
    for k in (26, 27, 28):
        add(dr, bt(k), R.kick(k in (26, 28)), 1.0)
    add(dr, bt(27), R.clap(), 0.7)
    add(mel, bt(27), R.stab(ch[2], 0.5), 0.8)
    add(mel, bt(28), R.stab((440.0, 523.25, 659.25, 880.0), 2.0), 1.2)
    add(mel, bt(28), R.bass(110.0, 1.6), 1.0)

    def silence(b0, b1):
        i, j = int(bt(b0) * SR), int(bt(b1) * SR)
        for arr in (dr, mel, fx):
            arr[i:j] *= np.linspace(1, 0, j - i) ** 6
    silence(9.72, 10)
    silence(TL['gap'], 26)
    duck = np.ones(N)
    for k in list(range(5, 21)) + [26, 27, 28]:
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
    n = count_verdicts()
    print('집계', n)
    TL = build_tl(n)
    with open(os.path.join(D, 'timeline.js'), 'w', encoding='utf-8') as f:
        f.write('window.TL=' + json.dumps(TL, ensure_ascii=False) + ';\n')
    html = os.path.join(D, 'ad.html')
    r = ['node', os.path.join(ROOT, 'tools/tvc/render_html.mjs'), html]
    if os.environ.get('STILLS'):
        ts = os.environ.get('T') or ','.join(f'{b * B + 0.3:.2f}' for b in range(30))
        subprocess.run(r + [os.path.join(OUT, 'tvc-d.mp4'), '--stills', ts], check=True)
        return
    snd = os.path.join(OUT, 'music.wav')
    music(snd, TL)
    subprocess.run(r + [os.path.join(OUT, 'tvc-d.mp4'), '--음악', snd, '--sub', os.environ.get('SUB', '4'), '--dur', str(DUR)], check=True)


if __name__ == '__main__':
    main()
