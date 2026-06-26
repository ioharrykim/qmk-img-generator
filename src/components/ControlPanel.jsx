import SegmentedControl from './SegmentedControl'
import ReferenceImages from './ReferenceImages'
import StylePresets from './StylePresets'
import {
  USECASES,
  SIZE_DEFS,
  QUALITY_OPTIONS,
  BACKGROUND_OPTIONS,
  FORMAT_OPTIONS,
  COUNT_OPTIONS,
  MODERATION_OPTIONS,
} from '../constants'

const ON_BG = '#fff1eb'
const ON_BORDER = '#ff4800'
const ON_COLOR = '#ff4800'

const sectionLabel = { fontSize: 13, fontWeight: 600 }

export default function ControlPanel({
  settings,
  update,
  toggleStyle,
  toggleCustomSize,
  setCustomSize,
  onGenerate,
  loading,
  hasKey,
  keyRequired,
  advancedOpen,
  onToggleAdvanced,
  finalPromptPreview,
  references,
  onAddReferences,
  onRemoveReference,
  onClearReferences,
  savedPresets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}) {
  const showCompression = settings.format === 'jpeg' || settings.format === 'webp'
  const canGenerate = !keyRequired || hasKey
  const refMode = references.length > 0
  const generateLabel = loading
    ? '생성 중…'
    : !canGenerate
      ? 'API 키 입력 후 생성'
      : refMode
        ? '참조 기반 생성'
        : '이미지 생성'

  return (
    <aside
      style={{
        width: 444,
        flex: 'none',
        background: '#ffffff',
        borderRight: '1px solid #ebebeb',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* 프롬프트 */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={sectionLabel}>프롬프트</label>
            <button
              onClick={() =>
                update({ prompt: '창가에 앉아 커피를 마시는 고양이, 따뜻한 아침 햇살, 아늑한 분위기' })
              }
              className="q-link"
              style={{ background: 'transparent', border: 'none', fontSize: 12, fontWeight: 600, color: '#6a6a6a', cursor: 'pointer', padding: '2px 4px' }}
            >
              예시 채우기
            </button>
          </div>
          <textarea
            className="q-field"
            value={settings.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
            placeholder="만들고 싶은 이미지를 자유롭게 설명해 주세요. 예) 노을 지는 해변에서 산책하는 강아지"
            rows={5}
            style={{
              width: '100%',
              resize: 'vertical',
              border: '1px solid #dddddd',
              borderRadius: 14,
              padding: 14,
              fontSize: 14,
              lineHeight: 1.5,
              color: '#222222',
              background: '#ffffff',
            }}
          />
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>
              제외할 요소 (네거티브)
            </label>
            <input
              className="q-field"
              value={settings.negative}
              onChange={(e) => update({ negative: e.target.value })}
              placeholder="예) 흐릿함, 텍스트, 워터마크"
              style={{
                width: '100%',
                border: '1px solid #dddddd',
                borderRadius: 14,
                padding: '11px 14px',
                fontSize: 13,
                color: '#222222',
                background: '#ffffff',
              }}
            />
          </div>
        </section>

        {/* 참조 이미지 */}
        <ReferenceImages
          references={references}
          onAdd={onAddReferences}
          onRemove={onRemoveReference}
          onClear={onClearReferences}
        />

        {/* 스타일 프리셋 (카테고리·검색·내 프리셋) */}
        <StylePresets
          settings={settings}
          toggleStyle={toggleStyle}
          savedPresets={savedPresets}
          onSavePreset={onSavePreset}
          onApplyPreset={onApplyPreset}
          onDeletePreset={onDeletePreset}
        />

        {/* 용도 프리셋 */}
        <section>
          <div style={{ ...sectionLabel, marginBottom: 12 }}>
            용도 프리셋 <span style={{ fontWeight: 400, color: '#6a6a6a', fontSize: 12 }}>· 사이즈·품질 한 번에</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {USECASES.map((opt) => {
              const active = Object.keys(opt.patch).every((k) => settings[k] === opt.patch[k])
              return (
                <button
                  key={opt.key}
                  onClick={() => update({ ...opt.patch })}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    padding: '12px 14px',
                    borderRadius: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all .15s ease',
                    border: '1px solid ' + (active ? ON_BORDER : '#dddddd'),
                    background: active ? ON_BG : '#ffffff',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: active ? ON_COLOR : '#222222' }}>{opt.label}</span>
                  <span style={{ fontSize: 11, color: '#6a6a6a' }}>{opt.desc}</span>
                </button>
              )
            })}
          </div>
        </section>

        <div style={{ height: 1, background: '#ebebeb' }} />

        {/* 비율 / 사이즈 */}
        <section>
          <div style={{ ...sectionLabel, marginBottom: 12 }}>비율 / 사이즈</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {SIZE_DEFS.map((opt) => {
              const active = !settings.useCustomSize && settings.size === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => update({ size: opt.value, useCustomSize: false })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 13px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                    border: '1px solid ' + (active ? ON_BORDER : '#dddddd'),
                    background: active ? ON_BG : '#ffffff',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      flex: 'none',
                      background: active ? '#ffe1d3' : '#f7f7f7',
                      border: '1.5px solid ' + (active ? '#ff4800' : '#c1c1c1'),
                      width: opt.swW,
                      height: opt.swH,
                      borderRadius: 3,
                    }}
                  />
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: active ? ON_COLOR : '#222222' }}>{opt.label}</span>
                    <span style={{ fontSize: 11, color: '#6a6a6a' }}>{opt.sub}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <button
            onClick={toggleCustomSize}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              marginTop: 8,
              padding: '11px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all .15s ease',
              border: '1px solid ' + (settings.useCustomSize ? ON_BORDER : '#dddddd'),
              background: settings.useCustomSize ? ON_BG : '#ffffff',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: settings.useCustomSize ? ON_COLOR : '#222222' }}>
              직접 입력 (px)
            </span>
            <span style={{ fontSize: 16, fontWeight: 600, color: settings.useCustomSize ? ON_COLOR : '#222222', lineHeight: 1 }}>
              {settings.useCustomSize ? '−' : '+'}
            </span>
          </button>

          {settings.useCustomSize && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6a6a6a' }}>가로</label>
                  <input
                    className="q-field"
                    type="number"
                    min="1"
                    value={settings.customW}
                    onChange={(e) => setCustomSize({ customW: Math.max(1, Number(e.target.value) || 0) })}
                    style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 14, padding: '10px 13px', fontSize: 14, color: '#222222' }}
                  />
                </div>
                <span style={{ fontSize: 14, color: '#6a6a6a', paddingTop: 18 }}>×</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6a6a6a' }}>세로</label>
                  <input
                    className="q-field"
                    type="number"
                    min="1"
                    value={settings.customH}
                    onChange={(e) => setCustomSize({ customH: Math.max(1, Number(e.target.value) || 0) })}
                    style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 14, padding: '10px 13px', fontSize: 14, color: '#222222' }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#6a6a6a', marginTop: 8, lineHeight: 1.4 }}>
                모델이 지원하는 크기여야 정상 생성됩니다. 일반적으로 256~1792px 범위를 권장합니다.
              </div>
            </>
          )}
        </section>

        {/* 품질 */}
        <section>
          <div style={{ ...sectionLabel, marginBottom: 12 }}>품질</div>
          <SegmentedControl options={QUALITY_OPTIONS} value={settings.quality} onChange={(v) => update({ quality: v })} />
        </section>

        {/* 배경 */}
        <section>
          <div style={{ ...sectionLabel, marginBottom: 12 }}>배경</div>
          <SegmentedControl options={BACKGROUND_OPTIONS} value={settings.background} onChange={(v) => update({ background: v })} />
        </section>

        {/* 출력 형식 */}
        <section>
          <div style={{ ...sectionLabel, marginBottom: 12 }}>출력 형식</div>
          <SegmentedControl options={FORMAT_OPTIONS} value={settings.format} onChange={(v) => update({ format: v })} uppercase />
          {showCompression && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6a6a6a', marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>압축 품질</span>
                <span style={{ fontWeight: 600, color: '#222222' }}>{settings.compression}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={settings.compression}
                onChange={(e) => update({ compression: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#ff4800' }}
              />
            </div>
          )}
        </section>

        {/* 생성 개수 */}
        <section>
          <div style={{ ...sectionLabel, marginBottom: 12 }}>생성 개수</div>
          <SegmentedControl options={COUNT_OPTIONS} value={settings.n} onChange={(v) => update({ n: v })} />
        </section>

        {/* 고급 설정 */}
        <section>
          <button
            onClick={onToggleAdvanced}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <span style={sectionLabel}>고급 설정</span>
            <span style={{ fontSize: 14, color: '#6a6a6a', transition: 'transform .2s ease', transform: 'rotate(' + (advancedOpen ? '180deg' : '0deg') + ')' }}>⌄</span>
          </button>
          {advancedOpen && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>콘텐츠 필터 강도</label>
                <SegmentedControl options={MODERATION_OPTIONS} value={settings.moderation} onChange={(v) => update({ moderation: v })} size="sm" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>모델명</label>
                <input
                  className="q-field"
                  value={settings.model}
                  onChange={(e) => update({ model: e.target.value })}
                  placeholder="gpt-image-2"
                  style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 14, padding: '10px 13px', fontSize: 13, color: '#222222' }}
                />
              </div>
              <div style={{ background: '#f7f7f7', borderRadius: 14, padding: '13px 15px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6a6a6a', letterSpacing: '0.4px', marginBottom: 6 }}>최종 전송 프롬프트</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: '#222222', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {finalPromptPreview}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 하단 고정 생성 버튼 */}
      <div style={{ position: 'sticky', bottom: 0, marginTop: 'auto', padding: '16px 24px', background: '#ffffff', borderTop: '1px solid #ebebeb' }}>
        {refMode && (
          <div style={{ fontSize: 11, color: '#6a6a6a', marginBottom: 8, textAlign: 'center' }}>
            참조 이미지 {references.length}장과 함께 변형/합성합니다 (편집 모드)
          </div>
        )}
        <button
          onClick={onGenerate}
          disabled={loading}
          className="q-generate"
          style={{
            width: '100%',
            height: 52,
            border: 'none',
            borderRadius: 14,
            background: loading ? '#ffb38f' : '#ff4800',
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'background .15s ease',
            boxShadow: loading ? 'none' : 'rgba(255,72,0,0.35) 0px 6px 18px',
          }}
        >
          {loading && (
            <span
              style={{
                width: 18,
                height: 18,
                border: '2.5px solid rgba(255,255,255,.45)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'qspin .7s linear infinite',
              }}
            />
          )}
          {generateLabel}
        </button>
      </div>
    </aside>
  )
}
