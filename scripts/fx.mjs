// 빌드할 때 최신 환율을 받아와요. 키가 없거나 실패하면 data/settings.json 값을 그대로 써요(빌드는 절대 멈추지 않음).
// - 결제 환율(매매기준율): 한국수출입은행 환율 API, Vercel 환경 변수 KOREAEXIM_KEY
// - 과세환율(관세청 주간 고시): 공공데이터포털 관세청_관세환율정보(GW), Vercel 환경 변수 DATA_GO_KR_KEY
const kstDate = (offsetDays = 0) => new Date(Date.now() + 9 * 3600e3 - offsetDays * 864e5).toISOString().slice(0, 10);
const ymd = (iso) => iso.replace(/-/g, '');
const dot = (iso) => iso.replace(/-/g, '.');
const num = (s) => Number(String(s).replace(/,/g, ''));

async function getText(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

// 매매기준율: 주말·공휴일·오전 11시 전에는 빈 값이 와서 최근 10일을 거슬러 찾아요.
// 홈 환율판용으로 달러·위안(CNH)·엔(100엔)과 직전 영업일 대비 변동도 같이 만들어요.
const BOARD = [['usd', 'USD'], ['cny', 'CNH'], ['jpy', 'JPY(100)']];
async function eximbankDay(key, d) {
  const text = await getText(`https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${encodeURIComponent(key)}&searchdate=${ymd(d)}&data=AP01`);
  let rows;
  try { rows = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(rows) || !rows.length) return null;
  const pick = (u) => { const r = rows.find((x) => x.cur_unit === u); return r && num(r.deal_bas_r) > 0 ? num(r.deal_bas_r) : null; };
  const out = {};
  for (const [k, u] of BOARD) out[k] = pick(u);
  return out.usd ? out : null;
}
async function eximbankUsd(key) {
  const days = [];
  for (let i = 0; i < 10 && days.length < 2; i++) {
    const d = kstDate(i);
    const r = await eximbankDay(key, d);
    if (r) days.push({ d, r });
  }
  if (!days.length) return null;
  const [cur, prev] = days;
  const v = cur.r.usd;
  const board = { date: cur.d, items: {} };
  for (const [k] of BOARD) {
    if (!cur.r[k]) continue;
    board.items[k] = { v: cur.r[k], chg: prev && prev.r[k] ? Math.round((cur.r[k] - prev.r[k]) * 100) / 100 : null };
  }
  return { usdKrw: v, date: cur.d, board, label: `결제 환율(매매기준율) ${v.toLocaleString('ko-KR', { minimumFractionDigits: 2 })}원/달러 (${dot(cur.d)} 한국수출입은행)` };
}

// 과세환율: 공공데이터포털 '관세청_관세환율정보(GW)' (자동승인). 수입(weekFxrtTpcd=2) 기준, 오늘이 속한 주의 값을 줘요.
// 포털 키는 Decoding 키(특수문자 그대로)든 Encoding 키(%2B 등)든 그대로 넣어도 되게 처리해요.
async function customsUsd(key) {
  const d = kstDate(0);
  const k = /%[0-9A-F]{2}/i.test(key) ? key : encodeURIComponent(key);
  const xml = await getText(`https://apis.data.go.kr/1220000/retrieveTrifFxrtInfo/getRetrieveTrifFxrtInfo?serviceKey=${k}&aplyBgnDt=${ymd(d)}&weekFxrtTpcd=2`);
  const blocks = xml.split(/<item>/i).slice(1);
  if (!blocks.length) throw new Error('응답에 환율 없음: ' + xml.replace(/\s+/g, ' ').slice(0, 160));
  for (const b of blocks) {
    if (!/<currSgn>\s*USD\s*<\/currSgn>/i.test(b)) continue;
    const v = num((b.match(/<fxrt>([^<]+)<\/fxrt>/i) || [])[1]);
    const start = (b.match(/<aplyBgnDt>(\d{8})<\/aplyBgnDt>/i) || [])[1];
    if (v > 0) {
      const s = start ? `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}` : d;
      const end = new Date(Date.parse(s) + 6 * 864e5).toISOString().slice(0, 10);
      return { usdKrw: v, period: `${dot(s)}~${end.slice(5).replace('-', '.')}`, label: `과세환율 ${v.toLocaleString('ko-KR', { minimumFractionDigits: 2 })}원/달러 (${dot(s)}~${end.slice(5).replace('-', '.')} 관세청 고시)` };
    }
  }
  return null;
}

export async function loadRates(site) {
  const out = { customs: { ...site.fx, source: 'settings' }, pay: site.payFx ? { ...site.payFx, source: 'settings' } : null };
  if (process.env.KOREAEXIM_KEY) {
    try { const r = await eximbankUsd(process.env.KOREAEXIM_KEY); if (r) out.pay = { ...r, source: 'koreaexim' }; } catch (e) { console.warn('결제 환율 받기 실패, 저장된 값 사용:', e.message); }
  }
  const customsKey = process.env.DATA_GO_KR_KEY;
  if (customsKey) {
    try { const r = await customsUsd(customsKey); if (r) out.customs = { ...r, source: 'customs' }; } catch (e) { console.warn('과세환율 받기 실패, 저장된 값 사용:', e.message); }
  }
  return out;
}
