// 직구각 상품 페이지(로컬 dist)를 휴대폰 크기로 찍어 판정~체감가 영수증 부분만 PNG로 저장
//   node tools/tvc/site_shot.cjs <slug> <out.png>   (dist를 127.0.0.1:8765에서 띄운 상태)
const { chromium } = require('playwright');
(async () => {
  const [slug, out] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await p.goto(`http://127.0.0.1:8765/p/${slug}.html`); await p.waitForTimeout(800);
  await p.evaluate(() => { for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e).position; if (s === 'fixed' || s === 'sticky') e.style.display = 'none'; } });
  const r = await p.evaluate(() => { const a = document.querySelector('.vhero').getBoundingClientRect(), c = document.querySelector('.receipt').getBoundingClientRect(); return { top: a.top + scrollY, bottom: c.bottom + scrollY }; });
  await p.screenshot({ path: out, clip: { x: 0, y: Math.max(0, r.top - 16), width: 390, height: Math.min(900, r.bottom - r.top + 32) }, fullPage: true });
  await b.close();
})();
