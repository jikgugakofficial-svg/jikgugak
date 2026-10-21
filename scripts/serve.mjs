// 내 컴퓨터에서 미리보기: npm run preview 후 http://localhost:4173
// Vercel의 cleanUrls처럼 /calculator → calculator.html 로 연결합니다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT) || 4173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain', '.ics': 'text/calendar', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const candidates = [urlPath, urlPath + '.html', path.join(urlPath, 'index.html')];
  for (const c of candidates) {
    const f = path.join(dist, path.normalize(c));
    if (f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      return fs.createReadStream(f).pipe(res);
    }
  }
  res.writeHead(404, { 'Content-Type': TYPES['.html'] });
  fs.createReadStream(path.join(dist, '404.html')).pipe(res);
}).listen(port, () => console.log(`미리보기: http://localhost:${port}`));
