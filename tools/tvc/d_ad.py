# 20초 세로 광고 D안 "29개 다 더해 봤어요" — 숫자는 굽는 날 빌드 결과로 자동 집계, 박자 표 한 곳에서 화면과 음악을 같이 만들기
#   python3 tools/tvc/d_ad.py            → content/2026-10-28-tvc-15s-d/publish/tvc-d.mp4
#   STILLS=1 python3 tools/tvc/d_ad.py   → 박마다 정지 화면(publish/tvc-d_stills/)
#   SUB=8 python3 tools/tvc/d_ad.py      → 모션 블러 서브프레임 수(기본 4)
# 120 BPM, 한 박 0.5초, 20초 = 40박. 가독성 규칙: docs/marketing/motion-reference-vimeo.md 와 storyboard.md
import json, os, re, subprocess, sys, wave
from datetime import datetime, timedelta, timezone
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R  # 악기 재사용

ROOT = R.ROOT
D = os.path.join(ROOT, 'content/2026-10-28-tvc-15s-d')
OUT = os.path.join(D, 'publish')
BPM, BEATS = 120, 40
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
    # 10/28 운영자: "너무 빨라서 잘 안 보여, 15초 넘어도 되니 속도 적절하게" → 20초(40박), 장면마다 읽을 시간 2.5~3초
    tl = {
        'bpm': BPM, 'beats': BEATS, 'n': n,
        'pop': [0, 3.5],               # 점 n개가 차례로 톡톡
        's2': [6, 12],                 # 남색 구간(번짐 → 드롭에 사선으로 걷힘)
        'bounce': [6, 11],             # 박마다 열 따라 튀어 오름
        'chips': [7.5, 8, 8.5], 'chipsOut': 11,  # +배송비 +관세 +부가세
        'wave': [7.5, 10],             # 계산하는 물결
        'strobe': [11, 11.5],          # 글자 없는 번쩍 2번 → 12박 드롭
        'drop': 12, 'hop': 12, 'merge': 14.5,
        'focusBad': [14.5, 19], 'focusGood': 19, 'pen': [19.75, 20.75],
        'groove': [6, 25],
        'wipe': 25, 'type1': [27, 28.25], 'type2': [28.75, 29.75], 'verdict': 30.5,
        'gap': 35.72, 'end': 36,
    }
    W = []  # [글자, 들어오는 박, 나가는 박, y, 크기, 색, 글꼴]
    W += [['해외몰이', 0.5, 6, 600, 150, 'navy', 'D'], ['늘 더 쌀까요?', 1.0, 6, 780, 150, 'orange', 'D']]
    W += [[f"{n['all']}개", 6.0, 11, 600, 210, 'orange', 'D'], ['다 더해 봤어요', 6.5, 11, 790, 120, 'white', 'D']]
    W += [[f"{n['bad']}개는", 12.5, 19, 600, 190, 'blue', 'D'], [f"{n['domName']} 더 쌌어요", 13.0, 19, 790, 120, 'navy', 'D']]
    if n['badSupp']:
        W += [[f"그중 {n['badSupp']}개는 영양제예요", 15.0, 19, 905, 60, 'gray', 'P']]
    W += [['해외몰이 나은 건', 19.0, 25, 600, 120, 'navy', 'D'], [f"{n['good']}개", 19.5, 25, 780, 210, 'green', 'D']]
    if n['meh']:
        W += [[f"애매한 건 {n['meh']}개", 20.75, 25, 935, 60, 'gray', 'P']]
    foot = f"{n['date']} 기준 · 직구각이 판정한 {n['all']}개(아마존 제외)"
    W += [[foot, 6.0, 11, 340, 38, 'mute', 'P'], [foot, 12.2, 25, 340, 38, 'gray', 'P']]
    W += [['국내가만 넣으면', 25.5, 36, 600, 130, 'white', 'D'], ['바로 판정', 26.0, 36, 790, 160, 'salmon', 'D']]
    W += [['직구각', 36, None, 1000, 160, 'white', 'D'], ['관세까지 다 더해서 판정', 36, None, 1140, 54, 'white', 'P']]
    tl['words'] = W
    return tl


# ── 음악(박자 표 TL에서 모든 시각을 읽음) ─────────────────────
def music(path, TL):
    SR = R.SR
    N = int(SR * DUR)
    R.N = N  # render_b의 add()가 이 길이를 씀
    add = R.add
    bt = lambda x: x * B
    dr, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    ch, roots = R.CHORDS, R.ROOTS
    n = TL['n']['all']
    s2, s2e = TL['s2']; drop, wipe, end = TL['drop'], TL['wipe'], TL['end']
    # 인트로: 점이 톡톡, 박마다 올라가는 뜯는 음
    p0, p1 = TL['pop']
    for i in range(n):
        add(fx, bt(p0) + i * (bt(p1) - bt(p0)) / n, R.tick(), 0.35)
    for k, f in enumerate((440.0, 523.25, 587.33, 659.25, 783.99, 880.0)):
        add(mel, bt(k), R.pluck(f, 0.4), 1.3)
        add(mel, bt(k), R.pluck(f / 2, 0.4), 0.6)
        add(dr, bt(k + 0.5), R.hat(), 0.45)
    add(fx, bt(0.5), R.thud(), 0.5); add(fx, bt(1.0), R.thud(), 0.6)
    # 남색 번짐 + "29개": 휙 + 화음, 가벼운 그루브
    add(fx, bt(s2) - 0.12, R.whoosh(0.3), 0.7)
    add(mel, bt(s2), R.stab(ch[0], 0.5), 1.0)
    st0 = TL['strobe'][0]
    for k in range(s2, int(st0)):
        add(dr, bt(k), R.kick(k == s2), 0.9)
        add(dr, bt(k + 0.5), R.hat(), 0.6)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.6)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45), 0.8)
    for b, f in zip(TL['chips'], (987.77, 1174.66, 1318.51)):
        add(mel, bt(b), R.pluck(f, 0.25), 0.9)
    add(fx, bt(TL['chips'][-1]), R.riser(bt(st0) - 0.05 - bt(TL['chips'][-1])), 0.7)
    # 번쩍 연타 → 무음 → 드롭
    for b in TL['strobe']:
        add(dr, bt(b), R.snare(0.9), 1.0); add(fx, bt(b), R.tick(), 0.9)
    add(fx, bt(drop), R.boom(), 1.0); add(fx, bt(drop), R.crash(1.3), 0.7)
    add(mel, bt(drop), R.stab(ch[3], 0.5), 1.1)
    for k in range(drop, wipe):
        add(dr, bt(k), R.kick(k in (drop, TL['focusGood'])), 1.0)
        add(dr, bt(k + 0.5), R.hat(), 0.7)
        if k >= TL['focusGood']:
            add(dr, bt(k + 0.25), R.hat(), 0.3); add(dr, bt(k + 0.75), R.hat(), 0.3)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.7)
        add(mel, bt(k + 0.5), R.bass(roots[(k // 2) % 4], B * 0.45))
    for i in range(n):  # 점이 줄로 착지할 때 째깍(작게)
        add(fx, bt(TL['hop']) + 0.06 + i * 0.022 + 0.46, R.tick(), 0.25)
    add(fx, bt(drop + 0.5), R.thud(), 0.6); add(fx, bt(drop + 1), R.thud(), 0.5)
    add(fx, bt(TL['merge']), R.whoosh(0.25), 0.6); add(mel, bt(TL['merge']), R.pluck(1174.66, 0.3), 0.9)
    fg = TL['focusGood']
    add(fx, bt(fg) - 0.1, R.whoosh(0.3), 0.5)
    add(mel, bt(fg), R.stab((523.25, 659.25, 783.99), 0.5), 1.0); add(fx, bt(fg + 0.5), R.thud(), 0.6)
    add(fx, bt(TL['pen'][0]), R.whoosh(0.7), 0.5)
    add(fx, bt(TL['pen'][1]), R.bell(1760.0), 0.7)
    # 남색 사선 → 쉬는 구간: 패드 두 화음, 가벼운 킥, 타이핑 째깍, 판정 종
    add(fx, bt(wipe) - 0.2, R.whoosh(0.3), 0.8)
    add(fx, bt(wipe) + 0.25, R.whoosh(0.35), 0.6)
    vb = TL['verdict']
    add(mel, bt(wipe), R.pad(ch[1], bt(vb - wipe)), 1.1)
    add(mel, bt(vb), R.pad(ch[3], bt(end - vb) - 0.3), 1.0)
    add(dr, bt(wipe), R.kick(True), 0.8)
    for k in range(wipe + 1, end):
        add(dr, bt(k), R.kick(), 0.45 if k < vb else 0.7)
        add(dr, bt(k + 0.5), R.hat(), 0.35)
        if k % 2 == 1:
            add(dr, bt(k), R.clap(), 0.45)
    for (a, b), cnt in ((TL['type1'], 12), (TL['type2'], 8)):
        for k in range(cnt):
            add(fx, bt(a) + k * (bt(b) - bt(a)) / cnt, R.tick(), 0.5)
    add(fx, bt(vb), R.bell(1318.5), 0.8); add(fx, bt(vb), R.crash(0.9), 0.4)
    add(mel, bt(vb), R.stab((523.25, 659.25, 783.99), 0.5), 0.9)
    for k in range(6):
        add(dr, bt(end - 1.75 + k * 0.25), R.snare(0.3 + k * 0.1))
    add(fx, bt(end - 1.5), R.riser(bt(TL['gap']) - bt(end - 1.5)), 0.8)
    # 마지막 강타 → 정지 엔드 카드
    add(fx, bt(end), R.boom(), 1.0); add(fx, bt(end), R.crash(), 0.9)
    add(mel, bt(end), R.stab(ch[0], 0.6), 1.2)
    for k in (end, end + 1, end + 2):
        add(dr, bt(k), R.kick(k in (end, end + 2)), 1.0)
    add(dr, bt(end + 1), R.clap(), 0.7)
    add(mel, bt(end + 1), R.stab(ch[2], 0.5), 0.8)
    add(mel, bt(end + 2), R.stab((440.0, 523.25, 659.25, 880.0), 2.0), 1.2)
    add(mel, bt(end + 2), R.bass(110.0, 1.6), 1.0)

    def silence(b0, b1):
        i, j = int(bt(b0) * SR), int(bt(b1) * SR)
        for arr in (dr, mel, fx):
            arr[i:j] *= np.linspace(1, 0, j - i) ** 6
    silence(st0 + 0.72, drop)
    silence(TL['gap'], end)
    duck = np.ones(N)
    for k in list(range(s2, wipe)) + [end, end + 1, end + 2]:
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
        ts = os.environ.get('T') or ','.join(f'{b * B + 0.3:.2f}' for b in range(BEATS))
        subprocess.run(r + [os.path.join(OUT, 'tvc-d.mp4'), '--stills', ts], check=True)
        return
    snd = os.path.join(OUT, 'music.wav')
    music(snd, TL)
    subprocess.run(r + [os.path.join(OUT, 'tvc-d.mp4'), '--음악', snd, '--sub', os.environ.get('SUB', '8'), '--dur', str(DUR)], check=True)


if __name__ == '__main__':
    main()
