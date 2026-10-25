// 상품 사진(쿠팡 파트너스·알리 제휴 이미지)을 content/_assets/products/ 에 내려받아요.
// 작업 공간에서는 이미지 서버 접속이 막혀 있어서 GitHub Actions에서 돌려요(.github/workflows/fetch-assets.yml).
// 결과: content/_assets/products/<slug>.<확장자> + map.json(원본 주소 → 파일)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const products = JSON.parse(readFileSync('data/products.json', 'utf8'));
const dir = 'content/_assets/products';
mkdirSync(dir, { recursive: true });
const mapPath = `${dir}/map.json`;
const map = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : {};
const urls = new Map();
for (const p of products) {
  if (p.image) urls.set(p.image, p.slug);
  for (const part of p.parts || []) if (part.image) urls.set(part.image, `${p.slug}-${(part.name || 'part').replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}`);
}
let ok = 0, fail = 0;
for (const [url, slug] of urls) {
  if (map[url] && existsSync(map[url])) { ok++; continue; }
  const ext = (url.match(/\.(jpe?g|png|webp)(?:$|\?)/i) || [, 'jpg'])[1].toLowerCase();
  const file = `${dir}/${slug}.${ext}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (jikgugak asset fetch)' } });
    if (!r.ok) throw new Error(String(r.status));
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    map[url] = file; ok++;
  } catch (e) { console.log('실패', slug, e.message); fail++; }
}
writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n');
console.log(`상품 사진 ${ok}개 준비, 실패 ${fail}개`);
