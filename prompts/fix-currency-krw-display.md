# fix-currency-krw-display

You are a senior Next.js 15 (App Router) / TypeScript engineer on the **CoreZent** web codebase. Switch **price display** from USD (`$x.xx`) to KRW (`₩9,900 (VAT 포함)`) by introducing one shared formatter and routing price-card displays through it. Work Wave by Wave; stop and report at each Wave end.

## 확정된 전제 (Steve 결정)
- LemonSqueezy 스토어 통화는 이미 KRW로 전환됨. LS 체크아웃 화면은 KRW로 정상 표시됨. **이 작업은 "우리 사이트 화면의 표시"만 KRW화한다.**
- **DB `product_prices.price`에는 원화 정수**가 들어간다(예 9900 → `₩9,900`). 달러식 소수(6.99) 아님. (가격 숫자 입력은 Steve가 직접 — 코드는 정수를 콤마 포맷만.)
- **이번 범위 = 가격(상품/요금제) 표시만.** `orders.amount` 기반 **매출·결제내역 표시는 제외**(첫 KRW 주문으로 cents 단위 확정 후 별도). 점검에서 확인된 100배 오차 위험 회피.

## 점검으로 확인된 사실 (audit-currency-usd-to-krw 결과)
- 공용 포맷 함수 없음. `$`·USD 포맷이 약 15개 파일에 흩어짐(인라인 `$${x.toFixed(2)}`, 파일별 `fmtCurrency` 중복, `usd()`, `formatCents()`).
- 가격 출처 = `product_prices.price`(통화 중립 숫자). 공개 카드가 `.toFixed(2)` + `$`로 출력.
- 매출 출처 = `orders.amount`(정수 cents, /100 표시) — **이번 범위 밖.**
- ※ 위 줄번호는 출발점. 실제 코드를 열어 확인.

## STRICT RULES
- **추측 금지**: 본 문서·점검의 경로·줄번호는 출발점. 실제 코드를 연 `파일:줄` 근거 위에서만.
- **보편 해결 / 하드코딩 금지**: 통화 기호·VAT 문구·로케일을 화면마다 박지 말고 **공용 함수 한 곳**에서. 단 매출(orders.amount) 경로는 이번에 건드리지 말 것.
- **결제 연결 불변**: `product_prices.checkout_url`·`lemon_squeezy_variant_id`·웹훅 매칭 로직 미접촉. LS 결제 흐름과 무관한 "표시"만.
- **in-place 수정·지정 파일만·무관 리팩터 금지.**
- **다른 작업자/다른 CC 세션 미커밋 변경 미접촉.** `git add .` 금지(변경 파일만 개별 add). **Wave 중 push 금지**(최종에서만).
- **각 Wave 끝 검증**: `npx tsc --noEmit` + `npm run build` 통과 + `bug-detective`(+`code-guardian`) Critical/High 0 → 변경 파일만 개별 커밋 → 멈추고 보고 → 승인 후 다음.
- 각 작업 보고: **①관찰 ②근거(파일:줄) ③공용 영향 범위 ④결정적 코드임.**

## 범위 밖 (이번에 하지 말 것)
- `orders.amount`/매출·결제내역 표시: `dashboard/billing`, `dashboard/page.tsx` 최근주문 금액, `admin/page.tsx` 매출 카드, `admin/orders`, `admin/users` 주문금액 → **전부 이번 범위 제외**(첫 KRW 주문 후 cents 단위 확정 뒤 별도 fix).
- 제휴 금액(`*_cents` 기반 크레딧/커미션): cents 단위 의존이라 이번 제외(매출과 함께 나중).
- DB `product_prices.price` 값 자체 입력(원화 정수로): Steve가 관리자/DB에서 직접. 코드는 값을 포맷만.
- 관리자 CMS(공지 배너·랜딩 섹션·FAQ)에 입력된 `$` 텍스트: DB 콘텐츠라 코드 밖 → Steve가 admin/content에서 직접.

---

## WAVE 1 — 공용 포맷 함수 신설
- `src/lib`에 가격 표시 공용 함수 신설(예 `formatPrice(value: number, opts?: { vat?: boolean }): string`).
  - 입력: 원화 정수(예 9900). 출력: `₩9,900`. `vat:true`면 `₩9,900 (VAT 포함)`.
  - 천단위 콤마(`Intl.NumberFormat('ko-KR')` 또는 동등). **소수점 없음**(KRW zero-decimal). `.toFixed(2)` 쓰지 말 것.
  - 통화 기호·로케일·VAT 문구는 이 함수에만. (향후 1곳 레버화)
  - null/undefined/NaN 방어(빈 값이면 안전한 기본 표시).
- 이 Wave에선 함수만 추가하고 화면 교체는 안 함(또는 함수+검증만). 단위테스트 가능하면 추가(없으면 build로 갈음).
검증 → 변경 파일만 커밋 → **STOP & 보고.**

## WAVE 2 — 공개 사이트 가격 카드 교체
점검 B의 공개 사이트 가격 표시를 전부 `formatPrice(price, { vat:true })`로 교체:
- `components/sections/PricingSection.tsx`(:86,93,94,106,108 부근), `components/sections/ProductSection.tsx`(:83-84 생성/:205,210 표시), `app/pricing/PricingClient.tsx`(:245,254,258,264,268 부근), `app/product/ProductList.tsx`(:169,174 부근).
- 월/연 라벨("/월","/년","/mo","/yr")은 유지하되 금액부만 함수로. `$`·`.toFixed(2)` 제거.
- "VAT 포함"은 함수가 출력(중복 표기 금지 — 카드에 또 적지 말 것).
- Navbar 배너 코드 fallback "월 $9부터"(`Navbar.tsx:52-53`)도 KRW 문구로(단 DB banner 우선이면 fallback만 수정).
검증 → 커밋 → **STOP & 보고.**

## WAVE 3 — 관리자 "상품 가격" 표시·입력 라벨만
**주의: 매출(orders.amount)·제휴 cents는 제외.** 상품 가격(`product_prices.price`) 표시·입력만:
- `admin/products/page.tsx`(:45 가격 목록 표시) + `admin/products/ProductList.tsx`(:127-128) → `formatPrice`로.
- `admin/products/ProductForm.tsx:677` 가격 입력 라벨 "가격 (USD)" → "가격 (원, KRW)" 류로. (입력값은 원화 정수임을 라벨로 안내)
- admin 홈 매출 카드·orders·users 주문금액은 **건드리지 말 것**(범위 밖).
검증 → 커밋 → **STOP & 보고.**

## 최종 (모든 Wave 승인 후에만)
- 전체 회귀(`tsc` + `build` + 에이전트 Critical/High 0).
- `git push origin main`(Vercel 배포). Wave 중 push 금지.
- `result-explainer-ko` 비개발자 요약: 무엇이 KRW로 바뀌었나 / Steve가 할 일(관리자에서 product 가격을 원화 정수로 입력, admin/content의 $ 문구 직접 수정) / 아직 USD로 남아있는 곳(매출·결제내역·제휴 — 첫 KRW 주문 후 별도 작업 예정)·그 이유.

## 진행 중 멈춤 규칙
- `product_prices.price`가 일부 행에서 여전히 달러식 소수(6.99)면, 코드는 그대로 정수 가정 포맷만 하고 **"값 자체는 Steve가 원화 정수로 갱신해야 한다"를 보고에 명시**(코드가 임의 환산/×100 하지 말 것 — 환산은 사고의 원천).
- 매출/제휴 cents 경로가 가격 카드와 같은 컴포넌트에 얽혀 분리가 모호하면, 추측 말고 멈추고 보고.
