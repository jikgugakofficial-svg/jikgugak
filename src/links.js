// 붙여 넣은 글에서 쇼핑몰 상품 주소를 알아봐요(사이트·브라우저·서버가 같이 써요).
// 알리: .../item/1005007099240050.html, .../i/1005....html, ?productId=1005...
// 제휴 단축 주소(s.click.aliexpress.com)나 앱 공유 단축 주소(a.aliexpress.com)는 열지 않아요(남의 제휴 클릭을 만들지 않게).
export function parseShopLink(text) {
  const s = String(text || '').trim();
  if (!/^https?:\/\/|aliexpress\.|coupang\.com|amazon\.|iherb\.com/i.test(s)) return null;
  const ali = s.match(/aliexpress\.[a-z.]+\/(?:item|i)\/(\d{9,20})\.html/i) || (/aliexpress\./i.test(s) && s.match(/[?&](?:productId|itemId|product_id)=(\d{9,20})/i));
  if (ali) return { store: 'aliexpress', id: ali[1] };
  if (/aliexpress\./i.test(s)) return { store: 'aliexpress', short: true };
  if (/coupang\.com/i.test(s)) return { store: 'coupang' };
  if (/amazon\./i.test(s)) return { store: 'amazon' };
  if (/iherb\.com/i.test(s)) return { store: 'iherb' };
  if (/^https?:\/\//i.test(s)) return { store: 'other' };
  return null;
}
