import { timeAgo } from '../utils'
import { recordUsd, usdToKrw, formatKrw } from '../pricing'

// 생성 기록 관리 패널 (우측 슬라이드오버)
export default function HistoryPanel({ open, onClose, history, krwRate, onExpand, onDownload, onDelete, onClear, onReuse, onUseAsReference }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 75,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'qfade .2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '100%',
          height: '100%',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ flex: 'none', padding: '18px 24px', borderBottom: '1px solid #ebebeb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>
            생성 기록 <span style={{ fontSize: 13, fontWeight: 500, color: '#6a6a6a' }}>{history.length}장</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="q-link"
                style={{ background: 'transparent', border: 'none', fontSize: 12, fontWeight: 600, color: '#6a6a6a', cursor: 'pointer' }}
              >
                전체 삭제
              </button>
            )}
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f7f7f7', color: '#222222', fontSize: 15, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20 }}>
          {history.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#6a6a6a', textAlign: 'center', gap: 8 }}>
              <div style={{ fontSize: 32 }}>🗂️</div>
              <div style={{ fontSize: 14 }}>아직 생성 기록이 없습니다.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {history.map((item) => (
                <div key={item.id} style={{ display: 'flex', gap: 12 }}>
                  <img
                    src={item.url}
                    alt="기록"
                    onClick={() => onExpand(item)}
                    style={{ flex: 'none', width: 84, height: 84, objectFit: 'cover', borderRadius: 12, background: '#f7f7f7', cursor: 'zoom-in', border: '1px solid #ebebeb' }}
                  />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 12, color: '#222222', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.prompt || '(프롬프트 없음)'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6a6a6a' }}>
                      {(item.size === 'auto' ? '자동' : item.size)} · {(item.format || 'png').toUpperCase()} · ≈ {formatKrw(usdToKrw(recordUsd(item), krwRate))} · {timeAgo(item.createdAt)}
                      {item.refCount ? ' · 참조 ' + item.refCount : ''}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
                      <HistoryAction label="다운로드" onClick={() => onDownload(item)} />
                      <HistoryAction label="설정 재사용" onClick={() => onReuse(item)} />
                      <HistoryAction label="참조로 추가" onClick={() => onUseAsReference(item)} />
                      <HistoryAction label="삭제" danger onClick={() => onDelete(item)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryAction({ label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: '1px solid ' + (danger ? '#f0c9c0' : '#dddddd'),
        borderRadius: 7,
        padding: '4px 9px',
        fontSize: 11,
        fontWeight: 600,
        color: danger ? '#d4351c' : '#222222',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
