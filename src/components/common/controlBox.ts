/**
 * @파일: components/common/controlBox.ts
 * @설명: 구매 바 옵션/수량 컨트롤 박스 공통 규격 상수.
 *        기간·PC개수·수량·결제방법 4개 박스가 이 클래스를 공유해 바깥(computed) 높이를
 *        정확히 40px(h-10)로 통일한다. box-border로 보더가 40px 안에 포함되고, 안쪽 요소
 *        (세그먼트 버튼·스테퍼 버튼·드롭업 트리거 텍스트)는 h-full 기준으로 채워 바깥 높이에
 *        영향을 주지 않는다. inline-flex라 내용 폭에 맞춰 줄어든다(구매 바 한 줄 유지).
 */

/** 구매 바 컨트롤 박스 바깥 규격 — 각 컴포넌트가 자체 패딩/정렬을 뒤에 덧붙여 사용 */
export const BUY_BAR_CONTROL_BOX =
  'inline-flex items-center h-10 box-border border border-rule rounded-md bg-paper'
