# 15초 세로 광고 B안 v2 "장바구니 반전" (빠르고 화려한 모션 + 박자 맞춘 자작곡)
#   python3 tools/tvc/render_b.py            → content/2026-10-27-tvc-15s-b/publish/tvc-b.mp4
#   STILLS=1 python3 tools/tvc/render_b.py   → 정지 화면만(publish/stills/)
# 참고: 탄력 있게 튀어나오는 도형·원형 화면 전환·짓눌렸다 튀는 움직임 + 박자마다 글자가 박히는 키네틱 타이포.
# 곡: 128 BPM(한 박 0.46875초), 15초 = 정확히 32박(8마디). 모든 장면 전환·충돌이 박자 위에 있어요. 곡은 이 파일이 직접 만들어요(저작권 없음).
# 금액 숫자 없음(막대 높이로만 비교). 브랜드 주황 #D23A10 + 남색 #1F2E57, 노랑 없음.
import math, os, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTDIR = os.path.join(ROOT, 'content/2026-10-27-tvc-15s-b/publish')
FONT = os.path.join(ROOT, 'tools/cards/fonts/PretendardVariable.ttf')
W, H, FPS, DUR = 1080, 1920, 30, 15.0
B = 60 / 128
def bt(n):
    return n * B

ORANGE, NAVY, INK = (210, 58, 16), (31, 46, 87), (22, 24, 29)
BG = (251, 247, 243)
WHITE = (255, 255, 255)
GRAY = (138, 143, 153)
SALMON = (255, 199, 166)
BLUE, GREEN, MEH = (47, 95, 208), (14, 124, 74), (138, 90, 0)
SEG = [  # 이름, 높이, 색, 글자색, 닿는 박
    ('상품가', 300, ORANGE, WHITE, None),
    ('배송비', 120, (232, 106, 64), WHITE, 5),
    ('관세', 95, (242, 146, 112), NAVY, 7),
    ('부가세', 85, (248, 184, 158), NAVY, 9),
]
DOM_H = 520
BASE, LX, RX, BW = 1330, 330, 750, 230
LINE_Y = BASE - DOM_H
OVER_TOP = BASE - sum(s[1] for s in SEG)

# ---------- 공용 ----------
_fc = {}
def font(size, weight=700):
    k = (size, weight)
    if k not in _fc:
        f = ImageFont.truetype(FONT, size)
        try:
            f.set_variation_by_axes([weight])
        except Exception:
            pass
        _fc[k] = f
    return _fc[k]

def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))

def prog(t, a, b):
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)

def out_cubic(x):
    return 1 - (1 - x) ** 3

def in_quad(x):
    return x * x

def out_back(x, s=1.9):
    x -= 1
    return x * x * ((s + 1) * x + s) + 1

def out_elastic(x):
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    return 2 ** (-10 * x) * math.sin((x * 10 - 0.75) * (2 * math.pi / 3)) + 1

def mix(c1, c2, a):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * a) for i in range(3))

_tc = {}
def tlayer(s, size, weight, fill):
    k = (s, size, weight, fill)
    if k not in _tc:
        f = font(size, weight)
        asc, desc = f.getmetrics()
        w = int(f.getlength(s)) + 24
        im = Image.new('RGBA', (w, asc + desc + 24), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((12, 12), s, font=f, fill=fill + (255,))
        _tc[k] = im
    return _tc[k]

def put(img, L, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if scale <= 0.02 or alpha <= 0.01:
        return
    if rot:
        L = L.rotate(rot, resample=Image.BICUBIC, expand=True)
    if abs(scale - 1) > 0.005:
        L = L.resize((max(1, int(L.width * scale)), max(1, int(L.height * scale))), Image.BILINEAR)
    if alpha < 0.99:
        L = L.copy()
        L.putalpha(L.getchannel('A').point(lambda v: int(v * alpha)))
    img.paste(L, (int(cx - L.width / 2), int(cy - L.height / 2)), L)

def word_pop(img, s, cx, cy, size, weight, fill, t, t0, t_out=None, rot=0):
    """박자에 쾅 박히는 글자: 크게 → 살짝 작게 → 제자리. 나갈 땐 위로 빠짐."""
    if t < t0:
        return
    p = prog(t, t0, t0 + 0.2)
    sc = 1 + 0.9 * (1 - out_back(p, 2.4))
    a = clamp(p * 3)
    dy = 50 * (1 - out_cubic(p))
    r = rot * (1 - out_cubic(p))
    if t_out is not None and t > t_out - 0.12:
        q = prog(t, t_out - 0.12, t_out)
        sc *= 1 - 0.4 * q
        a *= 1 - q
        dy -= 60 * q
    put(img, tlayer(s, size, weight, fill), cx, cy + dy, sc, a, r)

def kline(img, t, words, y, size, weight=850, color=INK, t_out=None, gap=None):
    """words: [(글자, 시각, 색 또는 None)] 한 줄을 가운데 정렬해 단어마다 박자에 박기."""
    f = font(size, weight)
    sp = gap if gap is not None else f.getlength(' ')
    ws = [f.getlength(w[0]) for w in words]
    total = sum(ws) + sp * (len(words) - 1)
    x = W / 2 - total / 2
    for (s, t0, c), wdt in zip(words, ws):
        word_pop(img, s, x + wdt / 2, y, size, weight, c or color, t, t0, t_out, rot=-8)
        x += wdt + sp

def burst(d, cx, cy, t, t0, col, n=12, r0=60, r1=240, dur=0.35, w=12, rot0=0.0):
    p = prog(t, t0, t0 + dur)
    if p <= 0 or p >= 1:
        return
    rb = r0 + (r1 - r0) * out_cubic(p)
    ra = r0 + (r1 - r0) * out_cubic(clamp(p * 1.7 - 0.7))
    ww = max(2, int(w * (1 - p)))
    for i in range(n):
        a = rot0 + 2 * math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        d.line([cx + c * ra, cy + s * ra, cx + c * rb, cy + s * rb], fill=col, width=ww)

def ring(d, cx, cy, t, t0, col, r0=30, r1=280, dur=0.45, w=16):
    p = prog(t, t0, t0 + dur)
    if p <= 0 or p >= 1:
        return
    r = r0 + (r1 - r0) * out_cubic(p)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=max(1, int(w * (1 - p))))

def confetti(d, cx, cy, t, t0, seed, n=26, dur=1.0, cols=(ORANGE, NAVY, BLUE, SALMON)):
    tt = t - t0
    if tt <= 0 or tt >= dur:
        return
    p = tt / dur
    rng = np.random.default_rng(seed)
    for i in range(n):
        ang = rng.uniform(0, 2 * math.pi)
        sp = rng.uniform(600, 1300)
        kind = int(rng.integers(0, 3))
        size = rng.uniform(12, 24) * (1 - 0.6 * p)
        rot = rng.uniform(0, 6) + tt * rng.uniform(5, 12)
        k = (1 - math.exp(-tt * 4)) / 4
        x = cx + math.cos(ang) * sp * k
        y = cy + math.sin(ang) * sp * k + 1400 * tt * tt
        col = cols[i % len(cols)]
        if kind == 0:
            d.ellipse([x - size / 2, y - size / 2, x + size / 2, y + size / 2], fill=col)
        else:
            m = 4 if kind == 1 else 3
            pts = [(x + size * 0.7 * math.cos(rot + 2 * math.pi * j / m), y + size * 0.7 * math.sin(rot + 2 * math.pi * j / m)) for j in range(m)]
            d.polygon(pts, fill=col)

def _dot_bg(base, dot):
    im = Image.new('RGB', (W + 72, H + 72), base)
    d = ImageDraw.Draw(im)
    for yi, y in enumerate(range(0, H + 72, 72)):
        for x in range(0 if yi % 2 == 0 else 36, W + 72, 72):
            d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=dot)
    return im
DOTS_LIGHT = _dot_bg(BG, (238, 228, 219))
DOTS_NAVY = _dot_bg(NAVY, (44, 61, 108))
DOTS_ORANGE = _dot_bg(ORANGE, (222, 80, 38))
def bg(dots, t):
    o = int((t * 60) % 72)
    return dots.crop((o, o, o + W, o + H))

def parcel(img, cx, cy, sx, sy):
    if sx <= 0.02 or sy <= 0.02:
        return
    w, h = int(200 * sx), int(158 * sy)
    d = ImageDraw.Draw(img)
    x0, y0 = cx - w // 2, cy + 79 - h  # 바닥 기준
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=max(2, int(18 * min(sx, sy))), fill=(236, 214, 190))
    d.rectangle([x0 + 3, y0 + 3, x0 + w - 3, y0 + int(h * 0.3)], fill=(222, 194, 164))
    tw = max(2, int(38 * sx))
    d.rectangle([cx - tw // 2, y0, cx + tw // 2, y0 + h], fill=ORANGE)
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=max(2, int(18 * min(sx, sy))), outline=(170, 128, 92), width=max(2, int(5 * min(sx, sy))))

def dashed(d, x0, x1, y, col, dash=22, gap=14, width=6, phase=0):
    x = x0 - phase
    while x < x1:
        a = max(x, x0)
        b = min(x + dash, x1)
        if b > a:
            d.line([a, y, b, y], fill=col, width=width)
        x += dash + gap

def squash(t, land, k=0.24):
    """닿은 뒤 짓눌렸다 튀는 비율(sx, sy). 떨어지는 중엔 길쭉하게."""
    dt = t - land
    if dt < 0:
        return 0.9, 1.14
    if dt > 0.45:
        return 1.0, 1.0
    dmp = math.exp(-dt * 11) * math.cos(dt * 32)
    return 1 + 0.6 * k * dmp, 1 - k * dmp

def stamp_img(size=340):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([8, 8, size - 8, size - 8], fill=(255, 255, 255, 250), outline=BLUE + (255,), width=16)
    d.ellipse([36, 36, size - 36, size - 36], outline=BLUE + (255,), width=5)
    d.text((size // 2, size // 2 - 36), '국내가', font=font(68, 900), fill=BLUE + (255,), anchor='mm')
    d.text((size // 2, size // 2 + 42), '나음', font=font(68, 900), fill=BLUE + (255,), anchor='mm')
    return im.rotate(14, resample=Image.BICUBIC, expand=True)
STAMP = stamp_img()

# ---------- 장면 1: 막대 쌓기 (0박~16박) ----------
def scene_bars(t):
    img = bg(DOTS_LIGHT, t)
    d = ImageDraw.Draw(img)
    # 자막(박마다 단어)
    kline(img, t, [('직구가', bt(0.5), None), ('더', bt(1), None), ('싸', bt(1.5), ORANGE), ('보이죠?', bt(2), None)], 380, 82, t_out=bt(4))
    if bt(4) <= t < bt(6.5):
        kline(img, t, [('배송비', bt(4), ORANGE), ('더하고', bt(4.5), None)], 380, 82, t_out=bt(6.5))
    if bt(6.5) <= t < bt(10):
        kline(img, t, [('관세,', bt(6.5), ORANGE), ('부가세까지', bt(8.5), ORANGE)], 380, 82, t_out=bt(10))
    if bt(10) <= t < bt(12):
        kline(img, t, [('다', bt(10), None), ('더해서', bt(10.5), None)], 380, 82, t_out=bt(12))
    if bt(12) <= t < bt(14):
        word_pop(img, '한눈에', W / 2, 380, 104, 900, ORANGE, t, bt(12), bt(14), rot=-8)
    if t >= bt(14):
        kline(img, t, [('이번엔', bt(14), None), ('국내가', bt(14.5), BLUE), ('나아요', bt(15), None)], 380, 82)
    # 상자: 0.5박, 1박에 통통
    for cx, t0 in ((LX, bt(0.5)), (RX, bt(1))):
        p = prog(t, t0, t0 + 0.45)
        e = out_elastic(p)
        sq = 1 + 0.25 * math.exp(-p * 6) * math.sin(p * 20) if p > 0 else 0
        parcel(img, cx, 520, e * (2 - sq) / 1, e * sq)
    # 바닥·이름
    gp = out_cubic(prog(t, bt(1), bt(2)))
    d.line([W / 2 - 400 * gp, BASE, W / 2 + 400 * gp, BASE], fill=(205, 198, 191), width=5)
    word_pop(img, '국내 최저가', LX, BASE + 56, 44, 800, NAVY, t, bt(1.5))
    word_pop(img, '해외직구', RX, BASE + 56, 44, 800, ORANGE, t, bt(2))
    # 막대: 1박에 쭉
    gr = out_back(prog(t, bt(1), bt(1) + 0.4), 2.6)
    dh = int(DOM_H * gr)
    if dh > 4:
        d.rounded_rectangle([LX - BW // 2, BASE - dh, LX + BW // 2, BASE], radius=20, fill=NAVY)
    # 국내 높이 점선: 6박부터 흐르는 점선
    la = prog(t, bt(6), bt(6.5))
    crossed = t >= bt(9)
    if la > 0:
        col = mix(BG, BLUE if crossed else NAVY, la * (0.9 if crossed else 0.55))
        dashed(d, 140, 940, LINE_Y, col, phase=(t * 80) % 36, width=7 if crossed else 6)
    # 해외 막대 조각
    y = BASE
    for i, (name, h, col, tcol, land_b) in enumerate(SEG):
        x0c = RX
        if land_b is None:
            g2 = out_back(prog(t, bt(1.5), bt(1.5) + 0.4), 2.6)
            hh = int(h * g2)
            if hh <= 4:
                break
            top = y - hh
            sx, sy = 1.0, 1.0
            draw_h = hh
        else:
            land = bt(land_b)
            start = land - 0.22
            if t < start:
                break
            p = prog(t, start, land)
            sx, sy = squash(t, land)
            draw_h = int(h * sy)
            target = y - h
            top = int(-260 + (target + 260) * in_quad(p)) if p < 1 else y - draw_h
            hh = h
        ww = int(BW * sx)
        r = 20 if i in (0, len(SEG) - 1) else 8
        d.rounded_rectangle([x0c - ww // 2, top, x0c + ww // 2, top + draw_h], radius=r, fill=col)
        if i > 0:
            d.line([x0c - ww // 2 + 8, top + draw_h, x0c + ww // 2 - 8, top + draw_h], fill=BG, width=5)
        if draw_h >= 60:
            put(img, tlayer(name, 40, 850, tcol), x0c, top + draw_h / 2, 1.0)
        y -= hh
    # 닿을 때 방사선
    for _, _, col, _, lb in SEG[1:]:
        if lb:
            burst(d, RX, BASE - sum(s[1] for s in SEG[:[x[4] for x in SEG].index(lb) + 1]), t, bt(lb), ORANGE, n=10, r0=150, r1=260, w=10)
    # 9박: 선을 넘는 순간
    if crossed:
        ring(d, RX, LINE_Y, t, bt(9), BLUE, r1=300)
        burst(d, RX + 150, LINE_Y, t, bt(9), BLUE, n=8, r0=20, r1=110, w=8)
        burst(d, RX - 150, LINE_Y, t, bt(9), BLUE, n=8, r0=20, r1=110, w=8, rot0=0.4)
    # 12박: 넘친 부분 + 알약
    hp = prog(t, bt(12), bt(12) + 0.3)
    if hp > 0:
        e = out_back(hp, 2.2)
        pad = 14 * e
        d.rounded_rectangle([RX - BW // 2 - pad, OVER_TOP - pad, RX + BW // 2 + pad, LINE_Y + 2], radius=22,
                            outline=BLUE, width=max(2, int(8 * clamp(e))))
        pw, ph = int(340 * e), int(84 * e)
        cy = OVER_TOP - 80
        if pw > 20:
            d.rounded_rectangle([RX - pw // 2, cy - ph // 2, RX + pw // 2, cy + ph // 2], radius=max(1, ph // 2), fill=BLUE)
            put(img, tlayer('국내보다 비싸요', 38, 850, WHITE), RX, cy, clamp(e))
        burst(d, RX, cy, t, bt(12), BLUE, n=10, r0=180, r1=260, w=8)
    # 14박: 도장 쾅
    if t >= bt(14) - 0.1:
        p = prog(t, bt(14) - 0.1, bt(14))
        sc = 2.4 - 1.4 * in_quad(p)
        if t > bt(14):
            sc *= 1 - 0.06 * math.exp(-(t - bt(14)) * 10) * math.cos((t - bt(14)) * 30)
        put(img, STAMP, LX, 1010, sc, clamp(p * 2))
        ring(d, LX, 1010, t, bt(14), BLUE, r0=170, r1=420, w=18)
        burst(d, LX, 1010, t, bt(14), BLUE, n=14, r0=200, r1=330, w=12)
        confetti(d, LX, 1010, t, bt(14), 3)
    return img

# ---------- 장면 2: 사용법 (16박~24박) ----------
def scene_how(t):
    img = bg(DOTS_LIGHT, t)
    d = ImageDraw.Draw(img)
    kline(img, t, [('국내', bt(16.5), None), ('최저가만', bt(17), ORANGE), ('넣으면', bt(17.5), None)], 320, 70)
    word_pop(img, '바로 판정', W / 2, 450, 122, 900, ORANGE, t, bt(18), rot=-10)
    burst(d, W / 2, 450, t, bt(18), ORANGE, n=14, r0=260, r1=380, w=10)
    # 카드: 18.5박에 아래에서 튕겨 올라옴
    cp = out_back(prog(t, bt(18.5), bt(18.5) + 0.38), 1.6)
    if cp > 0:
        off = int(700 * (1 - cp))
        cx0, cy0, cx1, cy1 = 100, 590 + off, 980, 1210 + off
        d.rounded_rectangle([cx0 + 10, cy0 + 22, cx1 + 10, cy1 + 22], radius=44, fill=(232, 222, 212))
        d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=44, fill=WHITE, outline=NAVY, width=5)
        rows = [(bt(19.5), '상품 링크·이름', '붙여넣기 완료', '가격·관부가세 자동'),
                (bt(20.5), '국내 최저가', '○○,○○○원', '이것만 넣으면 돼요')]
        y = cy0 + 70
        for at, label, val, hint in rows:
            p = prog(t, at - 0.1, at)
            d.text((cx0 + 60, y), label, font=font(32, 700), fill=GRAY, anchor='lm')
            fy = y + 40
            focus = at - 0.1 <= t < at + 0.5
            d.rounded_rectangle([cx0 + 48, fy, cx1 - 48, fy + 100], radius=24, outline=ORANGE if focus else (226, 221, 216), width=6 if focus else 4)
            n = int(len(val) * prog(t, at, at + 0.22))
            if n > 0:
                d.text((cx0 + 84, fy + 50), val[:n], font=font(42, 850), fill=INK, anchor='lm')
            if t >= at + 0.22:
                put(img, tlayer(hint, 28, 750, ORANGE), cx1 - 84 - tlayer(hint, 28, 750, ORANGE).width / 2 + 12, fy + 50, out_back(prog(t, at + 0.22, at + 0.45)))
            y = fy + 156
        ry = y + 46
        lights = [('직구각', GREEN), ('애매', MEH), ('국내가 나음', BLUE)]
        for i, (nm, col) in enumerate(lights):
            lx = cx0 + 160 + i * 280
            t0 = bt(21.5) + i * 0.07
            on = i == 2
            e = out_elastic(prog(t, t0, t0 + 0.5))
            r = (50 if on else 34) * e
            c = col if on else mix(WHITE, col, 0.28)
            if r > 1:
                d.ellipse([lx - r, ry - r, lx + r, ry + r], fill=c)
                put(img, tlayer(nm, 32, 850 if on else 600, col if on else GRAY), lx, ry + 84, clamp(e))
            if on:
                ring(d, lx, ry, t, t0 + 0.05, BLUE, r0=50, r1=170, w=10)
                burst(d, lx, ry, t, t0 + 0.05, BLUE, n=10, r0=70, r1=150, w=8)
    # 22.5박: 같은 모델 확인
    p2 = prog(t, bt(22.5), bt(22.5) + 0.3)
    if p2 > 0:
        e = out_back(p2)
        x = 140 + int(-500 * (1 - out_cubic(p2)))
        d.ellipse([x + 160 - 28 * e, 1330 - 28 * e, x + 160 + 28 * e, 1330 + 28 * e], fill=NAVY)
        if e > 0.5:
            d.line([x + 146, 1330, x + 156, 1341, x + 175, 1318], fill=WHITE, width=6, joint='curve')
        d.text((x + 206, 1330), '같은 모델인지도 확인해요', font=font(42, 850), fill=NAVY, anchor='lm')
    return img

# ---------- 장면 3: 약속 (24박~28박) ----------
def scene_promise(t):
    img = bg(DOTS_NAVY, t)
    d = ImageDraw.Draw(img)
    for i, (x, y, r) in enumerate(((170, 600, 70), (920, 760, 46), (210, 1270, 40), (880, 1350, 80))):
        e = out_elastic(prog(t, bt(24.25) + i * 0.08, bt(24.25) + i * 0.08 + 0.6))
        yy = y + 18 * math.sin(t * 3 + i)
        rr = r * e
        if rr > 2:
            d.ellipse([x - rr, yy - rr, x + rr, yy + rr], outline=ORANGE if i % 2 == 0 else SALMON, width=10)
    kline(img, t, [('국내가', bt(24.5), WHITE), ('나으면', bt(25), WHITE)], 860, 92)
    kline(img, t, [('국내가', bt(25.5), SALMON), ('낫다고', bt(26), WHITE), ('해요', bt(26.5), WHITE)], 990, 92)
    lw = int(320 * out_cubic(prog(t, bt(27), bt(27.5))))
    if lw > 0:
        d.rounded_rectangle([W // 2 - lw // 2, 1080, W // 2 + lw // 2, 1094], radius=7, fill=ORANGE)
    return img

# ---------- 장면 4: 엔드 (28박~32박) ----------
def scene_end(t):
    img = bg(DOTS_ORANGE, t)
    d = ImageDraw.Draw(img)
    cx, cy, k = W // 2, 660, 300 / 522
    X = lambda u: cx - 150 + u * k
    Y = lambda v: cy - 150 + v * k
    hp = out_cubic(prog(t, bt(28), bt(28) + 0.22))
    if hp > 0:
        x1 = 20 + (502 - 20) * hp
        d.rounded_rectangle([X(20), Y(20), X(max(97, x1)), Y(97)], radius=int(38 * k), fill=WHITE)
    vp = out_cubic(prog(t, bt(28.5), bt(28.5) + 0.22))
    if vp > 0:
        y1 = 20 + (502 - 20) * vp
        d.rounded_rectangle([X(425), Y(20), X(502), Y(max(97, y1))], radius=int(38 * k), fill=WHITE)
    sp = out_elastic(prog(t, bt(29), bt(29) + 0.6))
    if sp > 0.02:
        mx, my, hs = X(154), Y(386), 96 * k * sp
        d.rounded_rectangle([mx - hs, my - hs, mx + hs, my + hs], radius=max(1, int(40 * k * sp)), fill=NAVY)
    ring(d, cx, cy, t, bt(28), WHITE, r0=120, r1=420, w=14)
    word_pop(img, '직구각', W / 2, 960, 150, 900, WHITE, t, bt(29.5), rot=-6)
    burst(d, W / 2, 960, t, bt(29.5), WHITE, n=14, r0=250, r1=360, w=10)
    confetti(d, W / 2, 960, t, bt(29.5), 9, cols=(WHITE, NAVY, SALMON))
    word_pop(img, '싸 보이는 곳 말고, 진짜 싼 곳', W / 2, 1110, 58, 850, WHITE, t, bt(30.25))
    up = out_back(prog(t, bt(31), bt(31) + 0.35))
    if up > 0:
        pw, ph = int(520 * up), int(94 * up)
        d.rounded_rectangle([W // 2 - pw // 2, 1245 - ph // 2, W // 2 + pw // 2, 1245 + ph // 2], radius=max(1, ph // 2), fill=NAVY)
        put(img, tlayer('www.jikgugak.com', 42, 850, WHITE), W / 2, 1245, clamp(up))
    return img

# ---------- 화면 전환·카메라 ----------
def circle_mask(cx, cy, r):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    return m

def slant_mask(edge):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([(edge + 260, 0), (W + 400, 0), (W + 400, H), (edge - 260, H)], fill=255)
    return m

KICKS = [bt(n) for n in range(0, 24)] + [bt(n) for n in range(28, 32)]
HITS = {bt(5): 0.05, bt(7): 0.045, bt(9): 0.055, bt(14): 0.07, bt(16): 0.05, bt(18): 0.04, bt(28): 0.05, bt(29.5): 0.05}
SHAKES = {bt(5): 16, bt(7): 12, bt(9): 14, bt(14): 24, bt(29.5): 10}

def zoom_amt(t):
    z = 0.0
    for k in KICKS:
        if k <= t < k + 0.35:
            z = max(z, 0.018 * math.exp(-(t - k) * 12))
    for k, a in HITS.items():
        if k <= t < k + 0.4:
            z = max(z, a * math.exp(-(t - k) * 9))
    return 1 + z

def shake(t):
    for k, a in SHAKES.items():
        if k <= t < k + 0.22:
            amp = a * (1 - (t - k) / 0.22)
            return int(amp * math.sin((t - k) * 95)), int(amp * 0.7 * math.cos((t - k) * 81))
    return 0, 0

def frame(t):
    if t < 0.28:  # 시작: 주황 화면에서 동그랗게 열림
        img = Image.new('RGB', (W, H), ORANGE)
        r = 2300 * out_cubic(prog(t, 0.0, 0.28))
        img.paste(scene_bars(t), (0, 0), circle_mask(W / 2, H / 2, r))
    elif t < bt(16) - 0.1:
        img = scene_bars(t)
    elif t < bt(16) + 0.08:  # 도장 자리에서 주황 원이 터지며 덮음
        img = scene_bars(min(t, bt(16) - 0.11))
        r = 2400 * in_quad(prog(t, bt(16) - 0.1, bt(16) + 0.08))
        img.paste(Image.new('RGB', (W, H), ORANGE), (0, 0), circle_mask(LX, 1010, r))
    elif t < bt(16) + 0.34:  # 주황 위로 밝은 원이 열리며 다음 장면
        img = Image.new('RGB', (W, H), ORANGE)
        r = 2300 * out_cubic(prog(t, bt(16) + 0.08, bt(16) + 0.34))
        img.paste(scene_how(t), (0, 0), circle_mask(W / 2, 450, r))
    elif t < bt(24) - 0.1:
        img = scene_how(t)
    elif t < bt(24) + 0.12:  # 남색이 사선으로 밀고 들어옴
        img = scene_how(t)
        edge = W + 300 - (W + 900) * out_cubic(prog(t, bt(24) - 0.1, bt(24) + 0.12))
        img.paste(scene_promise(t), (0, 0), slant_mask(edge))
    elif t < bt(28) - 0.08:
        img = scene_promise(t)
    elif t < bt(28) + 0.14:  # 주황 원
        img = scene_promise(t)
        r = 2300 * out_cubic(prog(t, bt(28) - 0.08, bt(28) + 0.14))
        img.paste(scene_end(t), (0, 0), circle_mask(W / 2, 660, r))
    else:
        img = scene_end(t)
    z = zoom_amt(t)
    if z > 1.001:
        w, h = W / z, H / z
        img = img.crop((int((W - w) / 2), int((H - h) / 2), int((W + w) / 2), int((H + h) / 2))).resize((W, H), Image.BILINEAR)
    dx, dy = shake(t)
    if dx or dy:
        moved = Image.new('RGB', (W, H), img.getpixel((5, 5)))
        moved.paste(img, (dx, dy))
        img = moved
    return img

# ---------- 곡(128 BPM, 32박) ----------
SR = 44100
N = int(SR * DUR)
RNG = np.random.default_rng(11)

def sos(kind, f):
    return butter(4, f, btype=kind, fs=SR, output='sos')

def tarr(sec):
    return np.arange(int(sec * SR)) / SR

def add(buf, at, sig, g=1.0):
    i = int(at * SR)
    if i >= N or i < 0:
        return
    j = min(N, i + len(sig))
    buf[i:j] += g * sig[: j - i]

def kick(big=False):
    tt = tarr(0.42 if big else 0.3)
    f = 42 + (130 if big else 115) * np.exp(-tt * 28)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * (6 if big else 9))
    s += RNG.standard_normal(len(tt)) * np.exp(-tt * 260) * 0.25
    return np.tanh(s * 1.6)

def snare(g=1.0):
    tt = tarr(0.22)
    nz = sosfilt(sos('bandpass', [1400, 7000]), RNG.standard_normal(len(tt))) * np.exp(-tt * 20)
    tone = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 30) * 0.5
    return (nz * 1.4 + tone) * g

def clap():
    tt = tarr(0.25)
    nz = sosfilt(sos('bandpass', [900, 3500]), RNG.standard_normal(len(tt)))
    env = np.zeros(len(tt))
    for off in (0, 0.011, 0.022):
        e = np.exp(-np.clip(tt - off, 0, None) * (90 if off < 0.02 else 16)) * (tt >= off)
        env = np.maximum(env, e)
    return nz * env * 1.6

def hat(open_=False):
    tt = tarr(0.22 if open_ else 0.045)
    return sosfilt(sos('highpass', 7500), RNG.standard_normal(len(tt))) * np.exp(-tt * (14 if open_ else 80)) * 0.5

def saw(freq, tt, nh=14):
    return sum(np.sin(2 * np.pi * freq * k * tt) / k for k in range(1, nh + 1))

def bass(freq, dur):
    tt = tarr(dur)
    s = sosfilt(sos('lowpass', 700), saw(freq, tt, 10)) + 0.6 * np.sin(2 * np.pi * freq / 2 * tt)
    env = np.minimum(1, tt / 0.004) * np.exp(-tt * 5)
    return s * env * 0.55

def pluck(freq, dur=0.25):
    tt = tarr(dur)
    s = sosfilt(sos('lowpass', 3800), saw(freq, tt, 9)) * np.exp(-tt * 14)
    return s * 0.28

def stab(freqs, dur=0.5):
    tt = tarr(dur)
    s = sum(sosfilt(sos('lowpass', 2600), saw(f, tt, 10) + saw(f * 1.006, tt, 10)) for f in freqs)
    return s * np.exp(-tt * 6) * 0.12

def pad(freqs, dur):
    tt = tarr(dur)
    s = sum(np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 1.004 * tt) + 0.25 * np.sin(2 * np.pi * f * 2 * tt) for f in freqs)
    env = np.minimum(1, tt / 0.25) * np.minimum(1, (dur - tt) / 0.2)
    return s * env * 0.07

def crash(dur=1.6):
    tt = tarr(dur)
    return sosfilt(sos('highpass', 4500), RNG.standard_normal(len(tt))) * np.exp(-tt * 2.6) * 0.45

def riser(dur):
    tt = tarr(dur)
    x = tt / dur
    nz = sosfilt(sos('highpass', 1800), RNG.standard_normal(len(tt))) * x ** 2 * 0.5
    sw = np.sin(2 * np.pi * np.cumsum(220 + 1300 * x ** 2) / SR) * x ** 2 * 0.12
    return nz + sw

def whoosh(dur=0.32):
    tt = tarr(dur)
    nz = sosfilt(sos('bandpass', [400, 5000]), RNG.standard_normal(len(tt)))
    return nz * np.sin(np.pi * tt / dur) ** 2 * 0.55

def thud():
    tt = tarr(0.3)
    s = np.sin(2 * np.pi * np.cumsum(55 + 160 * np.exp(-tt * 22)) / SR) * np.exp(-tt * 12)
    s += sosfilt(sos('lowpass', 1800), RNG.standard_normal(len(tt))) * np.exp(-tt * 40) * 0.5
    return np.tanh(s * 1.4)

def boom():
    tt = tarr(0.8)
    s = np.sin(2 * np.pi * np.cumsum(38 + 120 * np.exp(-tt * 14)) / SR) * np.exp(-tt * 4.5)
    s += sosfilt(sos('lowpass', 2500), RNG.standard_normal(len(tt))) * np.exp(-tt * 18) * 0.6
    return np.tanh(s * 1.5)

def bell(f):
    tt = tarr(0.7)
    return (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 6)) * np.exp(-tt * 5) * 0.25

def tick():
    tt = tarr(0.05)
    return np.sin(2 * np.pi * 1500 * tt) * np.exp(-tt * 80) * 0.35

ROOTS = [110.0, 87.31, 130.81, 98.0]  # Am F C G
CHORDS = [(440.0, 523.25, 659.25), (349.23, 440.0, 523.25), (523.25, 659.25, 783.99), (392.0, 493.88, 587.33)]

def music(path):
    drums, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    # 0~4박 훅: 박마다 킥 + 화음 찌르기
    for n in range(4):
        add(drums, bt(n), kick(), 0.9 if n else 1.0)
        add(mel, bt(n), stab(CHORDS[0], 0.35), 0.8 if n else 1.0)
    add(drums, bt(3.5), snare(0.6))
    add(fx, 0.0, crash(1.2), 0.6)
    # 4~16박 쌓기, 16~24박 본 비트, 28~32박 엔드
    for n in list(range(4, 14)) + list(range(16, 24)) + list(range(28, 32)):
        add(drums, bt(n), kick(n in (16, 28)), 1.0)
    for n in list(range(5, 12, 2)) + list(range(17, 24, 2)) + [29, 31]:
        add(drums, bt(n), clap(), 0.7)
    for n in range(4, 24):
        add(drums, bt(n + 0.5), hat(), 0.8)
        if n >= 16:
            add(drums, bt(n + 0.25), hat(), 0.45)
            add(drums, bt(n + 0.75), hat(), 0.45)
    for n in (8, 12, 20):
        add(drums, bt(n), hat(True), 0.7)
    # 12~16박 쌓이는 스네어 + 상승음, 15.75박 잠깐 멈춤
    for k in range(8):
        add(drums, bt(12 + k * 0.25), snare(0.25 + k * 0.03))
    for k in range(6):
        add(drums, bt(14 + k * 0.25), snare(0.5 + k * 0.06))
    add(fx, bt(13), riser(bt(15.75) - bt(13)), 0.9)
    # 베이스: 엇박 8분(펌핑)
    for n in list(range(4, 12)) + list(range(16, 24)) + list(range(28, 31)):
        root = ROOTS[(n // 4) % 4]
        add(mel, bt(n + 0.5), bass(root, B * 0.45))
        if n >= 16:
            add(mel, bt(n), bass(root, B * 0.3), 0.6)
    # 멜로디: 8~12박 8분 아르페지오, 16~24박 16분
    for n in range(8, 12):
        ch = CHORDS[(n // 4) % 4]
        for k in range(2):
            add(mel, bt(n + k * 0.5), pluck(ch[(n * 2 + k) % 3] / 2))
    for n in range(16, 24):
        ch = CHORDS[(n // 4) % 4]
        for k in range(4):
            add(mel, bt(n + k * 0.25), pluck(ch[(n * 4 + k) % 3] * (2 if k == 3 else 1)), 0.9)
    add(fx, bt(16), crash(), 0.8)
    # 24~28박 쉬는 구간: 패드 + 가벼운 하이햇, 27박 클랩·필
    add(mel, bt(24), pad(CHORDS[0], bt(4)), 1.0)
    for n in range(24, 28):
        add(drums, bt(n + 0.5), hat(), 0.4)
    add(drums, bt(27), clap(), 0.6)
    for k in range(4):
        add(drums, bt(27 + k * 0.25), snare(0.3 + k * 0.1))
    # 28박 마지막 한 방 + 31박 마무리 화음
    add(fx, bt(28), crash(), 0.8)
    add(mel, bt(28), stab(CHORDS[0], 0.6), 1.1)
    add(mel, bt(29.5), stab(CHORDS[1], 0.5), 0.9)
    add(mel, bt(31), stab((440.0, 523.25, 659.25, 880.0), 1.4), 1.2)
    add(mel, bt(31), bass(110.0, 1.2), 1.0)
    # 효과음: 화면과 같은 박
    for b in (5, 7, 9):
        add(fx, bt(b), thud(), 0.9)
    add(fx, bt(9), bell(1318.5), 0.6)
    add(fx, bt(12), bell(987.8), 0.4)
    add(fx, bt(14), boom(), 1.0)
    add(fx, bt(18), thud(), 0.5)
    for b in (19.5, 20.5):
        add(fx, bt(b), tick())
    add(fx, bt(21.64), bell(1760.0), 0.7)
    for at in (bt(16) - 0.12, bt(24) - 0.15, bt(28) - 0.12):
        add(fx, at, whoosh(), 0.8)
    # 쉬는 구간 앞(24박)엔 킥 대신 한 방
    add(drums, bt(24), kick(True), 0.7)
    # 사이드체인 느낌: 킥 박마다 멜로디를 살짝 눌러요
    duck = np.ones(N)
    for n in list(range(4, 24)) + list(range(28, 32)):
        i = int(bt(n) * SR)
        m = int(0.2 * SR)
        j = min(N, i + m)
        duck[i:j] = np.minimum(duck[i:j], 0.45 + 0.55 * (np.arange(j - i) / m))
    mixd = drums * 0.8 + mel * duck * 0.9 + fx * 0.8
    mixd = sosfilt(sos('highpass', 30), mixd)
    fade = np.ones(N)
    k = int(0.35 * SR)
    fade[-k:] = np.linspace(1, 0, k)
    mixd *= fade
    mixd = np.tanh(mixd * 1.1) / np.tanh(1.1)
    mixd = mixd / (np.max(np.abs(mixd)) + 1e-9) * 0.86
    # 오른쪽만 12ms 늦춘 멜로디로 넓게
    right = mixd.copy()
    dly = int(0.012 * SR)
    right[dly:] = mixd[dly:] * 0.85 + 0.15 * (mel * duck * 0.9)[:-dly] / (np.max(np.abs(mel)) + 1e-9) * 0.3
    st = np.stack([mixd, right], axis=1)
    st = st / (np.max(np.abs(st)) + 1e-9) * 0.75
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())

def main():
    os.makedirs(OUTDIR, exist_ok=True)
    if os.environ.get('STILLS'):
        sd = os.path.join(OUTDIR, 'stills'); os.makedirs(sd, exist_ok=True)
        for t in (0.14, 1.2, 2.4, 3.4, 4.3, 5.8, 6.62, 7.3, 7.55, 7.75, 8.4, 10.4, 11.27, 12.6, 13.2, 14.8):
            frame(t).save(os.path.join(sd, f'{t:05.2f}s.png'))
        print('정지 화면', sd)
        return
    snd = os.path.join(OUTDIR, 'music.wav')
    music(snd)
    out = os.path.join(OUTDIR, 'tvc-b.mp4')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', snd, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '192k', '-t', str(DUR), '-movflags', '+faststart', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(int(DUR * FPS)):
        p.stdin.write(frame(i / FPS).tobytes())
    p.stdin.close(); p.wait()
    os.remove(snd)
    print('광고', out, os.path.getsize(out) // 1024, 'KB')

if __name__ == '__main__':
    main()
