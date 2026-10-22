// 빌드할 때 최신 환율을 받아와요. 키가 없거나 실패하면 data/settings.json 값을 그대로 써요(빌드는 절대 멈추지 않음).
// - 결제 환율(매매기준율): 한국수출입은행 환율 API, Vercel 환경 변수 KOREAEXIM_KEY
// - 과세환율(관세청 주간 고시): 관세청 UNI-PASS 관세환율 API, Vercel 환경 변수 UNIPASS_FX_KEY
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

// 매매기준율: 주말·공휴일·오전 11시 전에는 빈 값이 와서 최근 7일을 거슬러 찾아요
async function eximbankUsd(key) {
  for (let i = 0; i < 7; i++) {
    const d = kstDate(i);
    const text = await getText(`https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${encodeURIComponent(key)}&searchdate=${ymd(d)}&data=AP01`);
    let rows;
    try { rows = JSON.parse(text); } catch { continue; }
    const usd = Array.isArray(rows) && rows.find((r) => r.cur_unit === 'USD');
    if (usd && num(usd.deal_bas_r) > 0) {
      const v = num(usd.deal_bas_r);
      return { usdKrw: v, date: d, label: `결제 환율(매매기준율) ${v.toLocaleString('ko-KR', { minimumFractionDigits: 2 })}원/달러 (${dot(d)} 한국수출입은행)` };
    }
  }
  return null;
}

// 과세환율: 수입(imexTp=2) 기준, 응답 XML에서 USD 줄을 찾아요
async function unipassUsd(key) {
  const d = kstDate(0);
  const xml = await getText(`https://unipass.customs.go.kr:38010/ext/rest/trifFxrtInfoQry/retrieveTrifFxrtInfo?crkyCn=${encodeURIComponent(key)}&qryYymmDd=${ymd(d)}&imexTp=2`);
  const blocks = xml.split(/<trifFxrtInfoQryRsltVo>/i).slice(1);
  for (const b of blocks) {
    if (!/<currSgn>\s*USD\s*<\/currSgn>/i.test(b)) continue;
    const v = num((b.match(/<fxrt>([^<]+)<\/fxrt>/i) || [])[1]);
    const start = (b.match(/<aplyBgnDt>(\d{8})<\/aplyBgnDt>/i) || [])[1];
    if (v > 0) {
      const s = start ? `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}` : d;
      const end = new Date(Date.parse(s) + 6 * 864e5).toISOString().slice(0, 10);
      return { usdKrw: v, label: `과세환율 ${v.toLocaleString('ko-KR', { minimumFractionDigits: 2 })}원/달러 (${dot(s)}~${end.slice(5).replace('-', '.')} 관세청 고시)` };
    }
  }
  return null;
}

export async function loadRates(site) {
  const out = { customs: { ...site.fx, source: 'settings' }, pay: site.payFx ? { ...site.payFx, source: 'settings' } : null };
  if (process.env.KOREAEXIM_KEY) {
    try { const r = await eximbankUsd(process.env.KOREAEXIM_KEY); if (r) out.pay = { ...r, source: 'koreaexim' }; } catch (e) { console.warn('결제 환율 받기 실패, 저장된 값 사용:', e.message); }
  }
  if (process.env.UNIPASS_FX_KEY) {
    try { const r = await unipassUsd(process.env.UNIPASS_FX_KEY); if (r) out.customs = { ...r, source: 'unipass' }; } catch (e) { console.warn('과세환율 받기 실패, 저장된 값 사용:', e.message); }
  }
  return out;
}
