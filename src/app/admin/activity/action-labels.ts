/**
 * @파일: admin/activity/action-labels.ts
 * @설명: 작업 기록 화면의 선택지·라벨 데이터 — 동작 코드 한글 라벨, 종류·기간 필터.
 *        값은 코드가 실제로 기록하는 action만 넣는다(추측 금지). 화면 본문과 분리해
 *        page.tsx가 300줄 규칙을 지키게 한다.
 */

// 종류 필터 — logAdminActivity 호출부 전수에서 뽑은 action 앞머리(점 앞)만
export const KIND_OPTIONS = [
  { value: '',             label: '전체' },
  { value: 'order',        label: '주문' },
  { value: 'subscription', label: '구독' },
  { value: 'user',         label: '회원' },
  { value: 'license',      label: '라이선스' },
  { value: 'product',      label: '제품' },
  { value: 'changelog',    label: '변경 이력' },
  { value: 'quote',        label: '견적' },
  { value: 'support',      label: '고객지원' },
  { value: 'affiliate',    label: '제휴' },
  { value: 'content',      label: '콘텐츠' },
  { value: 'section',      label: '섹션' },
  { value: 'settings',     label: '설정' },
  { value: 'org_license',  label: '기관 발급' },
]

// 기간 — 기본 '전체': 오래된 기록도 기본 화면에서 가려지지 않는다(admin/logs와 동일 원칙)
export const DAYS_OPTIONS = [
  { value: '', label: '전체' },
  { value: '1', label: '24시간' },
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
]

// 동작 코드 → 한글 라벨. 없는 코드는 화면이 원문 그대로 보여준다(기록을 가공하지 않는다).
export const ACTION_LABELS: Record<string, string> = {
  'license.revoke':              '라이선스 회수',
  'order.refund':                '주문 환불 처리',
  'order.confirm_deposit':       '입금 확인',
  'order.org_info_update':       '기관 정보 수정',
  'subscription.cancel':         '구독 취소',
  'user.role_change':            '회원 역할 변경',
  'user.withdraw':               '회원 탈퇴 처리',
  'user.csv_export':             '회원 CSV 내려받기',
  'product.create':              '제품 생성',
  'product.update':              '제품 수정',
  'product.delete':              '제품 삭제',
  'product.deactivate':          '제품 비활성화',
  'product.toggle_active':       '제품 활성/비활성',
  'product.reorder':             '제품 순서 변경',
  'org_license.issue':           '기관 라이선스 발급',
  'changelog.create':            '변경 이력 추가',
  'changelog.update':            '변경 이력 수정',
  'changelog.delete':            '변경 이력 삭제',
  'quote.issue':                 '견적서 발급',
  'support.status_change':       '티켓 상태 변경',
  'affiliate.convert':           '커미션 전환',
  'affiliate.config_update':     '제휴 설정 변경',
  'affiliate.credit_discount':   '크레딧 할인 발급',
  'affiliate.review_resolve':    '검토 표시 해제',
  'settings.update':             '사이트 설정 변경',
  'section.toggle':              '섹션 보임/숨김',
  'section.reorder':             '섹션 순서 변경',
  'content.hero_update':         '히어로 수정',
  'content.cta_update':          'CTA 수정',
  'content.banner_update':       '공지 배너 수정',
  'content.about_hero_update':   '소개 히어로 수정',
  'content.about_stat_create':   '소개 통계 추가',
  'content.about_stat_update':   '소개 통계 수정',
  'content.about_stat_delete':   '소개 통계 삭제',
  'content.about_block_create':  '소개 블록 추가',
  'content.about_block_update':  '소개 블록 수정',
  'content.about_block_delete':  '소개 블록 삭제',
  'content.faq_create':          'FAQ 추가',
  'content.faq_update':          'FAQ 수정',
  'content.faq_delete':          'FAQ 삭제',
  'content.faq_toggle':          'FAQ 게시 전환',
  'content.testimonial_create':  '고객 후기 추가',
  'content.testimonial_update':  '고객 후기 수정',
  'content.testimonial_delete':  '고객 후기 삭제',
  'content.testimonial_toggle':  '고객 후기 게시 전환',
  'content.step_create':         '이용 방법 단계 추가',
  'content.step_update':         '이용 방법 단계 수정',
  'content.step_delete':         '이용 방법 단계 삭제',
  'content.step_toggle':         '이용 방법 게시 전환',
  'content.feature_create':      '특징 카드 추가',
  'content.feature_update':      '특징 카드 수정',
  'content.feature_delete':      '특징 카드 삭제',
  'content.feature_toggle':      '특징 게시 전환',
}
