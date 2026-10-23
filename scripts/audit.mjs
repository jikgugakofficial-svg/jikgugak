// 사이트 점검: 빌드 결과(dist)와 데이터를 훑어 깨진 링크·빠진 메타·제휴 링크 누락을 찾아요. 사용: npm run build && node scripts/audit.mjs
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const files=[]; (function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f); if(fs.statSync(p).isDirectory()) walk(p); else if(p.endsWith('.html')) files.push(p);}})(dist);
const exists=(u)=>{ u=u.split('#')[0].split('?')[0]; if(!u||u==='/') return fs.existsSync(dist+'/index.html'); for (const c of [u,u+'.html',u+'/index.html']) if(fs.existsSync(dist+c)&&fs.statSync(dist+c).isFile()) return true; return false; };
const issues=[];
for (const f of files){
  const h=fs.readFileSync(f,'utf8'); const rel=f.replace(dist,'');
  const t=(h.match(/<title>([^<]*)<\/title>/)||[])[1]; const d=(h.match(/<meta name="description" content="([^"]*)"/)||[])[1];
  if(!t) issues.push(rel+': no title'); if(!d) issues.push(rel+': no description'); else if(d.length>160) issues.push(rel+`: description ${d.length}자`);
  if(!/rel="canonical"/.test(h)) issues.push(rel+': no canonical');
  if(!/<h1/.test(h)) issues.push(rel+': no h1');
  if((h.match(/<h1/g)||[]).length>1) issues.push(rel+': multiple h1');
  for (const m of h.matchAll(/href="(\/[^"]*)"/g)) if(!exists(m[1])) issues.push(rel+': broken internal link '+m[1]);
  for (const m of h.matchAll(/src="(\/[^"]*)"/g)) if(!m[1].startsWith("/_vercel/") && !exists(m[1])) issues.push(rel+': missing asset '+m[1]);
  if(/undefined|NaN|\[object Object\]/.test(h.replace(/<script[\s\S]*?<\/script>/g,''))) issues.push(rel+': contains undefined/NaN');
  for (const m of h.matchAll(/<img(?![^>]*alt=)[^>]*>/g)) issues.push(rel+': img without alt');
  if(!/og:image/.test(h)) { if(rel==='/index.html') issues.push('ALL: no og:image (공유 미리보기 이미지 없음)'); }
}
// product checks
const P=JSON.parse(fs.readFileSync(path.join(root,'data','products.json'),'utf8'));
for(const p of P){
  if(!p.domesticUrl) issues.push(p.slug+': no domesticUrl');
  if(!p.buyUrl) issues.push(p.slug+': no buyUrl');
  if(p.sample) issues.push(p.slug+': sample');
  if(p.store==='iherb' && !/link|impact|partner/.test(p.buyUrl)) issues.push(p.slug+': 아이허브 링크가 제휴 링크 아님');
  if(!p.domesticCheckUrl) issues.push(p.slug+': no domesticCheckUrl');
  if(p.store!=='amazon' && !p.overseasCheckUrl) issues.push(p.slug+': no overseasCheckUrl');
}
const S=JSON.parse(fs.readFileSync(path.join(root,'data','settings.json'),'utf8'));
issues.push('INFO fx: '+S.fx.label);
const sm=fs.readFileSync(dist+'/sitemap.xml','utf8'); issues.push('INFO sitemap urls: '+(sm.match(/<loc>/g)||[]).length);
console.log(files.length+' html files\n'+issues.join('\n'));
