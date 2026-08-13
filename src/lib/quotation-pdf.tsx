/**
 * @파일: lib/quotation-pdf.tsx
 * @설명: 견적서 PDF 문서 생성 — @react-pdf/renderer 기반. 서버 전용(fs·process.cwd 사용).
 *        한글은 저장소에 동봉한 나눔고딕 TTF(SIL OFL 1.1 — src/assets/quotation/fonts/OFL.txt)를
 *        임베드해 어떤 환경에서도 깨지지 않는다. 도장은 투명 PNG(corp-stamp.png)를
 *        공급자 칸 안 "(인)" 자리에 겹쳐 찍는다(글자를 가리지 않는 위치).
 *        ⚠️ 금액 기준(보고됨): product_prices.price는 사이트·결제와 동일한 "VAT 포함가"다.
 *        합계금액 = 단가 × 수량(반올림)으로 사이트 표시가를 그대로 보존하고,
 *        부가세 = 합계 × 10/110 반올림, 공급가액 = 합계 − 부가세로 "역산 표기"만 한다.
 *        (처음 구현은 price를 공급가액으로 놓고 10%를 더해 10% 비쌌다 — 검증에서 잡혀 수정)
 *        ⚠️ 회사 정보(공급자)는 호출부가 설정에서 읽어 전달한다 — 이 파일에 박지 않는다.
 *        서식 항목 이름(공급자·품명 등)은 정해진 문서 양식이라 코드에 둔다(지시서 예외).
 */

import fs from 'fs'
import path from 'path'
// JSX 런타임 겸용 — Next(automatic)와 단독 실행 검증 스크립트(classic) 양쪽에서 동작하게 명시
import * as React from 'react'
import { Document, Page, Text, View, Image, Font, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

void React // automatic 런타임에서는 직접 사용되지 않음 — 미사용 경고 억제

import { formatPrice } from './price'

const ASSET_DIR = path.join(process.cwd(), 'src', 'assets', 'quotation')

// 한글 폰트 등록 — 모듈 로드 시 1회. 등록은 경로만 받고 실제 읽기는 렌더 시점이므로
// 파일 존재 확인은 발급 라우트(fs.existsSync)가 사전에 한다.
Font.register({
  family: 'NanumGothic',
  fonts: [
    { src: path.join(ASSET_DIR, 'fonts', 'NanumGothic-Regular.ttf'), fontWeight: 400 },
    { src: path.join(ASSET_DIR, 'fonts', 'NanumGothic-Bold.ttf'), fontWeight: 700 },
  ],
})

/** 원 단위 금액 표시 — 화면과 같은 단일 출처(lib/price.formatPrice) 재사용 */
const won = (n: number): string => formatPrice(n)

/** 발급에 필요한 모든 값 — 회사 정보·품목·금액은 호출부가 채워 전달한다 */
export interface QuotationData {
  quoteNo: string
  issuedAt: Date
  validUntil: Date            // 발행일 + 30일 (호출부에서 계산해 전달)
  recipient: { orgName: string; department?: string | null; contactName?: string | null }
  supplier: {
    name: string; bizNo: string; ceo: string; address: string
    bizType: string; bizItem: string; phone: string
  }
  item: { productName: string; spec: string; quantity: number; unitPrice: number }
  /** 결제 형태 안내 — "연간 구독" · "월 구독" · "1회 구매" (품목 표 아래에 명시) */
  payTypeLabel: string
  amounts: { supply: number; vat: number; total: number }
  procurement?: { itemNumber?: string | null; classNumber?: string | null }
}

const S = StyleSheet.create({
  page: { fontFamily: 'NanumGothic', fontSize: 10, color: '#111111', padding: 48 },
  title: { fontSize: 24, fontWeight: 700, textAlign: 'center', letterSpacing: 16, marginBottom: 24 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  small: { fontSize: 9, color: '#444444' },
  recipient: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  table: { borderWidth: 1, borderColor: '#333333' },
  row: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#333333' },
  rowFirst: { flexDirection: 'row' },
  th: { backgroundColor: '#f0f0f0', fontWeight: 700, padding: 6, borderRightWidth: 1, borderColor: '#333333' },
  td: { padding: 6, borderRightWidth: 1, borderColor: '#333333' },
  last: { borderRightWidth: 0 },
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },
  totalBox: { marginTop: 12, borderWidth: 1, borderColor: '#333333', padding: 10 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  totalMain: { fontSize: 12, fontWeight: 700 },
  // 도장 — 공급자 표(상대 좌표 기준) 오른쪽의 글자 없는 영역에 걸친다. 투명 PNG라 선은 비쳐 보인다.
  stamp: { position: 'absolute', width: 58, height: 56, right: 12, top: 5 },
  footerNote: { marginTop: 24, fontSize: 9, color: '#444444', lineHeight: 1.6 },
})

/** 날짜를 'YYYY. M. D.' 형식으로 — 한국시간 기준(서버가 UTC라도 발행일이 하루 밀리지 않게) */
function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric',
  }).format(d)
}

/**
 * @함수명: QuotationDoc
 * @설명: 견적서 한 장짜리 PDF 문서 트리를 만듭니다.
 * @매개변수: data - 견적 번호·수신·공급자·품목·금액 등 표시할 모든 값
 * @반환값: react-pdf Document 요소
 */
function QuotationDoc({ data }: { data: QuotationData }) {
  const r = data.recipient
  const sp = data.supplier
  const procurementText = [
    data.procurement?.itemNumber ? `조달청 물품식별번호: ${data.procurement.itemNumber}` : null,
    data.procurement?.classNumber ? `물품분류번호: ${data.procurement.classNumber}` : null,
  ].filter(Boolean).join('  ·  ')

  return (
    <Document title={`견적서 ${data.quoteNo}`} author={sp.name}>
      <Page size="A4" style={S.page}>
        <Text style={S.title}>견 적 서</Text>

        <View style={S.metaRow}>
          <Text>견적 번호: {data.quoteNo}</Text>
          <Text>발행일: {fmtDate(data.issuedAt)}</Text>
        </View>
        <View style={S.metaRow}>
          <Text style={S.small}>유효기간: 발행일로부터 30일 ({fmtDate(data.validUntil)}까지)</Text>
        </View>

        <Text style={S.recipient}>
          수신: {r.orgName}{r.department ? ` ${r.department}` : ''}{r.contactName ? ` ${r.contactName}` : ''} 귀하
        </Text>
        <Text>아래와 같이 견적합니다.</Text>

        {/* 공급자 정보 — 값은 전부 설정에서 온다. 도장은 표 오른쪽 글자 없는 영역에 겹친다. */}
        <Text style={S.sectionLabel}>공급자</Text>
        <View style={[S.table, { position: 'relative' }]}>
          <View style={S.rowFirst}>
            <Text style={[S.th, { width: 90 }]}>상호</Text>
            <Text style={[S.td, S.last, { flex: 1 }]}>{sp.name}  (인)</Text>
          </View>
          <View style={S.row}>
            <Text style={[S.th, { width: 90 }]}>사업자등록번호</Text>
            <Text style={[S.td, { width: 150 }]}>{sp.bizNo}</Text>
            <Text style={[S.th, { width: 60 }]}>대표자</Text>
            <Text style={[S.td, S.last, { flex: 1 }]}>{sp.ceo}</Text>
          </View>
          <View style={S.row}>
            <Text style={[S.th, { width: 90 }]}>주소</Text>
            <Text style={[S.td, S.last, { flex: 1 }]}>{sp.address}</Text>
          </View>
          <View style={S.row}>
            <Text style={[S.th, { width: 90 }]}>업태 / 종목</Text>
            <Text style={[S.td, { width: 150 }]}>{sp.bizType} / {sp.bizItem}</Text>
            <Text style={[S.th, { width: 60 }]}>전화</Text>
            <Text style={[S.td, S.last, { flex: 1 }]}>{sp.phone}</Text>
          </View>
          {/* 투명 PNG 도장 — 표 우측 상단의 글자 없는 영역에 실제 도장처럼 겹친다(마지막 요소 = 맨 위에 그려짐).
              ⚠️ 문자열 경로를 주면 react-pdf가 URL로 fetch하려다 실패한다(검증에서 확인) — Buffer로 전달 */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={fs.readFileSync(path.join(ASSET_DIR, 'corp-stamp.png'))} style={S.stamp} />
        </View>

        {/* 품목 — 단가는 상품 가격(product_prices.price 원, VAT 포함) 그대로. 금액 = 합계금액과 일치 */}
        <Text style={S.sectionLabel}>품목</Text>
        <View style={S.table}>
          <View style={S.rowFirst}>
            <Text style={[S.th, { flex: 3 }, S.center]}>품명</Text>
            <Text style={[S.th, { flex: 2 }, S.center]}>규격</Text>
            <Text style={[S.th, { flex: 1 }, S.center]}>수량</Text>
            <Text style={[S.th, { flex: 2 }, S.center]}>단가(VAT 포함)</Text>
            <Text style={[S.th, { flex: 2 }, S.center, S.last]}>금액(VAT 포함)</Text>
          </View>
          <View style={S.row}>
            <Text style={[S.td, { flex: 3 }]}>{data.item.productName}</Text>
            <Text style={[S.td, { flex: 2 }, S.center]}>{data.item.spec}</Text>
            <Text style={[S.td, { flex: 1 }, S.center]}>{data.item.quantity}</Text>
            <Text style={[S.td, { flex: 2 }, S.right]}>{won(data.item.unitPrice)}</Text>
            <Text style={[S.td, { flex: 2 }, S.right, S.last]}>{won(data.amounts.total)}</Text>
          </View>
        </View>
        <Text style={[S.small, { marginTop: 4 }]}>결제 형태: {data.payTypeLabel}</Text>

        {/* 합계 — 합계(VAT 포함)가 기준값이고 공급가액·부가세는 역산 표기 */}
        <View style={S.totalBox}>
          <View style={S.totalLine}>
            <Text>공급가액</Text>
            <Text>{won(data.amounts.supply)}</Text>
          </View>
          <View style={S.totalLine}>
            <Text>부가세</Text>
            <Text>{won(data.amounts.vat)}</Text>
          </View>
          <View style={[S.totalLine, { marginBottom: 0 }]}>
            <Text style={S.totalMain}>합계금액 (부가세 포함)</Text>
            <Text style={S.totalMain}>{won(data.amounts.total)}</Text>
          </View>
        </View>

        {procurementText ? (
          <>
            <Text style={S.sectionLabel}>비고</Text>
            <Text>{procurementText}</Text>
          </>
        ) : null}

        <Text style={S.footerNote}>
          본 견적서는 발행일로부터 30일간 유효합니다.{'\n'}
          문의: {sp.phone}
        </Text>
      </Page>
    </Document>
  )
}

/**
 * @함수명: buildQuotationPdf
 * @설명: 견적서 PDF를 만들어 바이트로 돌려줍니다.
 * @매개변수: data - QuotationData 전체
 * @반환값: PDF 파일 내용(Buffer)
 */
export async function buildQuotationPdf(data: QuotationData): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(<QuotationDoc data={data} />))
}
