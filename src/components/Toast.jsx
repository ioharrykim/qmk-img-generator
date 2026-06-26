// 하단 중앙 토스트 — 성공/에러 공용
export default function Toast({ toast, onClose }) {
  if (!toast) return null
  const isError = toast.type === 'error'
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        background: isError ? '#222222' : '#0f6b43',
        color: '#ffffff',
        padding: '14px 18px',
        borderRadius: 14,
        fontSize: 13,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        maxWidth: 560,
        boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
        animation: 'qpop .25s ease',
      }}
    >
      <span style={{ color: isError ? '#ff8a5c' : '#9be7c0', fontSize: 15 }}>{isError ? '⚠' : '✓'}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 16,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}
