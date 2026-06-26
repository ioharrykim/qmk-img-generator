// 상단 헤더 — 로고, 키 상태/사용자
// teamMode: 사용자 이메일 + 로그아웃 표시
// keyRequired=false (자체 프록시 서버 모드): "서버 모드" 표시
// keyRequired=true (직접 모드): 키 상태 + API 키 설정
export default function Header({ hasKey, keyRequired = true, onOpenKeyModal, teamMode = false, userEmail = '', onLogout }) {
  return (
    <header
      style={{
        height: 64,
        flex: 'none',
        background: '#ffffff',
        borderBottom: '1px solid #ebebeb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#ff4800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 18,
            boxShadow: 'rgba(255,72,0,0.28) 0px 4px 12px',
          }}
        >
          Q
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.4px' }}>큐이미지 스튜디오</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#ff4800',
              background: '#fff1eb',
              padding: '3px 8px',
              borderRadius: 32,
              letterSpacing: '0.2px',
            }}
          >
            GPT Image
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {teamMode ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#6a6a6a', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </span>
            <button
              onClick={onLogout}
              className="q-hover-fog"
              style={{
                background: 'transparent',
                border: '1px solid #222222',
                borderRadius: 8,
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#222222',
                cursor: 'pointer',
                transition: 'background .15s ease',
              }}
            >
              로그아웃
            </button>
          </>
        ) : keyRequired ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 500, color: hasKey ? '#1f8a5b' : '#6a6a6a' }}>
              {hasKey ? '● 연결됨' : '○ 키 미설정'}
            </span>
            <button
              onClick={onOpenKeyModal}
              className="q-hover-fog"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: '1px solid #222222',
                borderRadius: 8,
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#222222',
                cursor: 'pointer',
                transition: 'background .15s ease',
              }}
            >
              API 키 설정
            </button>
          </>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1f8a5b' }}>● 서버 모드</span>
        )}
      </div>
    </header>
  )
}
