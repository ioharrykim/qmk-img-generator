import { imgSrc, aspectFor } from '../api'
import { recordUsd, sumUsd, usdToKrw, formatKrw } from '../pricing'

// 우측 메인 뷰포트 — 빈 상태 / 로딩 스켈레톤 / 결과 그리드
export default function Viewport({ loading, results, settings, krwRate, onExpand, onDownload, onUseAsReference, onReusePrompt }) {
  const hasResults = !loading && results.length > 0
  const isEmpty = !loading && results.length === 0
  const gridCols = settings.n >= 2 ? 'repeat(2, 1fr)' : 'minmax(0, 560px)'
  const aspect = aspectFor(settings.size)
  const batchKrw = formatKrw(usdToKrw(sumUsd(results), krwRate))

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 32 }}>
      {/* 빈 상태 */}
      {isEmpty && (
        <div
          style={{
            height: '100%',
            minHeight: 420,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: '#6a6a6a',
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              background: '#ffffff',
              boxShadow:
                'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 6px 0px, rgba(0,0,0,0.1) 0px 4px 8px 0px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 38,
              marginBottom: 22,
            }}
          >
            🎨
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#222222', letterSpacing: '-0.2px', marginBottom: 8 }}>
            이미지를 만들어 볼까요?
          </div>
          <div style={{ fontSize: 14, maxWidth: 380, lineHeight: 1.5 }}>
            왼쪽에 프롬프트를 입력하고 프리셋을 고른 뒤<br />
            생성 버튼(또는 ⌘/Ctrl+Enter)을 누르면 결과가 여기에 표시됩니다.
          </div>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6a6a6a', marginBottom: 16 }}>
            생성 중입니다… 보통 10~30초 정도 걸려요.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 16 }}>
            {Array.from({ length: settings.n }, (_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: aspect,
                  borderRadius: 20,
                  background: 'linear-gradient(100deg,#ededed 30%,#f7f7f7 50%,#ededed 70%)',
                  backgroundSize: '460px 100%',
                  animation: 'qshimmer 1.3s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 결과 */}
      {hasResults && (
        <div style={{ animation: 'qfade .3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.2px' }}>생성 결과</div>
            <div style={{ fontSize: 13, color: '#6a6a6a' }}>
              {results.length}장 · {settings.size === 'auto' ? '자동 크기' : settings.size} ·{' '}
              {settings.format.toUpperCase()} · 이번 ≈ {batchKrw}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 16 }}>
            {results.map((item) => (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'qpop .35s ease both' }}>
                <div
                  onClick={() => onExpand(item)}
                  style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#dddddd', cursor: 'zoom-in' }}
                >
                  <img src={imgSrc(item)} alt="생성 이미지" style={{ display: 'block', width: '100%', height: 'auto' }} />
                  <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDownload(item)
                      }}
                      title="다운로드"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: 'none',
                        background: '#ffffff',
                        color: '#222222',
                        fontSize: 16,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.16) 0px 2px 4px 0px',
                      }}
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#6a6a6a' }}>≈ {formatKrw(usdToKrw(recordUsd(item), krwRate))} / 장</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <CardAction label="참조로 추가" onClick={() => onUseAsReference(item)} />
                  <CardAction label="프롬프트 재사용" onClick={() => onReusePrompt(item)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CardAction({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="q-hover-fog"
      style={{
        flex: 1,
        background: '#ffffff',
        border: '1px solid #dddddd',
        borderRadius: 8,
        padding: '7px 8px',
        fontSize: 12,
        fontWeight: 600,
        color: '#222222',
        cursor: 'pointer',
        transition: 'background .15s ease',
      }}
    >
      {label}
    </button>
  )
}
