# 승인 직전에 매니저가 실행: cards/*.png → publish/*.jpg (인스타 API는 JPEG만 받아요)
#   python3 tools/publish/prepare.py content/<폴더>
import sys, glob, os
from PIL import Image
d = sys.argv[1]
os.makedirs(os.path.join(d, 'publish'), exist_ok=True)
for f in sorted(glob.glob(os.path.join(d, 'cards', '*.png'))):
    out = os.path.join(d, 'publish', os.path.basename(f)[:-4] + '.jpg')
    Image.open(f).convert('RGB').save(out, 'JPEG', quality=92)
    print(out)
