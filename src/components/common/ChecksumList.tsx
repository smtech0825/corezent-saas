/**
 * @컴포넌트: ChecksumList
 * @설명: 설치파일 무결성 확인용 SHA-256 체크섬 목록.
 *        대시보드「내 라이선스」와 공개 변경 이력 두 곳이 같은 모양으로 쓰도록 한 곳에 둔다.
 *        ⚠️ 다운로드 주소가 없는 플랫폼의 체크섬은 그리지 않는다 —
 *           내려받을 수 없는 파일의 해시를 보여주면 어느 파일 것인지 알 수 없다.
 */

import CopyButton from '@/components/common/CopyButton'
import { PLATFORM_LABELS } from '@/lib/platforms'

interface Props {
  /** { windows: "a1b2…", mac: "c3d4…" } */
  checksums: Record<string, string> | null | undefined
  /** 같은 릴리스의 다운로드 주소. 주소가 있는 플랫폼만 남기는 데 쓴다 */
  downloadUrls: Record<string, string> | null | undefined
  className?: string
}

/**
 * @함수명: ChecksumList
 * @설명: 플랫폼별 체크섬을 한 줄씩 렌더합니다. 보여줄 항목이 없으면 아무것도 그리지 않습니다.
 * @매개변수: props - 체크섬·다운로드 주소 맵
 * @반환값: 체크섬 목록 엘리먼트 또는 null
 */
export default function ChecksumList({ checksums, downloadUrls, className = '' }: Props) {
  const urls = downloadUrls ?? {}
  const rows = Object.entries(checksums ?? {}).filter(
    ([platform, hash]) => hash?.trim() && (urls[platform] ?? '').trim(),
  )

  if (rows.length === 0) return null

  return (
    <div className={className}>
      <p className="text-[10px] text-ink-faint mb-1">
        SHA-256 <span className="text-ink-faint/70">— 내려받은 파일이 원본인지 확인할 때 쓰세요</span>
      </p>
      <ul className="space-y-1">
        {rows.map(([platform, hash]) => (
          <li key={platform} className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-ink-faint shrink-0 w-16">
              {PLATFORM_LABELS[platform] ?? platform}
            </span>
            {/* 해시는 길어서 줄바꿈 대신 잘라 보여주고, 전체 값은 복사 버튼으로만 가져간다 */}
            <code className="font-mono text-[10px] text-ink-soft truncate" title={hash}>
              {hash}
            </code>
            <CopyButton
              value={hash}
              title={`${PLATFORM_LABELS[platform] ?? platform} 체크섬 복사`}
              iconSize={11}
              copiedIconClassName="text-ok"
              className="p-0.5 text-ink-faint hover:text-mark transition-colors shrink-0"
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
