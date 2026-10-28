// 아주 작은 마크다운 → HTML 변환기(가이드 페이지용). 지원: ## ### 제목, 문단, - · 1. 목록, | 표 |, **굵게**, [글](주소), `코드`, > 인용
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function inline(t) {
  let s = esc(t);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
    const ext = /^https?:\/\//.test(url) && !/jikgugak\.com/.test(url);
    return `<a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`;
  });
  return s;
}
export function md(src) {
  const lines = String(src).replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{2,3})\s+(.*)$/))) { const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); i++; continue; }
    if (/^\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(rows[1] && /^\|[\s:|-]+\|?$/.test(rows[1]) ? 2 : 1).map(cells);
      out.push(`<table><thead><tr>${head.map((h) => `<th scope="col">${inline(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l)) {
      const ordered = /^\s*\d+\.\s+/.test(l);
      const items = [];
      while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) { items.push(lines[i].replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, '')); i++; }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^>\s?/.test(l)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`);
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|\||\s*[-*]\s|\s*\d+\.\s|>)/.test(lines[i])) { p.push(lines[i]); i++; }
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}
// --- 머리말(front matter): 첫 줄 --- 부터 다음 --- 까지 "키: 값", faq 는 JSON 배열 한 줄
export function frontMatter(src) {
  const m = String(src).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const k = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (!k) continue;
    let v = k[2].trim();
    if (/^[[{]/.test(v)) { try { v = JSON.parse(v); } catch { /* 그대로 */ } }
    meta[k[1]] = v;
  }
  return { meta, body: m[2] };
}
