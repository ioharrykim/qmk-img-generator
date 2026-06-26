import SegmentedControl from './SegmentedControl'
import { buildTypographyPrompt, emphasisOptions, TYPO_COUNT_OPTIONS, sizeForCount } from '../typography'

// 타이포그래피 제작 전용 모드 — AI 없이 입력값을 프롬프트로 조립
export default function TypographyPanel({ typography = {}, onToggle, onChange, onApply }) {
  const on = !!typography.enabled
  const emOpts = emphasisOptions(typography)
  // 강조 선택지가 사라진 경우 안전 처리
  const emValue = emOpts.some((o) => o.value === typography.emphasis) ? typography.emphasis : 'equal'
  const preview = buildTypographyPrompt(typography)

  return (
    <section
      style={{
        border: '1.5px solid ' + (on ? '#2563eb' : '#cdddfb'),
        borderRadius: 16,
        overflow: 'hidden',
        background: on ? 'linear-gradient(180deg, #eff5ff 0%, #ffffff 70%)' : 'linear-gradient(180deg, #f5f9ff 0%, #ffffff 100%)',
        boxShadow: on ? 'rgba(37,99,235,0.12) 0px 6px 20px' : 'none',
        transition: 'all .15s ease',
      }}
    >
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>✍️</span>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>타이포그래피 제작</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', background: '#e1ecfe', padding: '2px 6px', borderRadius: 20, letterSpacing: '0.3px' }}>문구 → 프롬프트</span>
          </span>
          <span style={{ fontSize: 11, color: '#6a6a6a' }}>문구·강조·색감만 입력하면 프롬프트가 만들어져요 (AI 미사용)</span>
        </span>
        <span style={{ flex: 'none', width: 40, height: 24, borderRadius: 14, background: on ? '#2563eb' : '#dddddd', position: 'relative', transition: 'background .15s ease' }}>
          <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </span>
      </button>

      {on && (
        <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>문구 (줄별 입력)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input className="q-field" value={typography.line1 || ''} onChange={(e) => onChange({ line1: e.target.value })} placeholder="1번째 줄  예) 딱 지금만 이 가격에!" style={inputStyle} />
              <input className="q-field" value={typography.line2 || ''} onChange={(e) => onChange({ line2: e.target.value })} placeholder="2번째 줄 (선택)  예) 오늘의 마감 특가" style={inputStyle} />
              <input className="q-field" value={typography.line3 || ''} onChange={(e) => onChange({ line3: e.target.value })} placeholder="3번째 줄 (선택)" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>강조 <span style={{ fontWeight: 400 }}>· 어떤 줄을 더 크게</span></label>
            <SegmentedControl options={emOpts} value={emValue} onChange={(v) => onChange({ emphasis: v })} size="sm" />
          </div>

          <Field label="메인 색상·디자인 느낌">
            <input className="q-field" value={typography.colorDesign || ''} onChange={(e) => onChange({ colorDesign: e.target.value })} placeholder="예) 타임세일/마감특가 분위기" style={inputStyle} />
          </Field>

          <Field label="배경 색">
            <input className="q-field" value={typography.background || ''} onChange={(e) => onChange({ background: e.target.value })} placeholder="기본: 흰색  예) 밝은 스카이 블루~민트 그라데이션 스튜디오 배경" style={inputStyle} />
          </Field>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>시안 개수 <span style={{ fontWeight: 400 }}>· 한 이미지 안 변형 수</span></label>
            <SegmentedControl options={TYPO_COUNT_OPTIONS} value={typography.count || 4} onChange={(v) => onChange({ count: v })} size="sm" />
            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 8, lineHeight: 1.5 }}>
              📐 이미지 비율이 <b>{sizeForCount(typography.count || 4).ratio}</b> ({sizeForCount(typography.count || 4).w}×{sizeForCount(typography.count || 4).h})로 자동 설정됩니다. 아래 <b>비율/사이즈</b>에서 변경 가능.
            </div>
          </div>

          {preview && (
            <div style={{ background: '#f7f7f7', borderRadius: 12, padding: '11px 13px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6a6a6a', letterSpacing: '0.3px', marginBottom: 6 }}>조립된 프롬프트 미리보기</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: '#222', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{preview}</div>
            </div>
          )}

          <button
            onClick={onApply}
            disabled={!preview}
            className="q-generate"
            style={{
              width: '100%',
              height: 46,
              border: 'none',
              borderRadius: 12,
              background: preview ? '#2563eb' : '#a9c2f5',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: preview ? 'pointer' : 'default',
            }}
          >
            ✍️ 프롬프트 적용
          </button>
          <div style={{ fontSize: 11, color: '#6a6a6a', lineHeight: 1.5, marginTop: -4 }}>
            적용하면 아래 <b style={{ color: '#222' }}>프롬프트</b> 칸에 채워집니다. 직접 수정 후 이미지를 생성하세요.
          </div>
        </div>
      )}
    </section>
  )
}

const inputStyle = {
  width: '100%',
  border: '1px solid #dddddd',
  borderRadius: 12,
  padding: '10px 13px',
  fontSize: 13,
  color: '#222222',
  background: '#ffffff',
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}
