# 블프 페이지 아마존 한국 배송 확인표 (운영자용, 11/11까지)

11/6 법정 조건 ①: 아마존이 Claude 브라우저 접속을 막아서(“허가 안 된 AI 접속은 이용약관 위반”) **운영자가 본인 브라우저에서** 확인해요. 매니저(Claude)는 아마존 화면을 열지 않아요.

## 하는 법 (19개, 15~20분)
1. 아마존 오른쪽 위 배송지를 **대한민국**으로 해 두세요(로그인은 필요 없어요).
2. 아래 주소를 하나씩 여세요. **제휴 태그 없는 일반 주소**예요. 직구각 사이트의 '아마존에서 보기' 버튼(tag=jikgugak-20)으로 확인하지 마세요(자기 클릭은 제휴 규칙 위반이 될 수 있어요).
3. 상품마다 두 가지만 봐요.
   - **한국 배송:** 가격 아래에 "대한민국으로 배송" 또는 "Ships to Republic of Korea"가 보이면 ○, "이 상품은 선택한 배송지로 배송할 수 없어요" 같은 문구면 ✕.
   - **판매·배송:** "Ships from Amazon / Sold by Amazon(Amazon.com)"이면 ○, 다른 판매자면 판매자 이름만.
4. **가격은 적지 마세요.** 아마존 가격은 사이트에 쓰지 않아요(약관).
5. 다 보시면 채팅에 "1 ○○, 2 ○✕ …"처럼 번호만 보내 주세요. 매니저가 이 표에 옮겨요.

## 이미 등록된 아마존 상품 13개 (목표가 표 후보)
| # | 상품 | 주소 | 한국 배송 | 판매·배송 Amazon |
| --- | --- | --- | --- | --- |
| 1 | 레고 다육식물 10309 | https://www.amazon.com/dp/B09Q4GWMZQ | | |
| 2 | 레고 플라워 부케 10280 | https://www.amazon.com/dp/B08HW1L75J | | |
| 3 | 레고 들꽃 부케 10313 | https://www.amazon.com/dp/B0BGQL5B3Q | | |
| 4 | 소니 WH-1000XM6 | https://www.amazon.com/dp/B0F3PQHWTZ | | |
| 5 | 로지텍 MX Master 3S (그래파이트) | https://www.amazon.com/dp/B0B11LJ69K | | |
| 6 | 크록스 클래식 클로그 10001 (블랙) | https://www.amazon.com/dp/B0014C0LUC | | |
| 7 | 스탠리 퀜처 H2.0 40oz(1.18L) | https://www.amazon.com/dp/B0CP9Z1S51 | | |
| 8 | 타임모어 C3S (체스트넛) | https://www.amazon.com/dp/B0CC4ZNBKL | | |
| 9 | 젠하이저 HD 600 | https://www.amazon.com/dp/B00004SY4H | | |
| 10 | 보스 QC 울트라 헤드폰 2세대 | https://www.amazon.com/dp/B0FDKR293G | | |
| 11 | 오디오테크니카 ATH-M50x (블랙) | https://www.amazon.com/dp/B00HVLUR86 | | |
| 12 | 에어로프레스 오리지널 | https://www.amazon.com/dp/B0047BIWSK | | |
| 13 | 삼성 T7 Shield 1TB (블랙) | https://www.amazon.com/dp/B09VLK9W3S | | |

## 블프 새 후보 6개 (○면 등록 검토)
| # | 상품 | 주소 | 한국 배송 | 판매·배송 Amazon |
| --- | --- | --- | --- | --- |
| 14 | 젠하이저 HD 599 SE | https://www.amazon.com/dp/B07RFNZYJZ | | |
| 15 | 비츠 스튜디오 프로 | https://www.amazon.com/dp/B0CMZQNDR4 | | |
| 16 | 보스 QC 헤드폰(울트라 아님) | https://www.amazon.com/dp/B0CCZ26B5V | | |
| 17 | 레고 10314 말린꽃 센터피스 | https://www.amazon.com/dp/B0BGQLZ921 | | |
| 18 | 레고 10359 파운틴 가든 | https://www.amazon.com/dp/B0DJ1BM44M | | |
| 19 | 레고 10317 랜드로버 디펜더 90 | https://www.amazon.com/dp/B0BSR933M2 | | |

## 결과를 받으면 (매니저)
- ○인 상품은 `data/products.json`에 `"krShip": "2026.11.xx 운영자 확인"`을 넣어요. 이 값이 있는 상품만 `/deals/blackfriday` 목표가 표에 들어가요(11/6 매니저 구현). ✕는 `unavailable`에 이유를 적어요.
- ✕는 목표가 표에서 빼요. 표에 남는 게 6개 미만이면 표 없이 열어요(법정 조건 ③).
- 새 후보 ○는 쿠팡가(공식 API 11/6 값, 가능하면 화면 확인)와 같은 제품 확인을 거쳐 등록해요.
