// 붙여 넣은 글에서 쇼핑몰 상품 주소를 알아봐요(사이트·브라우저·서버가 같이 써요).
// 알리: .../item/1005007099240050.html, .../i/1005....html, ?productId=1005...
// 제휴 단축 주소(s.click.aliexpress.com)나 앱 공유 단축 주소(a.aliexpress.com)는 열지 않아요(남의 제휴 클릭을 만들지 않게).
export function parseShopLink(text) {
  const s = String(text || '').trim();
  if (!/^https?:\/\/|aliexpress\.|coupang\.com|amazon\.|iherb\.com/i.test(s)) return null;
  const ali = s.match(/aliexpress\.[a-z.]+\/(?:item|i)\/(\d{9,20})\.html/i) || (/aliexpress\./i.test(s) && s.match(/[?&](?:productId|itemId|product_id)=(\d{9,20})/i));
  if (ali) return { store: 'aliexpress', id: ali[1] };
  if (/aliexpress\./i.test(s)) return { store: 'aliexpress', short: true };
  // 쿠팡: 상품 번호만 알 수 있어요(이름은 주소에 없어요). 단축 주소(link.coupang.com·coupa.ng)는 열지 않아요.
  if (/coupang\.com|coupa\.ng/i.test(s)) { const m = s.match(/coupang\.com\/vp\/products\/(\d+)/i); return { store: 'coupang', id: m ? m[1] : '' }; }
  // 아마존: 주소 속 상품 이름 부분과 ASIN(/dp/…)을 읽어요(페이지는 열지 않아요)
  if (/amazon\.|amzn\./i.test(s)) {
    const asin = (s.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i) || [])[1] || '';
    const slug = (s.match(/amazon\.[a-z.]+\/([^/?#]+)\/(?:dp|gp)\//i) || [])[1] || '';
    return { store: 'amazon', id: asin.toUpperCase(), name: slugName(slug) };
  }
  // 아이허브: /pr/상품-이름/번호
  if (/iherb\.com/i.test(s)) {
    const m = s.match(/iherb\.com\/pr\/([^/?#]+)\/(\d+)/i);
    return { store: 'iherb', id: m ? m[2] : '', name: m ? slugName(m[1]) : '' };
  }
  if (/^https?:\/\//i.test(s)) return { store: 'other' };
  return null;
}

// 주소 속 상품 이름(Sony-WH-1000XM5-Wireless-Headphones…)을 검색어로: 앞쪽 단어 몇 개만
function slugName(slug) {
  try { slug = decodeURIComponent(slug); } catch {}
  const words = String(slug || '').replace(/[-_+]+/g, ' ').replace(/[^\p{L}\p{N} .]/gu, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 6).join(' ');
}
