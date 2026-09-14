/**
 * @파일: lib/license-tiers.ts
 * @설명: 라이선스 등급(tier) 목록의 단일 출처.
 *
 *        왜 여기에 있나: 목록 자체는 관리자 화면(브라우저에서 도는 코드)에서도 필요한데,
 *        원래 정의가 있던 `app/api/license/_lib_supabase.ts`는 모듈을 읽는 순간
 *        라이선스 DB 서비스 키를 읽는 **서버 전용** 파일이라 화면에서 가져올 수 없다.
 *        그래서 "값"만 이 파일로 내리고, 서버 파일은 이곳을 다시 내보낸다.
 *        정의는 계속 한 곳(여기)이다 — 목록을 고칠 때 두 군데를 고치는 일이 없게.
 *
 *        ⚠️ 웹훅(app/api/webhooks/lemonsqueezy/route.ts)에 같은 목록이 한 벌 더 있다.
 *        그 파일은 Wave 8에서 함께 정리한다(돈이 오가는 경로라 커밋을 섞지 않는다).
 */

/** 실제로 라이선스가 발급되는 등급. license_keys의 DB CHECK·웹훅 normalizeTier와 같은 집합이다. */
export const KNOWN_TIERS = ['lite', 'pro', 'max', '1pc', '3pc', '5pc', '10pc'] as const

/**
 * "라이선스 등급이라는 개념이 없는 상품"을 나타내는 값.
 * 빈 값과 구별해야 한다 — 빈 값은 "아직 안 정했다"(실수)이고, 이 값은 "정했고 없다"(의도)다.
 * 이 값이 붙은 옵션 행으로는 라이선스가 발급되지 않는다.
 */
export const TIER_NONE = 'none'

/** 관리자 옵션표 드롭다운에 그대로 뿌리는 선택지 — 저장값과 화면 글자를 한 쌍으로 묶는다. */
export const TIER_OPTIONS: { value: string; label: string }[] = [
  ...KNOWN_TIERS.map((t) => ({ value: t as string, label: t as string })),
  { value: TIER_NONE, label: '해당 없음' },
]

/**
 * @함수명: isKnownTier
 * @설명: 값이 실제로 발급·저장 가능한 등급인지 판정합니다.
 *        ★ 'none'은 여기서 false입니다 — 발급 대상이 아니기 때문입니다.
 *        플랜 올리기·결제 화면이 이 판정으로 "올릴 수 있는 플랜"을 고르므로 의미를 넓히면 안 됩니다.
 * @매개변수: value - 검사할 값(옵션 행의 license_tier 등)
 * @반환값: 발급 가능한 등급이면 true
 */
export function isKnownTier(value: unknown): boolean {
  const s = String(value ?? '').toLowerCase().trim()
  return (KNOWN_TIERS as readonly string[]).includes(s)
}

/**
 * @함수명: isValidTierChoice
 * @설명: 관리자가 옵션 행에 저장해도 되는 값인지 판정합니다(발급 등급 7개 + '해당 없음').
 *        빈 값과 목록 밖 값은 false — 빈 채로 저장되면 결제는 되는데 라이선스가
 *        발급되지 않는 사고가 납니다.
 * @매개변수: value - 검사할 값
 * @반환값: 저장 가능한 값이면 true
 */
export function isValidTierChoice(value: unknown): boolean {
  const s = String(value ?? '').toLowerCase().trim()
  return isKnownTier(s) || s === TIER_NONE
}
