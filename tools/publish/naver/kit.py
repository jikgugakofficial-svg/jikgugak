# 네이버 게시 키트 만들기: python3 tools/publish/naver/kit.py content/<폴더> <출력.html> "<세트 이름>"
# 필요: <폴더>/blog.md(제목 후보·추천·본문·태그), <폴더>/naver/NN_*.jpg(사진 순서), <폴더>/naver/map.json(블로그의 img 파일명 → 사진 번호)
import re, base64, markdown, html, json, sys, os
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
    return f'\n<p class="slot">[사진 {n} 넣기] {html.escape(desc)}</p>\n'
body = re.sub(r'\[이미지:\s*img/([^,\]]+),\s*([^\]]+)\]', rep, body)
bh = markdown.markdown(body, extensions=['tables','nl2br'])
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
