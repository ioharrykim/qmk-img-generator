// OpenAI API 키 입력 모달
export default function ApiKeyModal({ value, onChange, onSave, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: '100%',
          background: '#ffffff',
          borderRadius: 20,
          padding: 28,
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.2px', marginBottom: 8 }}>OpenAI API 키</div>
        <div style={{ fontSize: 13, color: '#6a6a6a', lineHeight: 1.5, marginBottom: 18 }}>
          이미지 생성을 위해 OpenAI API 키가 필요합니다. 키는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.
        </div>
        <input
          className="q-field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave()
          }}
          type="password"
          placeholder="sk-..."
          style={{
            width: '100%',
            border: '1px solid #dddddd',
            borderRadius: 14,
            padding: '13px 15px',
            fontSize: 14,
            color: '#222222',
            marginBottom: 18,
          }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #dddddd',
              borderRadius: 8,
              padding: '11px 18px',
              fontSize: 14,
              fontWeight: 600,
              color: '#222222',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={onSave}
            style={{
              background: '#ff4800',
              border: 'none',
              borderRadius: 8,
              padding: '11px 20px',
              fontSize: 14,
              fontWeight: 700,
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
