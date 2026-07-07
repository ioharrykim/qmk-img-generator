import SegmentedControl from './SegmentedControl'
import { QMARKET_VERSIONS } from '../qmarketPrompts'

// 큐마켓 상세페이지 전용 모드 — 강조 카드 + AI 고급 프롬프트 생성
export default function QmarketDetailPanel({ qmarket = {}, onToggle, onChange, onGenerate, generating }) {
  const on = !!qmarket.enabled

  return (
    <section
      style={{
        border: '1.5px solid ' + (on ? '#ff4800' : '#ffd9c7'),
        borderRadius: 16,
        overflow: 'hidden',
        background: on
          ? 'linear-gradient(180deg, #fff4ef 0%, #ffffff 70%)'
          : 'linear-gradient(180deg, #fff7f3 0%, #ffffff 100%)',
        boxShadow: on ? 'rgba(255,72,0,0.12) 0px 6px 20px' : 'none',
        transition: 'all .15s ease',
      }}
    >
      {/* 헤더 (토글) */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>🛍️</span>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>큐마켓 상세페이지 제작</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#ff4800', background: '#ffe6da', padding: '2px 6px', borderRadius: 20, letterSpacing: '0.3px' }}>AI 프롬프트</span>
          </span>
          <span style={{ fontSize: 11, color: '#6a6a6a' }}>타이틀·컨셉만 적으면 AI가 상세 프롬프트를 만들어 줘요</span>
        </span>
        <span
          style={{
            flex: 'none',
            width: 40,
            height: 24,
            borderRadius: 14,
            background: on ? '#ff4800' : '#dddddd',
            position: 'relative',
            transition: 'background .15s ease',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: on ? 18 : 2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left .15s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </span>
      </button>

      {/* 본문 */}
      {on && (
        <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, color: '#cc3a00', background: '#fff1eb', borderRadius: 10, padding: '8px 11px', lineHeight: 1.5 }}>
            💡 상세페이지 메인 이미지는 <b>2:3 (세로)</b> 비율을 권장합니다. 사이즈가 자동으로 2:3으로 맞춰졌어요. (아래에서 변경 가능)
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>버전</label>
            <SegmentedControl
              options={QMARKET_VERSIONS}
              value={qmarket.version}
              onChange={(v) => onChange({ version: v })}
            />
          </div>

          <Field label="타이틀">
            <input
              className="q-field"
              value={qmarket.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="예) 더운 날 필요한 시원한 음식 모음전!"
              style={inputStyle}
            />
          </Field>

          <Field label="서브 문구">
            <input
              className="q-field"
              value={qmarket.subtitle}
              onChange={(e) => onChange({ subtitle: e.target.value })}
              placeholder="예) 시원한 냉면부터 달콤한 과일까지, 차가운 별미를 모았어요!"
              style={inputStyle}
            />
          </Field>

          <Field label="컨셉 / 상품 구성">
            <textarea
              className="q-field"
              value={qmarket.concept}
              onChange={(e) => onChange({ concept: e.target.value })}
              placeholder="예) 메인은 시원한 물냉면 한 그릇, 주변에 수박·참외·복숭아·블루베리 등 여름 과일. 청량한 파랑/민트 배경."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
            <div style={{ fontSize: 11, color: '#6a6a6a', marginTop: 6, lineHeight: 1.5 }}>
              💡 서울우유·나이키 같은 <b style={{ color: '#222' }}>실제 상품</b>은 이름을 그대로 적으면 브랜드가 유지됩니다. 정확한 외형이 필요하면 위 <b style={{ color: '#222' }}>참조 이미지</b>에 제품 사진을 첨부하세요.
            </div>
          </Field>

          <button
            onClick={onGenerate}
            disabled={generating}
            className="q-generate"
            style={{
              width: '100%',
              height: 46,
              border: 'none',
              borderRadius: 12,
              background: generating ? '#ffb38f' : '#222222',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: generating ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {generating && (
              <span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,.45)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'qspin .7s linear infinite' }} />
            )}
            {generating ? 'AI가 작성 중…' : '✨ AI로 고급 프롬프트 생성'}
          </button>
          <div style={{ fontSize: 11, color: '#6a6a6a', lineHeight: 1.5, marginTop: -4 }}>
            생성된 프롬프트는 아래 <b style={{ color: '#222' }}>프롬프트</b> 칸에 채워집니다. 직접 수정 후 이미지를 생성하세요.
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
