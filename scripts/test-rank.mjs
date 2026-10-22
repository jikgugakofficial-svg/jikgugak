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
// 관련 없는 상품(숫자만 겹침)은 빠져요
import { rank as rank2, queryVariants } from '../src/rank.js';
const junk = rank2([mk('남성 시계 200m 방수 2', 51000), mk('에어팟 2세대 무선 이어폰', 89000)], '에어팟2');
assert.equal(junk.length, 1);
assert.deepEqual(queryVariants('에어팟2'), ['에어팟 2', 'airpods 2']);
// 영어 상품명도 한글 검색어에 걸려요
assert.equal(rank2([mk('Apple AirPods 2nd gen wireless', 90000)], '에어팟').length, 1);
console.log('관련도 필터 점검 통과');
const ap = rank2([
  mk('아이폰 12/13/14/15/16/17용 3 in 1 무선 충전 스탠드 에어팟', 19750, 900),
  mk('AirPods 3 2 1 Pro 분실 방지 실리콘 이어폰 로프', 1574, 5000),
  mk('클리너 키트 이어폰 청소 펜 에어팟 프로 2 3 4 브러쉬', 2020, 8000)
], '에어팟2');
assert.ok(ap.every((x) => x.accessory), 'AirPods 액세서리는 모두 액세서리로');
assert.ok(rank2([mk('샤오미 로봇청소기 S10', 300000)], '로봇청소기')[0].accessory === false, '검색어에 있는 말은 액세서리로 안 봐요');
console.log('액세서리 판별 점검 통과');
