# 15초 세로 광고 B안 "장바구니 반전" 렌더러 (그래픽형, 금액 숫자 없음)
#   python3 tools/tvc/render_b.py            → content/2026-10-27-tvc-15s-b/publish/tvc-b.mp4
#   STILLS=1 python3 tools/tvc/render_b.py   → 장면별 정지 화면 PNG만(publish/stills/)
# 스토리보드: content/2026-10-27-tvc-15s-b/storyboard.md
# 1080x1920, 30fps, 15초. 배경음은 tools/cards/bgm(직구각 자작곡 120 BPM) + 직접 만든 효과음(쿵·도장).
import math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTDIR = os.path.join(ROOT, 'content/2026-10-27-tvc-15s-b/publish')
FONT = os.path.join(ROOT, 'tools/cards/fonts/PretendardVariable.ttf')
W, H, FPS, DUR = 1080, 1920, 30, 15.0

ORANGE, NAVY, INK = (210, 58, 16), (31, 46, 87), (22, 24, 29)
BG = (251, 247, 243)
GRAY = (138, 143, 153)
BLUE = (47, 95, 208)       # 판정색: 국내가 나음
GREEN = (14, 124, 74)      # 판정색: 직구각
MEH = (138, 90, 0)         # 판정색: 애매(신호등 예외)
SEG = [  # 해외 막대 조각: 이름, 높이, 색, 글자색, 떨어져 닿는 시각(박자)
    ('상품가', 300, ORANGE, (255, 255, 255), None),
    ('배송비', 120, (232, 106, 64), (255, 255, 255), 2.5),
    ('관세', 95, (242, 146, 112), NAVY, 4.0),
    ('부가세', 85, (248, 184, 158), NAVY, 4.5),
]
DOM_H = 520
BASE, LX, RX, BW = 1330, 330, 750, 230
LINE_Y = BASE - DOM_H

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

def out_back(x, s=1.7):
    x -= 1
    return x * x * ((s + 1) * x + s) + 1

def mix(c1, c2, a):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * a) for i in range(3))

def text(d, xy, s, size, weight=700, fill=INK, anchor='mm', alpha=1.0, bg=BG):
    col = mix(bg, fill, alpha) if alpha < 1 else fill
    f = font(size, weight)
    if '\n' in s:
        d.multiline_text(xy, s, font=f, fill=col, anchor=anchor, align='center', spacing=int(size * 0.28))
    else:
        d.text(xy, s, font=f, fill=col, anchor=anchor)

def parcel(img, cx, cy, scale, color=ORANGE):
    """이름 없는 택배 상자 아이콘(같은 제품을 뜻함)."""
    if scale <= 0.01:
        return
    w, h = int(190 * scale), int(150 * scale)
    d = ImageDraw.Draw(img)
    x0, y0 = cx - w // 2, cy - h // 2
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=int(18 * scale), fill=(236, 214, 190), outline=(170, 128, 92), width=max(2, int(5 * scale)))
    d.rectangle([x0, y0, x0 + w, y0 + int(h * 0.3)], fill=(222, 194, 164))
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=int(18 * scale), outline=(170, 128, 92), width=max(2, int(5 * scale)))
    tw = int(36 * scale)
    d.rectangle([cx - tw // 2, y0, cx + tw // 2, y0 + h], fill=color)

def dashed(d, x0, x1, y, col, dash=22, gap=14, width=5):
    x = x0
    while x < x1:
        d.line([x, y, min(x + dash, x1), y], fill=col, width=width)
        x += dash + gap

def check(d, cx, cy, r, col):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    d.line([cx - r * 0.45, cy, cx - r * 0.1, cy + r * 0.38, cx + r * 0.5, cy - r * 0.35], fill=(255, 255, 255), width=max(3, int(r * 0.25)), joint='curve')

def subtitle(d, t, subs, y=390, size=76):
    for a, b, s in subs:
        if a <= t < b:
            p = out_cubic(prog(t, a, a + 0.18))
            text(d, (W // 2, y + int(30 * (1 - p))), s, size, 800, INK, alpha=p)

def stamp_img(word, col, size=330):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([8, 8, size - 8, size - 8], fill=(255, 255, 255, 245), outline=col + (255,), width=14)
    d.ellipse([34, 34, size - 34, size - 34], outline=col + (255,), width=5)
    lines = word.split(' ')
    if len(lines) == 2:
        d.text((size // 2, size // 2 - 34), lines[0], font=font(64, 900), fill=col + (255,), anchor='mm')
        d.text((size // 2, size // 2 + 40), lines[1], font=font(64, 900), fill=col + (255,), anchor='mm')
    else:
        d.text((size // 2, size // 2), word, font=font(72, 900), fill=col + (255,), anchor='mm')
    return im

STAMP = stamp_img('국내가 나음', BLUE)

def shake(t):
    amp = 0
    for land, a in ((2.5, 16), (4.0, 11), (4.5, 11), (7.0, 18)):
        if land <= t < land + 0.2:
            k = 1 - (t - land) / 0.2
            amp = a * k
            return int(amp * math.sin((t - land) * 90)), int(amp * 0.6 * math.cos((t - land) * 77))
    return 0, 0

# ---------- 장면 1~5: 막대 비교 ----------
def scene_bars(t):
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    subtitle(d, t, [(0, 2.0, '직구가 더 싸 보이죠?'), (2.0, 3.5, '배송비 더하고'), (3.5, 5.0, '관세·부가세까지'),
                    (5.0, 7.0, '다 더해서 한눈에'), (7.0, 99, '이번엔 국내가 나아요')])
    grow = out_cubic(prog(t, 0.05, 0.6))
    pop = out_back(prog(t, 0.0, 0.45))
    parcel(img, LX, 530, pop * 0.95)
    parcel(img, RX, 530, pop * 0.95)
    # 바닥선·이름
    d.line([150, BASE, 930, BASE], fill=(210, 204, 198), width=4)
    text(d, (LX, BASE + 52), '국내 최저가', 44, 800, NAVY, alpha=grow)
    text(d, (RX, BASE + 52), '해외직구', 44, 800, ORANGE, alpha=grow)
    # 국내 막대
    dh = int(DOM_H * grow)
    d.rounded_rectangle([LX - BW // 2, BASE - dh, LX + BW // 2, BASE], radius=18, fill=NAVY)
    # 국내 높이 점선(관세부터)
    la = prog(t, 3.5, 3.8)
    if la > 0:
        dashed(d, 150, 930, LINE_Y, mix(BG, NAVY, la * 0.55))
    # 해외 막대 조각 쌓기
    y = BASE
    top = BASE
    for i, (name, h, col, tcol, land) in enumerate(SEG):
        if land is None:
            hh = int(h * grow)
            seg_top = y - hh
        else:
            start = land - 0.35
            if t < start:
                break
            p = prog(t, start, land)
            target = y - h
            seg_top = int(-200 + (target + 200) * p * p) if p < 1 else target
            hh = h
            if p >= 1 and t < land + 0.1:  # 닿을 때 살짝 눌림
                sq = int(10 * (1 - (t - land) / 0.1))
                seg_top += sq
        x0, x1 = RX - BW // 2, RX + BW // 2
        r = 18 if i in (0, len(SEG) - 1) else 6
        d.rounded_rectangle([x0, seg_top, x1, seg_top + hh], radius=r, fill=col)
        if i > 0:
            d.line([x0 + 6, seg_top + hh, x1 - 6, seg_top + hh], fill=BG, width=4)
        if hh >= 60:
            text(d, (RX, seg_top + hh // 2), name, 38, 800, tcol, bg=col)
        top = min(top, seg_top)
        y = seg_top if land is None else y - h
    # 넘친 부분 강조
    ha = prog(t, 5.0, 5.25)
    if ha > 0:
        over_top = BASE - sum(s[1] for s in SEG)
        pulse = 0.5 + 0.5 * math.sin((t - 5.0) * 8) if t < 7 else 1
        c = mix(BG, BLUE, ha)
        d.rounded_rectangle([RX - BW // 2 - 12, over_top - 12, RX + BW // 2 + 12, LINE_Y + 2], radius=20, outline=c, width=int(6 + 3 * pulse))
        p = out_back(ha)
        pw, ph = int(300 * p), int(74 * p)
        if pw > 20:
            cy = over_top - 70
            d.rounded_rectangle([RX - pw // 2, cy - ph // 2, RX + pw // 2, cy + ph // 2], radius=ph // 2, fill=BLUE)
            if p > 0.6:
                text(d, (RX, cy), '국내보다 비싸요', 36, 800, (255, 255, 255), bg=BLUE)
    # 판정 도장(7.0에 쾅)
    if t >= 6.85:
        p = prog(t, 6.85, 7.0)
        sc = 1.9 - 0.9 * (p * p)
        st = STAMP.rotate(14, resample=Image.BICUBIC, expand=True)
        sw = int(st.width * sc)
        st = st.resize((sw, sw), Image.BICUBIC)
        if p < 1:
            a = st.split()[3].point(lambda v: int(v * p))
            st.putalpha(a)
        img.paste(st, (LX - sw // 2, 1010 - sw // 2), st)
    return img

# ---------- 장면 6: 사용법 ----------
_card_shadow = None
def scene_how(t):
    global _card_shadow
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    p0 = out_cubic(prog(t, 9.5, 9.7))
    text(d, (W // 2, 400 + int(30 * (1 - p0))), '국내 최저가만 넣으면\n바로 판정', 72, 800, INK, alpha=p0)
    cx0, cy0, cx1, cy1 = 110, 600, 970, 1240
    if _card_shadow is None:
        sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([cx0, cy0 + 18, cx1, cy1 + 18], radius=40, fill=(31, 46, 87, 60))
        _card_shadow = sh.filter(ImageFilter.GaussianBlur(24))
    img.paste(_card_shadow, (0, 0), _card_shadow)
    d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=40, fill=(255, 255, 255))
    rows = [
        (9.55, '상품 링크·이름', '붙여넣기 완료', '가격·관부가세 자동'),
        (9.95, '국내 최저가', '○○,○○○원', '이것만 넣으면 돼요'),
    ]
    y = cy0 + 70
    for at, label, val, hint in rows:
        p = out_cubic(prog(t, at, at + 0.2))
        text(d, (cx0 + 60, y), label, 32, 700, GRAY, anchor='lm', alpha=p, bg=(255, 255, 255))
        fy = y + 40
        bc = mix((255, 255, 255), (226, 221, 216), p)
        d.rounded_rectangle([cx0 + 50, fy, cx1 - 50, fy + 96], radius=22, outline=bc, width=4)
        if p > 0.3:
            text(d, (cx0 + 84, fy + 48), val, 40, 800, INK, anchor='lm', alpha=p, bg=(255, 255, 255))
            text(d, (cx1 - 84, fy + 48), hint, 28, 700, ORANGE, anchor='rm', alpha=p, bg=(255, 255, 255))
        y = fy + 150
    # 판정 결과: 신호등 3개 중 '국내가 나음' 켜짐
    p = out_back(prog(t, 10.35, 10.6))
    if p > 0:
        ry = y + 50
        lights = [('직구각', GREEN), ('애매', MEH), ('국내가 나음', BLUE)]
        for i, (nm, col) in enumerate(lights):
            lx = cx0 + 170 + i * 260
            on = i == 2
            r = int((46 if on else 34) * p)
            c = col if on else mix((255, 255, 255), col, 0.25)
            d.ellipse([lx - r, ry - r, lx + r, ry + r], fill=c)
            text(d, (lx, ry + 80), nm, 32, 800 if on else 600, col if on else GRAY, alpha=clamp(p), bg=(255, 255, 255))
    p2 = out_cubic(prog(t, 10.5, 10.7))
    if p2 > 0:
        check(d, 330, 1330, 26, NAVY)
        text(d, (372, 1330), '같은 모델인지도 확인해요', 40, 800, NAVY, anchor='lm', alpha=p2)
    return img

# ---------- 장면 7: 약속 ----------
def scene_promise(t):
    img = Image.new('RGB', (W, H), NAVY)
    d = ImageDraw.Draw(img)
    p = out_cubic(prog(t, 11.0, 11.3))
    text(d, (W // 2, 900 + int(40 * (1 - p))), '국내가 나으면\n국내가 낫다고 해요', 84, 800, (255, 255, 255), alpha=p, bg=NAVY)
    lw = int(220 * out_cubic(prog(t, 11.25, 11.6)))
    if lw > 0:
        d.rounded_rectangle([W // 2 - lw // 2, 1060, W // 2 + lw // 2, 1072], radius=6, fill=ORANGE)
    return img

# ---------- 장면 8: 엔드 ----------
def logo(img, cx, cy, size, a=1.0):
    if size < 4:
        return
    L = Image.new('RGBA', (1080, 1080), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    d.rounded_rectangle([290, 308, 772, 385], radius=38, fill=(255, 255, 255, 255))
    d.rounded_rectangle([695, 308, 772, 790], radius=38, fill=(255, 255, 255, 255))
    d.rounded_rectangle([328, 578, 520, 771], radius=40, fill=NAVY + (255,))
    L = L.crop((270, 288, 792, 810)).resize((size, size), Image.LANCZOS)
    if a < 1:
        L.putalpha(L.split()[3].point(lambda v: int(v * a)))
    img.paste(L, (cx - size // 2, cy - size // 2), L)

def scene_end(t):
    img = Image.new('RGB', (W, H), ORANGE)
    d = ImageDraw.Draw(img)
    p = out_back(prog(t, 12.5, 12.9))
    logo(img, W // 2, 690, int(300 * p), clamp(p))
    p2 = out_cubic(prog(t, 12.85, 13.15))
    text(d, (W // 2, 960 + int(30 * (1 - p2))), '직구각', 132, 900, (255, 255, 255), alpha=p2, bg=ORANGE)
    p3 = out_cubic(prog(t, 13.3, 13.6))
    text(d, (W // 2, 1110 + int(24 * (1 - p3))), '싸 보이는 곳 말고, 진짜 싼 곳', 56, 800, (255, 255, 255), alpha=p3, bg=ORANGE)
    p4 = out_cubic(prog(t, 13.7, 14.0))
    if p4 > 0:
        pw = int(500 * p4)
        d.rounded_rectangle([W // 2 - pw // 2, 1200, W // 2 + pw // 2, 1290], radius=45, fill=mix(ORANGE, NAVY, p4))
        if p4 > 0.5:
            text(d, (W // 2, 1245), 'www.jikgugak.com', 40, 800, (255, 255, 255), bg=NAVY)
    return img

def frame(t):
    if t < 9.5:
        img = scene_bars(t)
        if t > 9.3:  # 9.5 박자 전에 배경색으로 빠지고, 다음 장면은 제 요소가 하나씩 들어와요
            img = Image.blend(img, Image.new('RGB', (W, H), BG), (t - 9.3) / 0.2)
    elif t < 11.0:
        img = scene_how(t)
    elif t < 12.5:
        img = scene_promise(t)
    else:
        img = scene_end(t)
    dx, dy = shake(t)
    if dx or dy:
        bgc = img.getpixel((5, 5))
        moved = Image.new('RGB', (W, H), bgc)
        moved.paste(img, (dx, dy))
        img = moved
    return img

# ---------- 소리 ----------
SR = 44100
def sfx_track(path):
    n = int(SR * DUR)
    buf = np.zeros(n, dtype=np.float64)
    rng = np.random.default_rng(7)
    def thud(at, gain=0.9, f0=140, f1=48, length=0.22):
        m = int(SR * length)
        tt = np.arange(m) / SR
        freq = f1 + (f0 - f1) * np.exp(-tt * 25)
        ph = 2 * np.pi * np.cumsum(freq) / SR
        env = np.exp(-tt * 18)
        s = np.sin(ph) * env
        click = rng.standard_normal(m) * np.exp(-tt * 160) * 0.35
        i = int(at * SR)
        buf[i:i + m] += gain * (s + click)[: n - i]
    thud(2.5, 1.0)
    thud(4.0, 0.75, 170, 60)
    thud(4.5, 0.75, 190, 66)
    thud(7.0, 1.0, 110, 40, 0.3)   # 도장
    for at in (9.6, 10.0, 10.4):   # 입력·판정 '톡'
        m = int(SR * 0.06)
        tt = np.arange(m) / SR
        i = int(at * SR)
        buf[i:i + m] += 0.35 * np.sin(2 * np.pi * 1320 * tt) * np.exp(-tt * 70)
    buf = np.clip(buf, -1, 1)
    pcm = (buf * 32767 * 0.9).astype(np.int16)
    st = np.repeat(pcm[:, None], 2, axis=1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(st.tobytes())

def main():
    os.makedirs(OUTDIR, exist_ok=True)
    if os.environ.get('STILLS'):
        sd = os.path.join(OUTDIR, 'stills'); os.makedirs(sd, exist_ok=True)
        for t in (1.5, 3.2, 4.8, 6.5, 8.5, 10.9, 12.2, 14.8):
            frame(t).save(os.path.join(sd, f'{t:05.2f}s.png'))
        print('정지 화면', sd)
        return
    sfx = os.path.join(OUTDIR, 'sfx.wav')
    sfx_track(sfx)
    pick = os.environ.get('BGM', '1')
    bgm = os.path.join(ROOT, f'tools/cards/bgm/bgm-{pick}.m4a')
    out = os.path.join(OUTDIR, 'tvc-b.mp4')
    af = (f'[1:a]atrim=0:{DUR},afade=t=out:st={DUR - 1.2}:d=1.2,volume=0.55[m];'
          f'[2:a]volume=0.8[s];[m][s]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.8:level=false[aout]')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', bgm, '-i', sfx, '-filter_complex', af, '-map', '0:v', '-map', '[aout]',
           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '160k', '-t', str(DUR), '-movflags', '+faststart', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(int(DUR * FPS)):
        p.stdin.write(frame(i / FPS).tobytes())
    p.stdin.close(); p.wait()
    os.remove(sfx)
    print('광고', out, os.path.getsize(out) // 1024, 'KB')

if __name__ == '__main__':
    main()
