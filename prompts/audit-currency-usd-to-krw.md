# audit-currency-usd-to-krw

You are a senior Next.js 15 (App Router) / TypeScript engineer auditing the **CoreZent** web codebase. Goal: find **every place a price/amount is rendered to users**, so currency display can be switched from USD to KRW (표기만 KRW + "VAT 포함") without missing a spot. This is a **READ-ONLY 점검**. 코드는 한 줄도 고치지 말고, 위치만 파일:줄 근거로 보고.

## 점검 목적 (Steve의 작업)
LemonSqueezy 스토어 통화를 KRW로 바꾼다. 그런데 사이트 코드에 `$`·USD·달러 포맷이 하드코딩돼 있으면 그 화면은 LS 설정과 무관하게 여전히 달러로 보인다. → **금액을 사용자에게 보여주는 모든 지점**과 **통화 기호/포맷이 박힌 모든 곳**을 빠짐없이 찾아, KRW 전환 시 손볼 목록을 만든다. (실제 가격 숫자는 Steve가 LS·사이트에서 직접 정함 — 이 점검은 "어디를 고쳐야 하나"만.)

## STRICT RULES
- **READ-ONLY**: 코드/파일/git 변경·생성·삭제 0. 오직 읽고 보고. 수정안을 코드로 쓰지 말 것(방향만 글로).
- **추측 금지**: 모든 위치는 실제 파일을 연 `파일:줄` 근거.
- **빠짐없이**: 한 군데라도 놓치면 그 화면만 달러로 남는다. grep을 넓게 돌리고, 동적 렌더(컴포넌트로 금액 받는 곳)도 추적.
- **다른 작업자/다른 CC 세션 미커밋 변경 미접촉.**
- 각 위치마다: **①관찰(무슨 금액인가) ②근거(파일:줄) ③출처(하드코딩 $ 인지, DB값 포맷인지, LS에서 온 값인지) ④사용자 노출 화면(공개/대시보드/관리자/이메일).**

## STEP 0 — 금액 렌더 파이프라인 지도
가격/금액이 어디서 와서 어디로 출력되는지 흐름을 그린다:
- 가격 출처: `product_prices.price`(DB) / LS 웹훅이 넣는 `orders.total` 등 / LS 체크아웃(외부).
- 포맷 지점: 통화 기호·소수점·천단위 포맷을 입히는 공용 함수가 있는가(예: `formatPrice`, `formatCurrency`, `Intl.NumberFormat`). **있으면 거기 한 곳이 핵심 레버.** 없으면 화면마다 흩어진 것.

## 점검 항목 (각 파일:줄 근거)

### A. 통화 기호·USD 하드코딩 전수 grep
- `\$` 리터럴(템플릿/JSX/문자열), `USD`, `달러`, `usd`, `Intl.NumberFormat(...'USD'...)`, `currency: 'USD'`, `style: 'currency'`.
- `toFixed(2)`(달러식 소수 2자리)·`.99` 같은 가격 리터럴이 화면 문자열에 직접 박힌 곳.

### B. 공개 사이트 금액 표시
- 랜딩 Pricing 섹션, `/pricing`(`PricingClient.tsx`·`PricingSection.tsx`), 제품 카드(`ProductSection.tsx`), 요금제 카드(월/연 토글). 각 금액 출력 줄.

### C. 회원 대시보드 금액 표시
- `/dashboard/billing`(구독·결제 내역 금액), `/dashboard/licenses`, 대시보드 홈 통계 카드(총 주문/구독 금액). 각 금액 출력 줄.

### D. 관리자 금액 표시
- `/admin` 홈(총 매출 카드), `/admin/orders`(주문 금액·상태), `/admin/products`(가격 입력/표시), `/admin/affiliate`(크레딧 잔액·최소 출금액 등 $ 표기). 각 줄.

### E. 이메일·기타
- `lib/email.ts`의 주문확인 메일 HTML에 금액·통화가 들어가는지. 기타 PDF/영수증성 출력이 있으면.

### F. "VAT 포함" 표기 자리
- 가격 옆에 부가세 안내를 붙일 수 있는 위치(공용 포맷 함수가 있으면 거기, 없으면 각 카드). 현재 그런 문구가 전혀 없는지 확인.

### G. 공용 레버 유무 (가장 중요한 결론)
- 금액 포맷을 **한 곳에서** 처리하는 공용 함수/컴포넌트가 있는가?
  - **있으면**: 그 함수 1곳만 KRW로 바꾸면 대부분 해결 → 그 파일:줄과, 그걸 안 거치고 직접 $ 박은 예외 지점들을 목록화.
  - **없으면**: 흩어진 모든 지점이 개별 수정 대상 → 전수 목록 + "공용 함수로 모으는 것을 권장"까지 보고.

## 반드시 답할 결론
1. 금액 포맷 **공용 함수가 있는가/없는가** (있으면 파일:줄). → 작업이 "1곳 수정"인지 "N곳 수정"인지 가름.
2. USD/$ 가 박힌 **전체 위치 목록** (공개/대시보드/관리자/이메일별로 그룹).
3. "VAT 포함" 문구를 넣을 **위치 후보**.
4. KRW 전환 시 **주의점**(예: LS variant ID 불변 유지, DB price 값은 숫자라 통화중립인지, 환산 vs 정찰 중 무엇으로 보이는지).

## 출력 형식
```
🔍 통화(USD→KRW) 표기 점검 결과

[핵심] 금액 포맷 공용 함수: 있음(파일:줄) / 없음(흩어짐)
  → 작업 규모: 1곳 레버 / N곳 개별

[STEP 0 파이프라인] 가격 출처 → 포맷 → 출력
[A USD/$ 하드코딩 전수] 파일:줄 목록
[B 공개 사이트] …
[C 대시보드] …
[D 관리자] …
[E 이메일·기타] …
[F VAT 포함 자리] …

[KRW 전환 주의점]
- LS variant ID …
- DB price 통화중립 여부 …

확인 필요(불명확) 항목: …
```

코드/DB/파일/git 변경 없음. 수정은 별도 승인 후 fix 프롬프트로.
