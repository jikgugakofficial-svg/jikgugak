# 네이버 게시 키트 만들기: python3 tools/publish/naver/kit.py content/<폴더> <출력.html> "<세트 이름>"
# 필요: <폴더>/blog.md(제목 후보·추천·본문·태그), <폴더>/naver/NN_*.jpg(사진 순서), <폴더>/naver/map.json(블로그의 img 파일명 → 사진 번호)
import re, base64, markdown, html, json, sys, os
# 네이버 스마트에디터에 붙여 넣었을 때 모양이 깨지지 않게: 모든 줄을 왼쪽 정렬·인라인 스타일 문단으로 바꿔요
from bs4 import BeautifulSoup, NavigableString
P = 'margin:0;text-align:left;font-size:16px;line-height:1.9;color:#222222;background:transparent'
def naver_html(src):
    soup = BeautifulSoup(src, 'html.parser')
    out = []
    blank = '<p style="margin:0;text-align:left"><br></p>'
    first_lines = 0
    for el in soup.find_all(recursive=False):
        if isinstance(el, NavigableString):
            continue
        name = el.name
        if name in ('h2', 'h3', 'h4'):
            out += [blank, f'<p style="{P};font-size:20px;font-weight:bold;color:#111111">{el.get_text()}</p>']
        elif name == 'p' and 'slot' in (el.get('class') or []):
            out += [f'<p style="{P};font-size:14px;color:#9A9A9A">{el.decode_contents()}</p>', blank]
        elif name == 'p':
            parts = [x.strip() for x in el.decode_contents().split('<br/>')]
            for part in parts:
                if not part:
                    continue
                if first_lines < 2:  # 맨 위 광고 문구 두 줄
                    out.append(f'<p style="{P};font-size:13px;color:#888888">{part}</p>')
                    first_lines += 1
                    if first_lines == 2:
                        out.append(blank)
                    continue
                out.append(f'<p style="{P}">{part}</p>')
            if first_lines >= 2 and out and out[-1] != blank:
                out.append(blank)
            first_lines = max(first_lines, 2)
        elif name == 'table':
            for t in el.find_all(['th', 'td']):
                head = t.name == 'th'
                t['style'] = 'border:1px solid #DDDDDD;padding:8px 10px;text-align:left;font-size:15px;color:#222222;' + ('background:#F5F5F5;font-weight:bold;' if head else 'background:transparent;')
            el['style'] = 'border-collapse:collapse;width:100%;margin:8px 0'
            out += [str(el), blank]
        elif name in ('ol', 'ul'):
            for i, li in enumerate(el.find_all('li', recursive=False), 1):
                mark = f'{i}. ' if name == 'ol' else '· '
                out.append(f'<p style="{P}">{mark}{li.decode_contents()}</p>')
            out.append(blank)
        else:
            out.append(str(el))
    return '<div style="text-align:left">' + '\n'.join(out) + '</div>'

D = sys.argv[1]; OUT = sys.argv[2]
md = open(os.path.join(D, 'blog.md'), encoding='utf8').read()
title = re.search(r'추천:\s*(\d+)', md); cands = re.findall(r'^\d+\.\s+(.+)$', md.split('## 본문')[0], re.M)
TITLE = cands[int(title.group(1)) - 1].strip()
body = md.split('## 본문', 1)[1].split('\n---', 1)[0].strip()
tags = [t.strip() for t in md.split('## 네이버 태그', 1)[1].split('\n', 1)[1].strip().split(',')]
imgmap = json.load(open(os.path.join(D, 'naver', 'map.json'), encoding='utf8'))
pics = []
def rep(m):
    f, desc = m.group(1).strip(), m.group(2).strip()
    n = imgmap[f]; pics.append((n, desc))
    return f'\n<p class="slot">[사진 {n} 자리] {html.escape(desc)}</p>\n'
body = re.sub(r'\[이미지:\s*img/([^,\]]+),\s*([^\]]+)\]', rep, body)
bh = markdown.markdown(body, extensions=['tables','nl2br'])
bh = naver_html(bh)
files = sorted(f for f in os.listdir(os.path.join(D, 'naver')) if f.endswith('.jpg'))
gallery = ''
for f in files:
    n = int(f[:2]); data = base64.b64encode(open(os.path.join(D, 'naver', f), 'rb').read()).decode()
    desc = next((d for k, d in pics if k == n), '')
    gallery += f'''<figure class="pic"><div class="pic-num">사진 {n}</div><img id="pic{n}" alt="{html.escape(desc)}" src="data:image/jpeg;base64,{data}"><figcaption>{html.escape(desc)}</figcaption><button class="btn" data-copyimg="pic{n}">사진 {n} 복사</button></figure>\n'''
tpl = open(os.path.join(os.path.dirname(__file__), 'tpl.html'), encoding='utf8').read()
out = tpl.replace('{{TITLE}}', html.escape(TITLE)).replace('{{BODY}}', bh).replace('{{GALLERY}}', gallery) \
   .replace('{{TAGS}}', ''.join(f'<button class="chip" data-copy="{html.escape(t)}">{html.escape(t)}</button>' for t in tags)) \
   .replace('{{TAGS_ALL}}', html.escape(' '.join('#' + t for t in tags))).replace('{{NPICS}}', str(len(files))) \
   .replace('{{SET}}', html.escape(sys.argv[3] if len(sys.argv) > 3 else ''))
open(OUT, 'w', encoding='utf8').write(out)
print(TITLE, len(files), 'pics', len(tags), 'tags', len(out)//1024, 'KB')
