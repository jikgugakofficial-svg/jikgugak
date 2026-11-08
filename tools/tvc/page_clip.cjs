// 직구각 사이트 아무 페이지(로컬 dist)나 휴대폰 크기로 열어, 위 요소~아래 요소 구간만 PNG로 저장
//   node tools/tvc/page_clip.cjs <경로> <out.png> <rows.json> <위 선택자> <아래 선택자> '<{"이름":"선택자",...}>' [클릭할 선택자]
//   (dist를 127.0.0.1:SHOT_PORT(기본 8765)에서 띄운 상태) rows.json: 이름별 줄 위치(이미지 높이 대비 0~1) → 영상에서 줄을 차례로 비출 때 씀
const { chromium } = require('playwright');
(async () => {
  const [path, out, rowsOut, topSel, botSel, rowsJson, clickSel] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await p.goto(`http://127.0.0.1:${process.env.SHOT_PORT || 8765}${path}`); await p.waitForTimeout(600);
  if (clickSel) { await p.click(clickSel); await p.waitForTimeout(400); }
  await p.evaluate(() => { for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e).position; if (s === 'fixed' || s === 'sticky') e.style.display = 'none'; } });
  const box = await p.evaluate(([t, bo]) => { const a = document.querySelector(t).getBoundingClientRect(), c = document.querySelector(bo).getBoundingClientRect(); return { top: a.top + scrollY - 16, bottom: c.bottom + scrollY + 16 }; }, [topSel, botSel]);
  const H = Math.min(900, box.bottom - box.top);
  const rows = await p.evaluate(([sels, top, H]) => { const o = {}; for (const [k, s] of Object.entries(sels)) { const e = document.querySelector(s); if (!e) continue; const r = e.getBoundingClientRect(); o[k] = { y0: (r.top + scrollY - top) / H, y1: (r.bottom + scrollY - top) / H }; } return o; }, [JSON.parse(rowsJson || '{}'), box.top, H]);
  require('fs').writeFileSync(rowsOut, JSON.stringify(rows));
  await p.screenshot({ path: out, clip: { x: 0, y: box.top, width: 390, height: H }, fullPage: true });
  await b.close();
})();
