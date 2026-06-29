// 하단 생성 기록 스트립 (가로 스크롤 썸네일 + 전체보기 + 합성 보드)
export default function HistoryStrip({ history, onExpand, onOpenPanel, onOpenBoard }) {
  if (!history.length) return null
  return (
    <div style={{ flex: 'none', borderTop: '1px solid #ebebeb', background: '#ffffff', padding: '14px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          생성 기록 <span style={{ color: '#6a6a6a', fontWeight: 400 }}>{history.length}장</span>
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onOpenBoard}
            style={{ background: '#fff1eb', border: '1px solid #ffd9c7', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#cc3a00', cursor: 'pointer' }}
          >
            🎨 합성 보드
          </button>
          <button
            onClick={onOpenPanel}
            style={{ background: 'transparent', border: '1px solid #dddddd', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#222222', cursor: 'pointer' }}
          >
            전체보기 · 관리
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {history.slice(0, 24).map((item) => (
          <img
            key={item.id}
            src={item.url}
            onClick={() => onExpand(item)}
            alt="기록"
            className="q-history-thumb"
            style={{
              flex: 'none',
              width: 64,
              height: 64,
              objectFit: 'cover',
              borderRadius: 14,
              cursor: 'pointer',
              border: '2px solid transparent',
              transition: 'border-color .15s ease',
              background: '#f7f7f7',
            }}
          />
        ))}
      </div>
    </div>
  )
}
