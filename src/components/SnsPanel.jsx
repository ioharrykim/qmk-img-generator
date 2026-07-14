import SegmentedControl from './SegmentedControl'
import { SNS_FORMATS, SNS_VERSIONS, SNS_TOPICS, SNS_TEXT_MODES } from '../snsPrompts'

// 큐마켓 SNS 이미지 전용 모드 — 강조 카드 + AI 프롬프트 생성
// 투트랙: 배경만(기본) / 텍스트 포함
export default function SnsPanel({ sns = {}, onToggle, onChange, onGenerate, generating }) {
  const on = !!sns.enabled
  const bake = sns.textMode === 'text'

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
        <span style={{ fontSize: 20, lineHeight: 1 }}>📱</span>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>큐마켓 SNS이미지 제작</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#ff4800', background: '#ffe6da', padding: '2px 6px', borderRadius: 20, letterSpacing: '0.3px' }}>AI 프롬프트</span>
          </span>
          <span style={{ fontSize: 11, color: '#6a6a6a' }}>주제·컨셉만 적으면 SNS용 배경 비주얼을 AI가 만들어 줘요</span>
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
          <div>
            <label style={fieldLabel}>텍스트</label>
            <SegmentedControl
              options={SNS_TEXT_MODES}
              value={sns.textMode}
              onChange={(v) => onChange({ textMode: v })}
            />
          </div>

          {bake ? (
            <div style={{ fontSize: 11, color: '#cc3a00', background: '#fff1eb', borderRadius: 10, padding: '8px 11px', lineHeight: 1.5 }}>
              ⚠️ 타이틀·서브 문구를 이미지에 <b>함께 그려요</b>. gpt-image는 한글을 종종 깨뜨리니 <b>문구는 짧게</b> 유지하고 결과를 확인하세요. 깨지면 <b>배경만</b>으로 만들고 텍스트는 후작업을 권장합니다.
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#cc3a00', background: '#fff1eb', borderRadius: 10, padding: '8px 11px', lineHeight: 1.5 }}>
              💡 글자 없는 <b>배경·무드 비주얼</b>을 만들어요. 카피(문구)는 확보된 여백에 나중에 얹으세요. 포맷에 따라 <b>사이즈가 자동</b>으로 맞춰집니다.
            </div>
          )}

          <div>
            <label style={fieldLabel}>포맷</label>
            <SegmentedControl
              options={SNS_FORMATS}
              value={sns.format}
              onChange={(v) => onChange({ format: v })}
            />
          </div>

          <div>
            <label style={fieldLabel}>버전</label>
            <SegmentedControl
              options={SNS_VERSIONS}
              value={sns.version}
              onChange={(v) => onChange({ version: v })}
            />
          </div>

          <Field label="콘텐츠 주제">
            <select
              className="q-field"
              value={sns.topic}
              onChange={(e) => onChange({ topic: e.target.value })}
              style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
            >
              {SNS_TOPICS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={bake ? '타이틀 (이미지에 표시)' : '타이틀 (분위기 참고)'}>
            <input
              className="q-field"
              value={sns.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="예) 여름에 뭐 해먹지?"
              style={inputStyle}
            />
          </Field>

          <Field label={bake ? '서브 문구 (이미지에 표시)' : '서브 문구 (분위기 참고)'}>
            <input
              className="q-field"
              value={sns.subtitle}
              onChange={(e) => onChange({ subtitle: e.target.value })}
              placeholder="예) 제철 채소로 만든 반찬 모음!"
              style={inputStyle}
            />
          </Field>

          <Field label="컨셉 / 상품 구성">
            <textarea
              className="q-field"
              value={sns.concept}
              onChange={(e) => onChange({ concept: e.target.value })}
              placeholder="예) 메인은 갓 튀긴 애호박전, 주변에 장바구니와 여름 채소. 따뜻한 자연광 홈쿠킹 무드."
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
            {generating ? 'AI가 작성 중…' : '✨ AI로 SNS 프롬프트 생성'}
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

const fieldLabel = { fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }

function Field({ label, children }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  )
}
