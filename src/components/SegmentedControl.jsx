// 품질/배경/포맷/개수/필터강도 등에서 공통으로 쓰는 세그먼트 토글
export default function SegmentedControl({ options, value, onChange, size = 'md', uppercase = false }) {
  return (
    <div style={{ display: 'flex', gap: 6, background: '#f7f7f7', padding: 4, borderRadius: 12 }}>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: size === 'sm' ? '8px 4px' : '9px 4px',
              borderRadius: 8,
              border: 'none',
              fontSize: size === 'sm' ? 12 : 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all .15s ease',
              textTransform: uppercase ? 'uppercase' : 'none',
              background: active ? '#ffffff' : 'transparent',
              color: active ? '#ff4800' : '#6a6a6a',
              boxShadow: active
                ? 'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.08) 0px 1px 3px 0px'
                : 'none',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
