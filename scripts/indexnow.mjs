// IndexNow 알림: 오늘(한국 시간) 바뀐 페이지를 빙(Bing) 등 검색엔진에 알려요.
// ChatGPT 검색이 빙 색인을 쓰기 때문에, 바뀐 가격·판정이 AI 답변에 빨리 반영되게 하려는 것.
// 키 파일은 public/<키>.txt (공개 값이라 비밀이 아니에요). 사이트맵의 lastmod가 오늘인 주소만 보내요.
// 실행: node scripts/indexnow.mjs        (--all 이면 사이트맵 전체, 처음 한 번만)
const HOST = 'www.jikgugak.com';
const KEY = '6375c12ebda2fd9f033b51fcc1497f26';
const all = process.argv.includes('--all');
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

const keyRes = await fetch(`https://${HOST}/${KEY}.txt`);
if (!keyRes.ok || (await keyRes.text()).trim() !== KEY) {
  console.log('키 파일이 아직 배포되지 않았어요. 배포 뒤 다시 실행해요.');
  process.exit(0);
}

const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)]
  .filter((m) => all || m[2] === today)
  .map((m) => m[1]);
if (!urls.length) { console.log(`${today} 바뀐 페이지 없음`); process.exit(0); }

const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
});
console.log(`IndexNow ${r.status}: ${urls.length}개 알림 (${all ? '전체' : today})`);
if (r.status >= 400 && r.status !== 429) process.exit(1);
