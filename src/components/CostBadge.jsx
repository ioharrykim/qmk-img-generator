import { useState } from 'react'
import { sumUsd, usdToKrw, formatKrw, formatUsd } from '../pricing'

// 헤더의 누적 비용 배지 + 상세 팝오버(환율 조정 포함)
export default function CostBadge({ history, krwRate, sessionUsd, onRateChange, onRefreshRate }) {
  const [open, setOpen] = useState(false)
  const [rateInput, setRateInput] = useState('')

  const totalUsd = sumUsd(history)
  const totalKrw = usdToKrw(totalUsd, krwRate)
  const count = history.length

  const commitRate = () => {
    const v = Number(rateInput)
    if (v > 0) onRateChange(v)
    setRateInput('')
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="OpenAI 사용 비용 (추정)"
        className="q-hover-fog"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#fff7f3',
          border: '1px solid #ffd9c7',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 600,
          color: '#cc3a00',
          cursor: 'pointer',
        }}
      >
        💸 누적 ≈ {formatKrw(totalKrw)}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 41,
              width: 300,
              background: '#ffffff',
              borderRadius: 14,
              padding: 16,
              boxShadow: 'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.16) 0px 8px 28px 0px',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>OpenAI 사용 비용 <span style={{ fontSize: 11, fontWeight: 500, color: '#6a6a6a' }}>(추정)</span></div>

            <Row label="총 생성" value={`${count}장`} />
            <Row label="누적 (USD)" value={formatUsd(totalUsd)} />
            <Row label="누적 (KRW)" value={formatKrw(totalKrw)} strong />
            <Row label="이번 세션" value={`${formatUsd(sessionUsd)} ≈ ${formatKrw(usdToKrw(sessionUsd, krwRate))}`} />

            <div style={{ height: 1, background: '#ebebeb', margin: '12px 0' }} />

            <div style={{ fontSize: 11, fontWeight: 600, color: '#6a6a6a', marginBottom: 6 }}>환율 (1 USD = ? KRW)</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="q-field"
                type="number"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitRate()}
                placeholder={String(Math.round(krwRate))}
                style={{ flex: 1, border: '1px solid #dddddd', borderRadius: 10, padding: '8px 11px', fontSize: 13, color: '#222' }}
              />
              <button onClick={commitRate} style={{ background: '#222', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>적용</button>
              <button onClick={onRefreshRate} title="실시간 환율 다시 불러오기" style={{ background: 'transparent', color: '#6a6a6a', border: '1px solid #dddddd', borderRadius: 8, padding: '8px 10px', fontSize: 12, cursor: 'pointer' }}>↻</button>
            </div>
            <div style={{ fontSize: 11, color: '#6a6a6a', lineHeight: 1.5, marginTop: 10 }}>
              gpt-image-2 공식 단가(저/중/고 × 비율) 기준 추정입니다. 참조 이미지·실제 토큰량에 따라 실제 청구액과 차이가 날 수 있습니다.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: '#6a6a6a' }}>{label}</span>
      <span style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 700 : 600, color: strong ? '#cc3a00' : '#222' }}>{value}</span>
    </div>
  )
}
