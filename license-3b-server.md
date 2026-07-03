# 3-B 라이선스 — 서버 측 (CoreZent_SaaS) 구현 프롬프트

> 대상: CoreZent_SaaS 프로젝트 폴더 (GenieWork PC에 복사됨)
> ★작업자: GenieWork 매니저가 코드 수정 / git은 CoreZent 매니저가
> 선행: 이게 먼저 끝나야 클라이언트가 검증 가능.

═══════════════════════════════════════════
# ★ git 분리 방침 (중요)
═══════════════════════════════════════════
```
- GenieWork 매니저: CoreZent_SaaS 코드 "수정만" 함
- ★CoreZent_SaaS git 커밋·push 절대 안 함 (변경만 만들어둠)
- 작업 후 "변경 내역서" 작성 (CoreZent 매니저 검토용):
  · 변경 파일 목록
  · 각 파일 변경 내용 (★geniestock·GeniePost 무변경 강조)
  · Supabase 마이그레이션 SQL (실행 필요분)
  · "기존 제품 경로 무영향" 확인
- CoreZent 매니저가 검토 후 커밋·push·마이그레이션 실행
- 이유: CoreZent는 GenieStock·GeniePost 공유 서버 →
  다른 제품 영향 검토는 그 주인이
```

> 선행: 이게 먼저 끝나야 클라이언트가 검증 가능.

═══════════════════════════════════════════
# 확정 결정
═══════════════════════════════════════════
```
- 단일 버전·tier 없음 → tier 컬럼을 PC 대수로 재활용
  tier = "1pc"|"3pc"|"5pc"|"10pc"
  HWID_LIMITS = { "1pc":1, "3pc":3, "5pc":5, "10pc":10 }
- product = "geniework" (geniestock과 구분)
- 가격: 단일 19,000원 × PC 대수 (LemonSqueezy 상품: GenieWork 1PC/3PC/5PC/10PC)
- 오프라인 유예 24h (클라이언트 측·서버 무관)
```

═══════════════════════════════════════════
# Step 1: Supabase product 컬럼 추가
═══════════════════════════════════════════
```sql
-- license_keys (라이선스 전용 Supabase 프로젝트)
ALTER TABLE license_keys ADD COLUMN product TEXT NOT NULL DEFAULT 'geniestock';
ALTER TABLE license_keys ADD CONSTRAINT license_keys_product_check
  CHECK (product IN ('geniestock','geniework'));
CREATE INDEX idx_license_keys_product ON license_keys(product);

-- ★tier CHECK 제약 확장 (PC 대수 값 허용)
-- 기존: CHECK (tier IN ('lite','pro','max'))
-- geniework는 tier에 1pc/3pc/5pc/10pc 들어감
ALTER TABLE license_keys DROP CONSTRAINT license_keys_tier_check;
ALTER TABLE license_keys ADD CONSTRAINT license_keys_tier_check
  CHECK (tier IN ('lite','pro','max','1pc','3pc','5pc','10pc'));
```
★ 기존 geniestock 데이터 무영향 (product 기본값 geniestock·tier 기존값 유지)
★ 마이그레이션 후 기존 행 SELECT 확인

═══════════════════════════════════════════
# Step 2: webhook geniework 분기
═══════════════════════════════════════════
```
파일: src/app/api/webhooks/lemonsqueezy/route.ts

[헬퍼 일반화 (옵션 A)]
isSupabaseProduct(name): 'geniestock'|'geniework'|null
  - geniestock 키워드 → 'geniestock'
  - geniework 키워드 → 'geniework'

[GenieWork tier 파싱 — PC 대수]
tierFromGenieWork(name): '1pc'|'3pc'|'5pc'|'10pc'|null
  - 상품명에서 "1PC"|"3PC"|"5PC"|"10PC" 매칭 (대소문자 무시)
  - 예: "GenieWork 3PC" → "3pc"
  ★ geniestock은 기존 tierFromProductName(lite/pro/max) 그대로

[createLicense 분기]
const slug = isSupabaseProduct(productNameRaw);
if (slug === 'geniework') {
  const tier = tierFromGenieWork(productNameRaw);  // 1pc~10pc
  supaInsertLicense({ ..., tier, product: 'geniework' });
} else if (slug === 'geniestock') {
  // 기존 로직 그대로 (product: 'geniestock')
}
```
★ supaInsertLicense에 product 필드 추가
★ geniestock 경로 무변경

═══════════════════════════════════════════
# Step 3: /api/license/* product 분기
═══════════════════════════════════════════
```
validate/upgrade/reset/route.ts 각각:

기존: if (product === 'geniestock') return validateGenieStock(...)
확장: if (product === 'geniestock' || product === 'geniework')
        return validateSupabase(key, hwid, product)
      // 그 외 → Google Sheets (GeniePost)

_lib_supabase.ts:
  - findLicenseByKey: WHERE license_key=? AND product=? (product 필터 추가)
  - insertLicense: product 필드 포함
  - HWID 한도: HWID_LIMITS에 1pc~10pc 추가
    { lite:1, pro:2, max:3, '1pc':1, '3pc':3, '5pc':5, '10pc':10 }
```
★ geniestock 동작 무변경 (product 필터가 기존도 geniestock으로 매칭)

═══════════════════════════════════════════
# 검증
═══════════════════════════════════════════
```
□ 마이그레이션 후 기존 geniestock 라이선스 정상 (회귀 0)
□ geniework 키 INSERT·tier="Npc" 저장 확인
□ validate(product=geniework) → HWID 한도 N대 정상
□ HWID 한도 초과 → HWID_MISMATCH
□ LemonSqueezy 테스트 결제 → webhook → 키 발급 (가능하면)
```

★ 이 서버 작업이 끝나야 GenieWork 클라이언트가 실제 검증 가능.
