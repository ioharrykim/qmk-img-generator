import { useEffect, useRef, useState } from 'react'

// 마스크 부분 편집(인페인팅) 모달
// 사용자가 칠한 영역 = 다시 그릴 영역. OpenAI edits 의 mask 는 "투명한 곳을 편집"하므로
// 칠한 영역을 투명으로 만든 PNG 마스크를 생성해 전달한다.
const STD_SIZES = ['1024x1024', '1536x1024', '1024x1536', '1792x1024', '1024x1792']

export default function MaskEditor({ base, generating, onClose, onSubmit }) {
  const imgRef = useRef(null)
  const paintRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [dims, setDims] = useState(null) // { w, h }
  const [brush, setBrush] = useState(64)
  const [erasing, setErasing] = useState(false)
  const [hasPaint, setHasPaint] = useState(false)
  const [prompt, setPrompt] = useState('')

  // 이미지 로드 → 캔버스 해상도를 원본 픽셀에 맞춤
  const onImgLoad = (e) => {
    const w = e.target.naturalWidth
    const h = e.target.naturalHeight
    setDims({ w, h })
  }

  useEffect(() => {
    if (!dims) return
    const c = paintRef.current
    if (c) {
      c.width = dims.w
      c.height = dims.h
      const ctx = c.getContext('2d')
      ctx.clearRect(0, 0, c.width, c.height)
    }
    setHasPaint(false)
  }, [dims])

  const pointFromEvent = (e) => {
    const c = paintRef.current
    const rect = c.getBoundingClientRect()
    const sx = c.width / rect.width
    const sy = c.height / rect.height
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  const stroke = (from, to) => {
    const c = paintRef.current
    const ctx = c.getContext('2d')
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over'
    ctx.strokeStyle = 'rgba(255,72,0,1)'
    ctx.fillStyle = 'rgba(255,72,0,1)'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = brush
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(to.x, to.y, brush / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const onDown = (e) => {
    e.preventDefault()
    drawing.current = true
    const p = pointFromEvent(e)
    last.current = p
    stroke(p, p)
    if (!erasing) setHasPaint(true)
  }
  const onMove = (e) => {
    if (!drawing.current) return
    const p = pointFromEvent(e)
    stroke(last.current, p)
    last.current = p
  }
  const onUp = () => {
    drawing.current = false
    last.current = null
  }

  const clearPaint = () => {
    const c = paintRef.current
    if (!c) return
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setHasPaint(false)
  }

  const buildMask = () => {
    const w = dims.w
    const h = dims.h
    const mask = document.createElement('canvas')
    mask.width = w
    mask.height = h
    const ctx = mask.getContext('2d')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h) // 전체 불투명(=유지)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(paintRef.current, 0, 0) // 칠한 곳을 투명(=편집)으로
    return mask
  }

  const submit = () => {
    if (!dims || !hasPaint || generating) return
    const mask = buildMask()
    const size = STD_SIZES.includes(`${dims.w}x${dims.h}`) ? `${dims.w}x${dims.h}` : 'auto'
    mask.toBlob((blob) => {
      onSubmit({
        maskBlob: blob,
        maskDataUrl: mask.toDataURL('image/png'),
        prompt: prompt.trim(),
        width: dims.w,
        height: dims.h,
        size,
      })
    }, 'image/png')
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 85,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 760, maxWidth: '100%', maxHeight: '92vh', background: '#fff', borderRadius: 20, padding: 22, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>🖌 부분 편집 <span style={{ fontSize: 12, fontWeight: 500, color: '#6a6a6a' }}>· 칠한 영역만 다시 생성</span></div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f7f7f7', fontSize: 15, cursor: 'pointer' }}>✕</button>
        </div>

        {/* 캔버스 */}
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#f7f7f7', lineHeight: 0, alignSelf: 'center', maxWidth: '100%' }}>
          <img ref={imgRef} src={base.dataUrl} alt="원본" onLoad={onImgLoad} style={{ display: 'block', maxWidth: '100%', maxHeight: '52vh', userSelect: 'none' }} draggable={false} />
          <canvas
            ref={paintRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5, cursor: 'crosshair', touchAction: 'none' }}
          />
        </div>

        {/* 브러시 컨트롤 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a' }}>브러시</span>
            <input type="range" min="12" max="200" step="4" value={brush} onChange={(e) => setBrush(Number(e.target.value))} style={{ flex: 1, accentColor: '#ff4800' }} />
            <span style={{ fontSize: 12, color: '#6a6a6a', width: 34, textAlign: 'right' }}>{brush}px</span>
          </div>
          <button onClick={() => setErasing(false)} style={segBtn(!erasing)}>칠하기</button>
          <button onClick={() => setErasing(true)} style={segBtn(erasing)}>지우개</button>
          <button onClick={clearPaint} style={{ background: 'transparent', border: '1px solid #dddddd', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#222', cursor: 'pointer' }}>전체 지우기</button>
        </div>

        {/* 프롬프트 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>이 영역을 어떻게 바꿀까요?</label>
          <textarea
            className="q-field"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="예) 배경을 깔끔한 흰색 스튜디오로 / 이 자리에 빨간 사과 추가 / 흐릿한 부분을 선명하게"
            rows={2}
            style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 12, padding: '11px 13px', fontSize: 13, color: '#222', resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#6a6a6a' }}>{hasPaint ? '칠한 영역만 다시 그려집니다.' : '바꾸고 싶은 영역을 칠해 주세요.'}</span>
          <button
            onClick={submit}
            disabled={!hasPaint || !prompt.trim() || generating}
            style={{
              height: 46,
              padding: '0 22px',
              border: 'none',
              borderRadius: 12,
              background: !hasPaint || !prompt.trim() || generating ? '#ffb38f' : '#ff4800',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: !hasPaint || !prompt.trim() || generating ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {generating && <span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,.45)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'qspin .7s linear infinite' }} />}
            {generating ? '생성 중…' : '수정 생성'}
          </button>
        </div>
      </div>
    </div>
  )
}

function segBtn(active) {
  return {
    background: active ? '#fff1eb' : 'transparent',
    border: '1px solid ' + (active ? '#ff4800' : '#dddddd'),
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: active ? '#ff4800' : '#222',
    cursor: 'pointer',
  }
}
