// 검색 순위 점검: npm run test:rank
import assert from 'node:assert/strict';
import { tokenize, rank } from '../src/rank.js';

assert.deepEqual(tokenize('에어팟2'), ['에어팟', '2']);
assert.deepEqual(tokenize('MX Master 3S'), ['mx', 'master', '3s']);

const mk = (title, price, orders = 100) => ({ id: title, title, price, orders });
const airpods = [
  mk('에어팟 2 실리콘 케이스 키링 포함 귀여운 커버', 1900, 50000),
  mk('에어팟 프로 2 호환 키링 스트랩', 1200, 30000),
  mk('애플 에어팟 2세대 유선 충전 케이스 정품', 139000, 800),
  mk('에어팟 2세대 무선 이어폰 블루투스', 89000, 2000),
  mk('에어팟용 보호필름 2매', 900, 9000),
  mk('TWS 블루투스 이어폰 에어팟 스타일', 9000, 40000),
  mk('에어팟 2 2024 신형 무선 이어폰', 79000, 500)
];
const r = rank(airpods, '에어팟2');
console.log(r.map((x) => `${x._score}\t${x.accessory ? '[액세서리]' : ''}${x.title}  (${x._why})`).join('\n'));
assert.ok(!r[0].accessory, '1위는 본품이어야 해요');
assert.ok(r.slice(0, 3).every((x) => !/키링|보호필름/.test(x.title)), '상위 3개에 키링·필름 없어야 해요');
// 검색어가 액세서리면 액세서리가 위로
const r2 = rank(airpods, '에어팟 케이스');
assert.ok(/케이스/.test(r2[0].title), '케이스 검색은 케이스가 1위');
// 숫자 2가 2024에 걸리지 않음
const r3 = rank([mk('갤럭시 버즈 2024', 50000), mk('갤럭시 버즈 2 프로', 60000)], '버즈2');
assert.equal(r3[0].title, '갤럭시 버즈 2 프로');
console.log('검색 순위 점검 통과');
