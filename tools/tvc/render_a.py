# 15초 세로 광고 A안 "탭 지옥 → 한 화면" (UI가 변신하는 모션그래픽 + 120 BPM 자작곡)
#   python3 tools/tvc/render_a.py            → content/2026-10-27-tvc-15s-a/publish/tvc-a.mp4
#   STILLS=1 python3 tools/tvc/render_a.py   → 정지 화면만(publish/stills/)
# 참고: 앱 화면이 모양을 바꾸며 이야기를 끄는 연출, 글자 중심 타이포, 120 BPM 마디 단위로 장면을 박자에 맞추기.
# 120 BPM(한 박 0.5초), 15초 = 30박. 금액 숫자 없음. 쇼핑몰 실제 이름·로고 없음. 공용 도구는 render_b.py에서 가져와요.
import math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_b as R

W, H, FPS, DUR = R.W, R.H, 30, 15.0
B = 0.5
def bt(n):
    return n * B

ORANGE, NAVY, INK, BG, WHITE, GRAY = R.ORANGE, R.NAVY, R.INK, R.BG, R.WHITE, R.GRAY
SALMON, BLUE, GREEN, MEH = R.SALMON, R.BLUE, R.GREEN, R.MEH
prog, clamp, out_back, out_cubic, out_elastic, in_quad, mix = R.prog, R.clamp, R.out_back, R.out_cubic, R.out_elastic, R.in_quad, R.mix
font, tlayer, put, word_pop, kline = R.font, R.tlayer, R.put, R.word_pop, R.kline
burst, ring, confetti = R.burst, R.ring, R.confetti
OUTDIR = os.path.join(R.ROOT, 'content/2026-10-27-tvc-15s-a/publish')

# ---------- 장면 1: 창 7개 난장판 (0~8박) ----------
TABS = [  # 제목, 종류, x, y, 기울기, 들어오는 박, 들어오는 방향
    ('국내 쇼핑몰', 'shop', 330, 770, -6, 0.5, (-1, 0)),
    ('해외 쇼핑몰', 'shop', 760, 880, 5, 1.0, (1, 0)),
    ('관세 계산법', 'search', 300, 1180, -9, 2.0, (-1, 1)),
    ('오늘 환율', 'search', 790, 700, 7, 3.0, (1, -1)),
    ('배송비 얼마?', 'shop', 560, 1010, -3, 4.0, (0, 1)),
    ('계산기', 'calc', 280, 720, -8, 5.0, (-1, -1)),
    ('같은 모델 맞나?', 'shop', 740, 1210, 6, 6.0, (1, 1)),
]

def window_layer(title, kind):
    w, h = 470, 330
    im = Image.new('RGBA', (w + 24, h + 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([14, 18, w + 14, h + 18], radius=26, fill=(31, 46, 87, 60))  # 그림자
    d.rounded_rectangle([4, 4, w + 4, h + 4], radius=26, fill=WHITE + (255,), outline=(205, 198, 191, 255), width=3)
    d.rounded_rectangle([4, 4, w + 4, 66], radius=26, fill=(240, 234, 228, 255))
    d.rectangle([4, 40, w + 4, 66], fill=(240, 234, 228, 255))
    for i, c in enumerate((ORANGE, NAVY, SALMON)):
        d.ellipse([26 + i * 28, 24, 44 + i * 28, 42], fill=c + (255,))
    d.text((122, 35), title, font=font(30, 800), fill=INK + (255,), anchor='lm')
    if kind == 'shop':
        d.rounded_rectangle([30, 92, 170, 232], radius=16, fill=(236, 214, 190, 255))
        d.rectangle([88, 92, 112, 232], fill=ORANGE + (255,))
        for j, ww in enumerate((240, 200, 150)):
            d.rounded_rectangle([196, 104 + j * 38, 196 + ww, 124 + j * 38], radius=10, fill=(226, 221, 216, 255))
        d.rounded_rectangle([30, 256, 250, 312], radius=28, fill=(255, 236, 226, 255))
        d.text((140, 284), '가격 ?', font=font(30, 850), fill=ORANGE + (255,), anchor='mm')
    elif kind == 'search':
        d.rounded_rectangle([30, 92, w - 22, 152], radius=30, outline=NAVY + (255,), width=4)
        d.ellipse([w - 80, 104, w - 46, 138], outline=NAVY + (255,), width=5)
        d.line([w - 52, 132, w - 38, 146], fill=NAVY + (255,), width=6)
        for j, ww in enumerate((380, 330, 400, 260)):
            d.rounded_rectangle([30, 182 + j * 36, 30 + ww, 200 + j * 36], radius=9, fill=(226, 221, 216, 255))
    else:  # 계산기
        d.rounded_rectangle([30, 86, w - 22, 146], radius=14, fill=(240, 234, 228, 255))
        d.text((w - 46, 116), '= ?', font=font(36, 850), fill=INK + (255,), anchor='rm')
        for r in range(3):
            for c in range(5):
                x0, y0 = 30 + c * 86, 164 + r * 54
                d.rounded_rectangle([x0, y0, x0 + 74, y0 + 44], radius=10, fill=(ORANGE if c == 4 else (226, 221, 216)) + (255,))
    return im

WIN = {t[0]: window_layer(t[0], t[1]) for t in TABS}
FLY_START, FLY_END = bt(7.75), bt(8.1)
PILL_Y = 650

def draw_tabs(img, t):
    d = ImageDraw.Draw(img)
    for i, (title, kind, x, y, rot, eb, (dx, dy)) in enumerate(TABS):
        t0 = bt(eb) - 0.12
        if t < t0:
            continue
        p = prog(t, t0, t0 + 0.3)
        e = out_back(p, 1.8)
        cx = x + dx * 900 * (1 - e)
        cy = y + dy * 900 * (1 - e)
        sc = 0.9 * (0.7 + 0.3 * e)
        r = rot + 25 * (1 - e) * (1 if dx >= 0 else -1)
        # 7박부터 정신없이 흔들림
        if t >= bt(7):
            k = prog(t, bt(7), bt(7.75))
            cx += 10 * k * math.sin(t * 47 + i * 2)
            cy += 8 * k * math.cos(t * 53 + i)
            r += 4 * k * math.sin(t * 39 + i)
        # 7.75박부터 입력창 자리로 빨려 들어감
        if t >= FLY_START:
            f = in_quad(prog(t, FLY_START + i * 0.015, FLY_END))
            cx += (540 - cx) * f
            cy += (PILL_Y - cy) * f
            sc *= 1 - 0.95 * f
            r += 220 * f * (1 if i % 2 else -1)
            if f >= 1:
                continue
        put(img, WIN[title], cx, cy, sc, 1.0, r)

def scene_chaos(t):
    img = R.bg(R.DOTS_LIGHT, t)
    d = ImageDraw.Draw(img)
    kline(img, t, [('이거', bt(0.5), None), ('직구가', bt(1), None), ('싸요?', bt(1.5), ORANGE)], 370, 84, t_out=bt(4))
    for s, b0, b1, c in (('검색하고,', 4, 5, None), ('계산하고,', 5, 6, ORANGE), ('또 검색하고', 6, 7, None), ('끝이 없죠?', 7, 7.85, ORANGE)):
        if bt(b0) <= t < bt(b1):
            word_pop(img, s, W / 2, 370, 90, 900, c or INK, t, bt(b0), bt(b1), rot=-8)
    draw_tabs(img, t)
    n = sum(1 for tb in TABS if t >= bt(tb[5]))
    if n and t < FLY_START + 0.1:
        last = max(bt(tb[5]) for tb in TABS if t >= bt(tb[5]))
        pp = prog(t, last, last + 0.25)
        sc = 1 + 0.35 * (1 - out_back(pp, 2.5))
        lay = tlayer(f'열린 창 {n}개', 40, 850, WHITE)
        pw, ph = (lay.width + 40) * sc, 76 * sc
        d.rounded_rectangle([W / 2 - pw / 2, 490 - ph / 2, W / 2 + pw / 2, 490 + ph / 2], radius=ph / 2, fill=ORANGE if n >= 5 else NAVY)
        put(img, lay, W / 2, 490, sc)
    return img

# ---------- 장면 2: 입력창 → 판정 카드 변신 (8~18박) ----------
CX0, CX1 = 110, 970
CARD_TOP = PILL_Y - 62
CARD_BOT = 1330

def link_icon(d, cx, cy, s, col):
    d.rounded_rectangle([cx - 30 * s, cy - 14 * s, cx + 2 * s, cy + 14 * s], radius=14 * s, outline=col, width=max(2, int(6 * s)))
    d.rounded_rectangle([cx - 2 * s, cy - 14 * s, cx + 30 * s, cy + 14 * s], radius=14 * s, outline=col, width=max(2, int(6 * s)))

def check(d, cx, cy, r, col=GREEN):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    if r > 10:
        d.line([cx - r * 0.45, cy, cx - r * 0.1, cy + r * 0.38, cx + r * 0.5, cy - r * 0.35], fill=WHITE, width=max(3, int(r * 0.24)), joint='curve')

def card_canvas(t):
    """카드 부분만 그린 화면(배경 투명)."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 8박: 점 → 가로로 쭉 늘어나는 입력창
    dp = prog(t, bt(8), bt(8) + 0.12)
    wp = out_elastic(prog(t, bt(8) + 0.08, bt(8) + 0.7))
    gp = out_back(prog(t, bt(10.5), bt(10.5) + 0.4), 1.4)  # 카드로 아래로 커짐
    if dp <= 0:
        return img
    half = 55 + (430 - 55) * wp
    top = PILL_Y - 55 - 7 * gp
    bot = PILL_Y + 55 + (CARD_BOT - PILL_Y - 55) * gp
    rad = 55 - 15 * gp
    if gp > 0:
        d.rounded_rectangle([540 - half + 10, top + 22, 540 + half + 10, bot + 22], radius=rad, fill=(232, 222, 212, 255))
    d.rounded_rectangle([540 - half, top, 540 + half, bot], radius=rad, fill=WHITE + (255,), outline=NAVY + (255,), width=6)
    if wp < 0.4:
        return img
    # 첫 줄: 링크 붙여넣기
    pasted = t >= bt(9.5)
    focus = bt(8.6) <= t < bt(10.5)
    if focus:
        d.rounded_rectangle([CX0 + 16, PILL_Y - 45, CX1 - 16, PILL_Y + 45], radius=45, outline=ORANGE + (255,), width=4)
    link_icon(d, CX0 + 80, PILL_Y, 1.0, ORANGE)
    if not pasted:
        d.text((CX0 + 140, PILL_Y), '상품 링크·이름 붙여넣기', font=font(38, 700), fill=GRAY + (255,), anchor='lm')
        if int(t * 4) % 2 == 0 and t > bt(8.6):
            d.rectangle([CX0 + 136, PILL_Y - 26, CX0 + 140, PILL_Y + 26], fill=ORANGE + (255,))
    else:
        fl = 1 - prog(t, bt(9.5), bt(9.5) + 0.25)
        if fl > 0:
            d.rounded_rectangle([CX0 + 16, PILL_Y - 45, CX1 - 16, PILL_Y + 45], radius=45, fill=mix(WHITE, SALMON, fl) + (255,))
        n = int(7 * prog(t, bt(9.5), bt(9.5) + 0.18)) + 1
        d.text((CX0 + 140, PILL_Y), '붙여넣기 완료'[:n], font=font(40, 850), fill=INK + (255,), anchor='lm')
        check(d, CX1 - 80, PILL_Y, 30 * out_elastic(prog(t, bt(9.75), bt(9.75) + 0.5)))
    if gp < 0.6:
        return img
    # 자동 계산 줄 3개
    for i, (label, b0) in enumerate((('해외 상품가', 11), ('배송비', 11.5), ('관세·부가세', 12))):
        p = prog(t, bt(b0) - 0.1, bt(b0) + 0.15)
        if p <= 0:
            continue
        y = 790 + i * 84
        x = CX0 + 60 + int(400 * (1 - out_cubic(p)))
        d.text((x, y), label, font=font(38, 800), fill=INK + (int(255 * clamp(p * 2)),), anchor='lm')
        e = out_back(prog(t, bt(b0), bt(b0) + 0.3))
        if e > 0:
            cw, ch = 220 * e, 56 * e
            cx = CX1 - 60 - 110
            d.rounded_rectangle([cx - cw / 2, y - ch / 2, cx + cw / 2, y + ch / 2], radius=ch / 2, fill=(255, 236, 226, 255))
            if e > 0.6:
                d.text((cx + 14, y), '자동 계산', font=font(30, 850), fill=ORANGE + (255,), anchor='mm')
                check(d, cx - 78, y, 15, ORANGE)
    if t >= bt(12.5):
        d.line([CX0 + 50, 1010, CX1 - 50, 1010], fill=(226, 221, 216, 255), width=3)
    # 국내 최저가 입력
    fp = prog(t, bt(13) - 0.1, bt(13) + 0.1)
    if fp > 0:
        d.text((CX0 + 60, 1052), '국내 최저가', font=font(32, 700), fill=GRAY + (255,), anchor='lm')
        foc = bt(13) <= t < bt(15)
        d.rounded_rectangle([CX0 + 48, 1080, CX1 - 48, 1172], radius=24, outline=(ORANGE if foc else (226, 221, 216)) + (255,), width=6 if foc else 4)
        n = int(9 * prog(t, bt(14), bt(14) + 0.25))
        if n:
            d.text((CX0 + 84, 1126), '○○,○○○원'[:n], font=font(42, 850), fill=INK + (255,), anchor='lm')
        elif int(t * 4) % 2 == 0:
            d.rectangle([CX0 + 82, 1102, CX0 + 86, 1150], fill=ORANGE + (255,))
        if n >= 9:
            d.text((CX1 - 84, 1126), '이것만 넣어요', font=font(28, 800), fill=ORANGE + (255,), anchor='rm')
    # 판정 칸: 15박 슬롯처럼 돌다가 16박에 '직구각'
    if t >= bt(15):
        y = 1255
        names = [('직구각', GREEN), ('애매', MEH), ('국내가 나음', BLUE)]
        if t < bt(16):
            idx = int((t - bt(15)) / 0.07) % 3
            nm, col = names[idx]
            sc = 1.0
        else:
            nm, col = names[0]
            sc = 1 + 0.35 * (1 - out_back(prog(t, bt(16), bt(16) + 0.3), 2.5))
        pw, ph = 420 * sc, 104 * sc
        d.rounded_rectangle([540 - pw / 2, y - ph / 2, 540 + pw / 2, y + ph / 2], radius=ph / 2, fill=col + (255,))
        lay = tlayer(nm, 50, 900, WHITE)
        put(img, lay, 540, y, sc)
    return img

def scene_card(t):
    img = R.bg(R.DOTS_LIGHT, t)
    d = ImageDraw.Draw(img)
    if t < bt(8.3):
        draw_tabs(img, t)
    if bt(8) <= t:
        ring(d, 540, PILL_Y, t, bt(8), ORANGE, r0=40, r1=520, w=20)
        burst(d, 540, PILL_Y, t, bt(8), ORANGE, n=16, r0=120, r1=420, w=14)
    if bt(8.5) <= t < bt(11):
        kline(img, t, [('링크', bt(8.5), ORANGE), ('붙여넣고', bt(9), None)], 380, 84, t_out=bt(11))
    if bt(11) <= t < bt(13):
        kline(img, t, [('관부가세는', bt(11), None), ('자동', bt(11.5), ORANGE)], 380, 84, t_out=bt(13))
    if bt(13) <= t < bt(15):
        kline(img, t, [('국내', bt(13), None), ('최저가만', bt(13.5), ORANGE), ('넣으면', bt(14), None)], 380, 78, t_out=bt(15))
    if t >= bt(15):
        word_pop(img, '바로 판정', W / 2, 380, 116, 900, ORANGE, t, bt(15), bt(18), rot=-10)
    card = card_canvas(t)
    # 18박부터 카드가 작아지며 아래로
    sp = out_back(prog(t, bt(18), bt(18) + 0.4), 1.5)
    if sp > 0:
        s = 1 - 0.35 * sp
        box = (CX0 - 20, CARD_TOP - 20, CX1 + 40, CARD_BOT + 50)
        part = card.crop(box)
        part = part.resize((int(part.width * s), int(part.height * s)), Image.BILINEAR)
        cy = 960 + (1110 - 960) * sp
        img.paste(part, (int(540 - part.width / 2), int(cy - part.height / 2)), part)
    else:
        img.paste(card, (0, 0), card)
    if bt(16) <= t:
        ring(d, 540, 1255, t, bt(16), GREEN, r0=60, r1=420, w=16)
        burst(d, 540, 1255, t, bt(16), GREEN, n=14, r0=240, r1=360, w=12)
        confetti(d, 540, 1255, t, bt(16), 5, cols=(GREEN, ORANGE, NAVY, SALMON))
    # 16.5박: 같은 모델 확인
    p2 = prog(t, bt(16.5), bt(16.5) + 0.3)
    if p2 > 0 and t < bt(18):
        e = out_back(p2)
        x = 160 + int(-500 * (1 - out_cubic(p2)))
        check(d, x + 30, 1395, 28 * e, NAVY)
        d.text((x + 76, 1395), '같은 모델인지도 확인해요', font=font(42, 850), fill=NAVY, anchor='lm')
    # 18박부터: 창 7개 → 한 화면
    if t >= bt(18):
        word_pop(img, '창 7개', W / 2, 470, 124, 900, INK, t, bt(18), rot=-8)
        sk = out_cubic(prog(t, bt(19), bt(19) + 0.2))
        if sk > 0:
            lw = 420 * sk
            d.line([W / 2 - 210, 478, W / 2 - 210 + lw, 466], fill=ORANGE, width=16)
        word_pop(img, '한 화면으로', W / 2, 680, 132, 900, ORANGE, t, bt(20), rot=-10)
        burst(d, W / 2, 680, t, bt(20), ORANGE, n=16, r0=330, r1=460, w=12)
    return img

# ---------- 장면 3: 메시지 (22~26박) ----------
def scene_msg(t):
    img = R.bg(R.DOTS_NAVY, t)
    d = ImageDraw.Draw(img)
    for i, (x, y, r) in enumerate(((160, 620, 64), (930, 720, 44), (190, 1300, 46), (900, 1320, 78))):
        e = out_elastic(prog(t, bt(22.25) + i * 0.08, bt(22.25) + i * 0.08 + 0.6))
        yy = y + 16 * math.sin(t * 3 + i)
        rr = r * e
        if rr > 2:
            d.ellipse([x - rr, yy - rr, x + rr, yy + rr], outline=ORANGE if i % 2 == 0 else SALMON, width=10)
    kline(img, t, [('한눈에', bt(22.5), SALMON), ('비교하니까', bt(23), WHITE)], 820, 88)
    word_pop(img, '더 싸게,', W / 2, 960, 110, 900, WHITE, t, bt(23.75), rot=-8)
    word_pop(img, '더 현명하게', W / 2, 1100, 110, 900, SALMON, t, bt(24.5), rot=8)
    burst(d, W / 2, 1100, t, bt(24.5), ORANGE, n=14, r0=330, r1=440, w=10)
    return img

# ---------- 장면 4: 엔드 (26~30박) ----------
def scene_end(t):
    img = R.bg(R.DOTS_ORANGE, t)
    d = ImageDraw.Draw(img)
    cx, cy, k = W // 2, 660, 300 / 522
    X = lambda u: cx - 150 + u * k
    Y = lambda v: cy - 150 + v * k
    hp = out_cubic(prog(t, bt(26), bt(26) + 0.22))
    if hp > 0:
        d.rounded_rectangle([X(20), Y(20), X(max(97, 20 + 482 * hp)), Y(97)], radius=int(38 * k), fill=WHITE)
    vp = out_cubic(prog(t, bt(26.5), bt(26.5) + 0.22))
    if vp > 0:
        d.rounded_rectangle([X(425), Y(20), X(502), Y(max(97, 20 + 482 * vp))], radius=int(38 * k), fill=WHITE)
    sp = out_elastic(prog(t, bt(27), bt(27) + 0.6))
    if sp > 0.02:
        mx, my, hs = X(154), Y(386), 96 * k * sp
        d.rounded_rectangle([mx - hs, my - hs, mx + hs, my + hs], radius=max(1, int(40 * k * sp)), fill=NAVY)
    ring(d, cx, cy, t, bt(26), WHITE, r0=120, r1=420, w=14)
    word_pop(img, '직구각', W / 2, 960, 150, 900, WHITE, t, bt(27.5), rot=-6)
    burst(d, W / 2, 960, t, bt(27.5), WHITE, n=14, r0=250, r1=360, w=10)
    confetti(d, W / 2, 960, t, bt(27.5), 9, cols=(WHITE, NAVY, SALMON))
    word_pop(img, '가입 없이, 링크 하나로 판정', W / 2, 1110, 56, 850, WHITE, t, bt(28.25))
    up = out_back(prog(t, bt(29), bt(29) + 0.35))
    if up > 0:
        pw, ph = int(520 * up), int(94 * up)
        d.rounded_rectangle([W // 2 - pw // 2, 1245 - ph // 2, W // 2 + pw // 2, 1245 + ph // 2], radius=max(1, ph // 2), fill=NAVY)
        put(img, tlayer('www.jikgugak.com', 42, 850, WHITE), W / 2, 1245, clamp(up))
    return img

# ---------- 연결·카메라 ----------
KICKS = [bt(n) for n in (0, 2, 4, 5, 6)] + [bt(n) for n in range(8, 22)] + [bt(n) for n in range(26, 30)]
HITS = {bt(8): 0.06, bt(9.5): 0.03, bt(16): 0.07, bt(18): 0.04, bt(20): 0.05, bt(23.75): 0.04, bt(24.5): 0.05, bt(26): 0.05, bt(27.5): 0.05}
SHAKES = {bt(8): 20, bt(16): 18, bt(20): 10, bt(27.5): 10}
for tb in TABS:
    HITS[bt(tb[5])] = 0.03

def zoom_amt(t):
    z = 0.0
    for k in KICKS:
        if k <= t < k + 0.35:
            z = max(z, 0.016 * math.exp(-(t - k) * 12))
    for k, a in HITS.items():
        if k <= t < k + 0.4:
            z = max(z, a * math.exp(-(t - k) * 9))
    return 1 + z

def shake(t):
    for k, a in SHAKES.items():
        if k <= t < k + 0.22:
            amp = a * (1 - (t - k) / 0.22)
            return int(amp * math.sin((t - k) * 95)), int(amp * 0.7 * math.cos((t - k) * 81))
    if bt(7) <= t < FLY_START:  # 난장판 떨림
        k = prog(t, bt(7), FLY_START)
        return int(5 * k * math.sin(t * 70)), int(4 * k * math.cos(t * 63))
    return 0, 0

def frame(t):
    if t < 0.25:
        img = Image.new('RGB', (W, H), NAVY)
        r = 2300 * out_cubic(prog(t, 0, 0.25))
        img.paste(scene_chaos(t), (0, 0), R.circle_mask(W / 2, H / 2, r))
    elif t < bt(8):
        img = scene_chaos(t)
    elif t < bt(22) - 0.1:
        img = scene_card(t)
    elif t < bt(22) + 0.12:
        img = scene_card(t)
        edge = W + 300 - (W + 900) * out_cubic(prog(t, bt(22) - 0.1, bt(22) + 0.12))
        img.paste(scene_msg(t), (0, 0), R.slant_mask(edge))
    elif t < bt(26) - 0.08:
        img = scene_msg(t)
    elif t < bt(26) + 0.14:
        img = scene_msg(t)
        r = 2300 * out_cubic(prog(t, bt(26) - 0.08, bt(26) + 0.14))
        img.paste(scene_end(t), (0, 0), R.circle_mask(W / 2, 660, r))
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

# ---------- 곡 (120 BPM, 30박) ----------
def music(path):
    add, N, SR = R.add, R.N, R.SR
    drums, mel, fx = np.zeros(N), np.zeros(N), np.zeros(N)
    roots, chords = R.ROOTS, R.CHORDS
    # 0~8박 난장판: 가벼운 킥·째깍 하이햇, 창이 뜰 때마다 음이 한 칸씩 올라가는 '뽁'
    for n in (0, 2, 4, 5, 6):
        add(drums, bt(n), R.kick(), 0.85)
    for k in range(16):
        add(drums, bt(k * 0.5 + 0.5), R.hat(), 0.6)
    steps = [523.25, 587.33, 659.25, 783.99, 880.0, 987.77, 1174.66]
    for tb, f in zip(TABS, steps):
        add(fx, bt(tb[5]), R.pluck(f, 0.3), 1.6)
        add(fx, bt(tb[5]), R.tick(), 0.8)
    for n in range(4, 8):
        add(mel, bt(n + 0.5), R.bass(roots[1], B * 0.45), 0.8)
    for k in range(8):
        add(drums, bt(7 + k * 0.125), R.snare(0.2 + k * 0.06))
    add(fx, bt(6), R.riser(bt(7.9) - bt(6)), 0.8)
    add(fx, bt(7.75), R.whoosh(0.3), 1.0)
    # 8박 빨려 들어감 → 쾅
    add(fx, bt(8), R.boom(), 1.0)
    add(fx, bt(8), R.crash(), 0.7)
    # 8~16박 그루브, 16~22박 본 비트
    for n in range(8, 22):
        add(drums, bt(n), R.kick(n in (8, 16)), 1.0)
        add(drums, bt(n + 0.5), R.hat(), 0.75)
        if n % 2 == 1:
            add(drums, bt(n), R.clap(), 0.7)
        if n >= 16:
            add(drums, bt(n + 0.25), R.hat(), 0.4)
            add(drums, bt(n + 0.75), R.hat(), 0.4)
        root = roots[(n // 4) % 4]
        add(mel, bt(n + 0.5), R.bass(root, B * 0.45))
        if n >= 16:
            add(mel, bt(n), R.bass(root, B * 0.3), 0.6)
        ch = chords[(n // 4) % 4]
        sub = 4 if n >= 16 else 2
        for k in range(sub):
            add(mel, bt(n + k / sub), R.pluck(ch[(n * sub + k) % 3] * (2 if (n >= 16 and k == 3) else 1)), 0.8)
    for n in (12, 20):
        add(drums, bt(n), R.hat(True), 0.7)
    # UI 소리: 붙여넣기·자동 계산·입력·슬롯
    add(fx, bt(9.5), R.bell(1318.5), 0.5)
    for b in (11, 11.5, 12):
        add(fx, bt(b), R.tick(), 1.0)
        add(fx, bt(b), R.bell(1046.5 + (b - 11) * 400), 0.25)
    for k in range(5):
        add(fx, bt(14) + k * 0.05, R.tick(), 0.6)
    for k in range(14):
        add(fx, bt(15) + k * 0.07, R.tick(), 0.7)
    for k in range(4):
        add(drums, bt(15 + k * 0.25), R.snare(0.4 + k * 0.1))
    add(fx, bt(16), R.crash(), 0.8)
    add(fx, bt(16), R.bell(1760.0), 0.8)
    add(mel, bt(16), R.stab(chords[0], 0.5), 1.0)
    add(fx, bt(18), R.thud(), 0.6)
    add(fx, bt(20), R.thud(), 0.8)
    # 22~26박 쉬는 구간
    add(fx, bt(22) - 0.15, R.whoosh(), 0.8)
    add(drums, bt(22), R.kick(True), 0.7)
    add(mel, bt(22), R.pad(chords[1], bt(4)), 1.0)
    for n in range(22, 26):
        add(drums, bt(n + 0.5), R.hat(), 0.4)
    add(fx, bt(23.75), R.thud(), 0.5)
    add(fx, bt(24.5), R.thud(), 0.7)
    add(drums, bt(25), R.clap(), 0.6)
    for k in range(4):
        add(drums, bt(25 + k * 0.25), R.snare(0.3 + k * 0.1))
    # 26~30박 엔드
    add(fx, bt(26) - 0.12, R.whoosh(), 0.8)
    add(fx, bt(26), R.crash(), 0.8)
    for n in range(26, 30):
        add(drums, bt(n), R.kick(n == 26), 1.0)
    add(drums, bt(27), R.clap(), 0.7)
    add(mel, bt(26), R.stab(chords[0], 0.6), 1.1)
    add(mel, bt(27.5), R.stab(chords[2], 0.5), 0.9)
    add(mel, bt(29), R.stab((440.0, 523.25, 659.25, 880.0), 1.2), 1.2)
    add(mel, bt(29), R.bass(110.0, 1.0), 1.0)
    duck = np.ones(N)
    for n in list(range(8, 22)) + list(range(26, 30)):
        i = int(bt(n) * SR)
        m = int(0.2 * SR)
        j = min(N, i + m)
        duck[i:j] = np.minimum(duck[i:j], 0.45 + 0.55 * (np.arange(j - i) / m))
    mixd = drums * 0.8 + mel * duck * 0.9 + fx * 0.8
    mixd = R.sosfilt(R.sos('highpass', 30), mixd)
    k = int(0.35 * SR)
    mixd[-k:] *= np.linspace(1, 0, k)
    mixd = np.tanh(mixd * 1.1) / np.tanh(1.1)
    right = mixd.copy()
    d = int(0.012 * SR)
    right[d:] = 0.88 * mixd[d:] + 0.12 * mixd[:-d]
    st = np.stack([mixd, right], axis=1)
    st = st / (np.max(np.abs(st)) + 1e-9) * 0.68
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())

def main():
    os.makedirs(OUTDIR, exist_ok=True)
    if os.environ.get('STILLS'):
        sd = os.path.join(OUTDIR, 'stills'); os.makedirs(sd, exist_ok=True)
        for t in (1.2, 2.6, 3.6, 3.95, 4.05, 4.4, 5.2, 6.3, 7.4, 8.3, 9.3, 10.4, 12.2, 13.8, 14.8):
            frame(t).save(os.path.join(sd, f'{t:05.2f}s.png'))
        print('정지 화면', sd)
        return
    snd = os.path.join(OUTDIR, 'music.wav')
    music(snd)
    out = os.path.join(OUTDIR, 'tvc-a.mp4')
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
