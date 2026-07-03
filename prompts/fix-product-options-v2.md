# fix-product-options-v2 (이전 fix-product-option-selector 대체)

You are a senior Next.js 15 (App Router) / TypeScript / Supabase / Tailwind v4 engineer on the **CoreZent** web codebase (멀티 상품 SaaS 스토어, 결제=Lemon Squeezy). 이전 설계(옵션 조합마다 상품을 통째로 등록)는 **폐기**한다. 표준 쇼핑몰 방식 — **상품 1개 + 옵션 행(행마다 라벨·가격·Variant ID·Checkout URL)** — 으로 만든다. 이전 fix-product-option-selector 작업으로 이미 커밋된 변경이 있으면 이 설계와 충돌하는 부분을 정리(되돌리기/재사용 판단 후 보고)한다. **사전 점검 불필요 — 바로 작업.** 애매하면 멈추고 한국어로 보고.

## ★ 확정 설계 (표준 쇼핑몰 구조)
- **상품(products) = 1개**: 이름·설명·이미지 등 상품 정보는 한 번만. 예: "GenieWork" 상품 1개. slug는 family 식별용(예 `geniework` — family 토큰 필수).
- **옵션 행 = product_prices**: 이미 존재하는 "상품 1 : 가격 행 N" 구조를 옵션으로 확장. **각 옵션 행에**: 옵션 라벨(자유 텍스트, 축 최대 2개: 예 주기=월간·수량=3PC), 가격, `lemon_squeezy_variant_id`, checkout URL, **license_tier**(1pc/3pc/5pc/10pc/lite/pro/max 등 — 라이선스 발급용), is_active. 
  - 기존 product_prices에 없는 컬럼(옵션 라벨·checkout_url·license_tier 등)은 비파괴 ADD COLUMN 마이그레이션. checkout_url이 이미 products 쪽에 있으면 행 단위로 이동/보강 판단 후 보고.
- **관리자 UI(핵심)**: 상품 편집 화면 안에 **옵션 표** — 행 추가/수정/삭제(비활성). 각 행: 옵션1 라벨·옵션2 라벨·가격(원화 정수)·Variant ID·Checkout URL·(tier). 일반 쇼핑몰 옵션 관리처럼 한 화면에서. 상품을 새로 만들 필요 없음.
- **공개 카드**: 상품 1개 카드 → 옵션 축별 **드롭다운**(등록된 라벨에서 자동 생성) + **수량 선택**(1~N) → 선택 조합의 옵션 행 가격 × 수량 **즉시 갱신** → 구매 버튼은 그 행의 checkout URL(+LS quantity 파라미터, URL 지원 확인·불가 시 보고). 미등록 조합은 비활성/제외.
- **웹훅(유일한 파이프라인 변경 — 신중)**: 웹훅은 이미 variant_id로 product_prices 행을 찾음. **tier를 slug 파싱 대신 "그 옵션 행의 license_tier 컬럼"에서 읽도록** 변경. 컬럼이 비어있으면 **기존 slug 파싱으로 fallback**(기존 상품 호환·회귀 방지). family 판정은 지금처럼 product.slug의 family 토큰 유지. HMAC·멱등성·그 외 발급 로직 미접촉.

## 기존 데이터 이행 (Steve 부담 최소화)
- 현재 조합별로 등록된 상품(geniework_*_* 여러 개)이 있으면: **대표 상품 1개만 남기고 나머지를 옵션 행으로 흡수**하는 이행 절차를 설계·보고(마이그레이션 SQL 예시 포함, 실행은 Steve). ⚠️ orders/subscriptions의 FK(product_price_id 등)가 기존 행을 참조하므로 **행 삭제 금지** — 비활성/재배치 등 비파괴 방식. 이행이 복잡하면 절차만 보고하고 멈춤.

## 공통 STRICT RULES
- 막히거나 애매하면 추측 말고 멈추고 한국어로 보고.
- 보편 해결 / 하드코딩 금지. "geniework 전용" 분기 금지 — 어떤 제품군이든 같은 옵션 구조.
- **결제·라이선스 핵심**: 위 웹훅 tier 변경 외 미접촉. 변경분은 fallback 포함, 최종 단계에서 **테스트 구매 검증 시나리오** 명시(한국어 상품명·옵션 선택·수량 포함, LS키가 DB 저장·tier 정확).
- 가격 표시는 formatPrice 재사용. orders.amount는 cents(÷100) 규칙 유지.
- 다른 작업자 미커밋 변경 미접촉. `git add .` 금지. Wave 중 push 금지.
- **각 Wave 끝**: `npx tsc --noEmit` + `npm run build` 통과 → 변경 파일만 개별 커밋 → 멈추고 보고. **(bug-detective·code-guardian은 최종에 한 번만.)**
- 보고: ①관찰 ②근거(파일:줄) ③공용 영향 범위 ④결정적 코드임. 한국어.
- 스키마 변경은 마이그레이션 파일만(비파괴·기본값 명시), 적용은 Steve가 직접.

---

## WAVE 1 — 스키마 + 웹훅 tier 읽기 변경
- product_prices에 필요한 컬럼 추가 마이그레이션: 옵션 라벨(축1/축2, 자유 텍스트)·checkout_url(행 단위, 없으면)·license_tier. 축 이름(카드에 보일 "주기"/"PC 수" 같은 제목)은 products 쪽 컬럼 또는 단순한 위치 — 판단 후 보고.
- 웹훅 createLicense의 tier 결정: **priceRow.license_tier 우선, 없으면 기존 slug 파싱 fallback.** 이 변경의 파일:줄과 fallback 동작을 보고에 명시.
- 기존 상품 이행 절차(위 "기존 데이터 이행") 설계·SQL 예시 포함 보고.
검증 → 커밋 → **STOP & 보고.**

## WAVE 2 — 관리자 옵션 표 UI
- 상품 편집 화면에 옵션 행 표: 추가/수정/비활성. 각 행 입력: 옵션1·옵션2 라벨, 가격(정수), Variant ID, Checkout URL, tier. 기존 가격 행 편집 UI가 있으면 그것을 옵션 표로 확장(중복 UI 금지).
- 저장은 3단계에서 다진 에러 표면화 패턴 유지(조용한 실패 금지). UNIQUE 인덱스(활성 플랜 중복 방지)와 충돌하는 입력은 에러 안내.
검증 → 커밋 → **STOP & 보고.**

## WAVE 3 — 공개 카드 (드롭다운 + 수량 + 가격 갱신)
- 상품 카드: 옵션 축 드롭다운(라벨 자동 생성·중복 제거·등록순) + 수량(1~N) → 가격 즉시 갱신(조합 가격 × 수량) → 구매 버튼 = 해당 행 checkout URL + LS quantity 파라미터(URL 지원 확인, 불가 시 보고).
- **웹훅 수량 처리 확인(보고만)**: 수량 N 결제 시 라이선스 N개 발급되는지 확인해 사실 보고 — 발급 로직 변경은 승인 후 별도.
- 미등록 조합 비활성. 옵션 없는 상품(행 1개)은 드롭다운 없이 기존처럼. 모바일 깨짐 없게.
- /pricing·랜딩 등 기존 가격 카드 렌더와의 정합(같은 데이터 출처) 확인.
검증 → 커밋 → **STOP & 보고.**

## 최종 (모든 Wave 승인 후에만)
- 전체 회귀: tsc + build → **bug-detective + code-guardian 이때 한 번만** → Critical/High 0.
- 마이그레이션·이행 SQL은 Steve가 직접 적용(순서 명시).
- **한 번만 git push origin main.**
- **테스트 구매 검증 시나리오 명시**: 옵션(예 월간+3PC)·수량 선택 → 결제 → ①본체 licenses에 LS키 ②GW license_keys에 tier=3pc ③대시보드 표시 ④기존 1PC 월간(이행된 행)도 정상. 
- result-explainer-ko 요약 + Steve가 할 일(마이그레이션·기존 상품 이행·옵션 행 입력 방법).

## 멈춤 규칙
- 기존 조합별 상품의 이행(FK 얽힘)이 복잡하면 절차만 보고하고 실행 설계 승인 대기.
- LS quantity URL 미지원이면 구현 전 보고.
- 웹훅 tier 변경이 fallback으로도 위험해 보이면 즉시 보고.
- UNIQUE 인덱스(032)와 옵션 행 구조가 충돌하면(같은 type/interval 다중 tier 행) 인덱스 조정 필요 여부 보고 — 임의 변경 금지.
