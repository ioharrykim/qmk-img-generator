import { imgSrc } from '../api'

// 이미지 확대 보기 + 다운로드
// item 은 결과(b64) 또는 기록(url) 둘 다 올 수 있다.
export default function Lightbox({ item, onClose, onDownload }) {
  if (!item) return null
  const src = imgSrc(item)
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        animation: 'qfade .2s ease',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
      >
        <img
          src={src}
          alt="확대 이미지"
          style={{ maxWidth: '100%', maxHeight: '78vh', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onDownload(item)}
            style={{
              background: '#ff4800',
              color: '#ffffff',
              border: 'none',
              borderRadius: 14,
              padding: '12px 22px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'rgba(255,72,0,0.4) 0px 4px 14px',
            }}
          >
            다운로드
          </button>
          <button
            onClick={onClose}
            style={{
              background: '#ffffff',
              color: '#222222',
              border: 'none',
              borderRadius: 14,
              padding: '12px 22px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
