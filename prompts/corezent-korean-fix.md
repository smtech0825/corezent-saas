# CoreZent 한국어 번역 수정 작업

> 아래 내용을 읽고 이해한 내용을 확인해줘. 내가 승인하면 시작해.

---

## 작업 개요

사이트 전체 한국어 번역 품질 검사 결과를 바탕으로,  
**총 27건의 번역 문제**를 파일별로 직접 수정한다.

수정은 **우선순위 순서**로 진행한다.

---

## CRITICAL RULES

- 수정 대상 텍스트만 변경한다. 로직·스타일·구조 일절 건드리지 않는다.
- 브랜드명 `CoreZent`, `GenieStock`, `GeniePost`는 번역하지 않는다.
- `검토 필요` 항목은 수정 전 해당 항목을 채팅으로 보여주고 내 승인을 받은 후 수정한다.
- 각 파일 수정 후 변경 내용을 간략히 보고한다.

---

## 1단계 — 즉시 수정 (사용자 화면에 직접 노출, 우선순위 최상)

### 🔴 #1 웰컴 이메일 제목 영어 → 한국어

**파일**: `src/app/auth/callback/route.ts:78`

```
Before: subject: 'Welcome to CoreZent!'
After:  subject: 'CoreZent 가입을 환영합니다'
```

---

### 🔴 #2 다운로드 버튼 영어 → 한국어

**파일**: `src/app/dashboard/billing/DownloadButton.tsx:99`

```
Before: Download
After:  다운로드
```

> 같은 파일 내 단일 플랫폼 버튼은 이미 '다운로드'로 표기되어 있음. 멀티 플랫폼 버튼만 영어로 남아 있으니 해당 케이스만 수정한다.

---

### 🔴 #3·#4 라이선스 상태값 한글 매핑

**파일**: `src/app/activate/ActivateClient.tsx` (약 152, 157번째 줄)

현재 DB의 영문 상태값(`active`, `expired`, `cancelled`, `inactive` 등)이 화면에 그대로 노출되고 있음.  
상태값을 한글로 매핑하는 헬퍼 함수 또는 객체를 파일 상단에 추가하고, 해당 값을 출력하는 모든 위치에 적용한다.

```
매핑 규칙:
'active'    → '활성'
'expired'   → '만료'
'cancelled' → '해지'
'inactive'  → '비활성'
그 외        → 원본값 유지 (fallback)
```

적용 위치:
- `라이선스 ${result.status}` 형태로 상태를 텍스트에 삽입하는 부분
- `<Row label="상태" value={result.status} />` 형태로 상태를 출력하는 부분

---

### 🔴 #5 문의 폼 API 에러 메시지 전체 한국어화

**파일**: `src/app/api/contact/route.ts` (54~124번째 줄)

아래 영문 메시지를 모두 한국어로 교체한다.

```
'Too many requests...'              → '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
'All fields ... are required.'      → '모든 필수 항목을 입력해 주세요.'
'Invalid email format.'             → '이메일 형식이 올바르지 않습니다.'
'Subject must be 200 characters or less.' → '제목은 200자 이내로 입력해 주세요.'
'Attachment must be under 5 MB.'   → '첨부 파일은 5MB 이하만 업로드할 수 있습니다.'
```

> 위 목록 외에도 해당 파일에 영어로 된 사용자 노출 메시지가 있으면 같은 방식으로 자연스럽게 한국어화한다.

---

## 2단계 — 직역 오류 수정 ('당신' 표현 일괄 교체)

### 🟠 #10~13 '당신' 직역 표현 제거

아래 파일의 해당 텍스트를 수정한다.

| 파일 | 현재 텍스트 | 수정 텍스트 |
|------|------------|------------|
| `src/components/sections/ProductSection.tsx:113` | "당신을 위해 일하는 소프트웨어." | "나를 위해 일하는 소프트웨어" |
| `src/app/product/page.tsx:77` | "당신을 위해 일하는 소프트웨어." | "나를 위해 일하는 소프트웨어" |
| `src/components/sections/CTASection.tsx:26` | "당신의 일에 맞는 도구를 찾으세요." | "내게 맞는 도구를 찾아보세요" |
| `src/app/auth/_components/AuthBrand.tsx:35` | "당신의 소프트웨어, 하나의 계정으로." | "모든 소프트웨어를 하나의 계정으로" |

> `src/app/layout.tsx:28` 및 `src/app/page.tsx`의 메타 타이틀 "CoreZent — 당신을 위해 만든 소프트웨어"는 **브랜드 보이스 결정 사항**이므로 수정 전 내 승인을 받는다.

---

### 🟠 #9 요금제 소개 문구 수정

**파일**: `src/components/sections/PricingSection.tsx:181`

```
Before: "간단하고 정직한 요금제."
After:  "간단하고 투명한 요금제"
```

> `/pricing` 페이지에서 이미 '투명한'을 사용 중이므로 용어를 통일한다.  
> 마침표도 함께 제거한다 (헤딩 마침표 관련 #16 참고).

---

### 🟠 #15 문의 페이지 안내 문구 수정

**파일**: `src/app/contact/page.tsx:32`

```
Before: "질문, 피드백, 또는 제휴 문의가 있으신가요?"
After:  "질문, 피드백, 제휴 문의 무엇이든 환영합니다"
```

---

### 🟠 #14 섹션 eyebrow 텍스트 수정 (검토 필요)

**파일**: `src/components/sections/ProductSection.tsx:109`, `src/app/product/page.tsx:74`

```
Before: "우리 제품"
```

수정 전 아래 두 가지 옵션을 보여주고 내 선택을 받는다:
- `"제품 소개"` — 설명적, 무난한 표현
- `"제품 라인업"` — 브랜드 색감 있는 표현

---

### 🟠 #16 섹션 헤딩 마침표 제거 (검토 필요)

한국어 헤딩에는 마침표를 붙이지 않는 것이 일반적인 관행이다.  
아래 섹션 헤딩의 마침표를 일괄 제거하기 전, 변경 목록을 채팅으로 보여주고 내 승인을 받는다.

해당 파일:
- `src/components/sections/HeroSection.tsx`
- `src/components/sections/FeaturesSection.tsx`
- `src/components/sections/HowItWorksSection.tsx`
- `src/components/sections/FAQSection.tsx`
- `src/components/sections/TestimonialsSection.tsx`
- `src/components/sections/PricingSection.tsx`

예시:
```
"믿을 수 있는 소프트웨어."       → "믿을 수 있는 소프트웨어"
"처음부터 끝까지 간단하게."      → "처음부터 끝까지 간단하게"
"자주 묻는 질문."                → "자주 묻는 질문"
"실제 사용자들이 신뢰합니다."    → "실제 사용자들이 신뢰합니다"
```

---

## 3단계 — UI 용어 불일치 수정

### 🟡 #17 이름 fallback 한국어 통일

**파일**: `src/app/dashboard/layout.tsx:25`

```
Before: 'User'
After:  '회원'
```

> `dashboard/page.tsx`에서 이미 '회원'을 사용 중이므로 동일하게 맞춘다.

---

### 🟡 #18 제품명 fallback 한국어 통일

**파일**: `src/app/dashboard/page.tsx:54`, `src/app/dashboard/billing/page.tsx:68`

```
Before: 'CoreZent Product'
After:  'CoreZent 제품'
```

> `ActivateClient.tsx`에서 이미 'CoreZent 제품'을 사용 중이므로 동일하게 맞춘다.

---

### 🟡 #19 대시보드 명칭 통일 (검토 필요)

현재 같은 `/dashboard` 경로를 지칭하는 용어가 3가지 혼용 중:
- `"마이페이지"` (Navbar 일부)
- `"대시보드"` (Navbar 일부)
- `"내 대시보드"` (일부 페이지)

수정 전 현재 사용 위치 전체를 보여주고, 통일할 용어("대시보드" 권장)를 내가 선택한다.

---

### 🟡 #20 placeholder 콜론 표기 수정

**파일**: `src/app/dashboard/billing/BillingSubscriptionSection.tsx:311`

```
Before: "선택: 자세한 내용을 알려주세요…"
After:  "(선택) 자세한 내용을 알려주세요"
```

---

### 🟡 #21 라이선스 상태 배지 텍스트 수정 (검토 필요)

**파일**: `src/app/dashboard/licenses/page.tsx:136`

만료(`expired`)와 해지(`cancelled`)를 구분하지 않고 모두 "해지됨"으로 표시 중.  
수정 전 해당 로직을 보여주고, 아래 방식으로 처리할지 내 승인을 받는다.

```
'expired'   → "만료"
'cancelled' → "해지"
그 외 비활성  → "비활성"
```

---

### 🟡 #22 CTA 버튼 화살표 문자 제거 (검토 필요)

**파일**: `src/components/sections/CTASection.tsx:31`

```
Before: "무료 계정 만들기 →"
After:  "무료 계정 만들기"
```

> 화살표가 필요하다면 텍스트 문자 대신 아이콘 컴포넌트로 분리하는 것을 권장.  
> Hero 섹션은 화살표 없이 사용 중이므로 일관성을 위해 제거를 권장. 내 승인 후 수정.

---

### 🟡 #23 고객지원 띄어쓰기 통일

**파일**: `src/app/activate/ActivateClient.tsx:217`

```
Before: "고객 지원"  (띄어쓰기)
After:  "고객지원"   (붙여쓰기)
```

> 다른 페이지와 통일한다.

---

### 🟡 #24 계정 생성 로딩 텍스트 동사 통일

**파일**: `src/app/auth/register/RegisterForm.tsx:287`

```
Before (로딩 중 텍스트): "계정 생성 중..."
After:                   "계정을 만드는 중..."
```

> 버튼 기본 텍스트가 "계정 만들기"이므로 로딩 텍스트도 같은 동사로 통일한다.

---

## 4단계 — 표현 및 표기 수정

### 🟢 #25 구어체 표현 수정 (검토 필요)

**파일**: `src/components/sections/FeaturesSection.tsx:65`

```
Before: "사람이 직접 하는 진짜 지원"
After:  "사람이 직접 응대하는 지원"
```

> '진짜'는 구어체로 서비스 톤과 맞지 않을 수 있으므로 수정 전 내 승인을 받는다.

---

### 🟢 #26 외래어 표기 수정

**파일**: `src/components/Footer.tsx:50`

```
Before: "워크플로"
After:  "워크플로우"
```

> 국립국어원 외래어 표기법 기준 및 일반적 사용 관행에 맞게 수정한다.

---

### 🟢 #27 말줄임표 표기 통일 (검토 필요)

현재 로딩 텍스트에 `…`(유니코드 말줄임표)과 `...`(마침표 3개)가 혼용 중.

**해당 파일**:
- `src/app/activate/ActivateClient.tsx:120`
- `src/app/auth/update-password/UpdatePasswordForm.tsx:97`
- 기타 로딩 텍스트 포함 파일

두 파일 외에도 프로젝트 전체에서 로딩/대기 텍스트의 말줄임표 사용 현황을 먼저 조사하여 보여준다.  
내가 `…` 또는 `...` 중 하나를 선택하면 전체 일괄 통일한다.

---

## 5단계 — 추가 검토 항목 (수정 우선순위 낮음)

### ⚪ #6 제품 카테고리 필터 라벨 미사용 여부 확인

**파일**: `src/lib/products.ts:29-34`

`FILTER_LABELS`의 영문 라벨이 실제 화면에서 사용되는지 확인한다.  
- 미사용 확인 시: 제거하거나 한글로 교체 후 내 승인을 받는다.  
- 사용 중 확인 시: `{ all: '전체', 'Chrome Extension': '크롬 확장 프로그램', 'Desktop': '데스크톱', 'Web Tool': '웹 도구' }`로 교체한다.

---

### ⚪ #7 제품 카테고리 배지 영문 슬러그 노출

**파일**: `src/components/sections/ProductSection.tsx:161`, `src/app/product/ProductList.tsx:123`, `src/app/pricing/PricingClient.tsx:233`

`{product.category}` 영문 슬러그가 배지로 그대로 출력되는 위치를 확인한다.  
DB 값 의존 여부 확인 후, 한글 라벨 매핑 방식을 결정하고 내 승인을 받아 수정한다.

---

### ⚪ #8 구독 취소 API 영어 에러 메시지

**파일**: `src/app/api/subscriptions/cancel/route.ts`

프론트에서 이미 한국어로 대체 중인지 최종 확인한다.  
실제 사용자에게 영어 메시지가 노출될 가능성이 있으면 한국어로 교체한다.

---

## 작업 완료 후 보고 형식

모든 수정이 끝나면 아래 형식으로 요약 보고한다:

```
## 수정 완료 보고

### ✅ 즉시 수정 완료 (#1~5)
- #1: route.ts 이메일 제목 수정
- #2: DownloadButton.tsx 버튼 텍스트 수정
...

### ✅ 직역 오류 수정 완료 (#9~16)
...

### ✅ UI 용어 수정 완료 (#17~24)
...

### ✅ 표현·표기 수정 완료 (#25~27)
...

### ⏭ 승인 대기 중인 항목
- #13: 메타 타이틀 '당신' 표현 — 옵션 제시 후 대기
...

### ⏭ 추가 확인 필요 항목
- #6: FILTER_LABELS 미사용 여부 확인 후 대기
...
```
