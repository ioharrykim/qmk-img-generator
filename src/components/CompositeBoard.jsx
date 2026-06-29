import { useEffect, useRef, useState } from 'react'
import { downloadBlob, blobToDataUrl, uid } from '../utils'

// 포토샵 웹 느낌의 레이어 합성 보드 (100% 클라이언트, OpenAI 미사용)
// 브라우저 Canvas globalCompositeOperation = 포토샵 블렌딩 모드

const BLEND_MODES = [
  { value: 'source-over', label: '보통' },
  { value: 'multiply', label: '곱하기 (Multiply)' },
  { value: 'screen', label: '스크린 (Screen)' },
  { value: 'overlay', label: '오버레이 (Overlay)' },
  { value: 'darken', label: '어둡게 (Darken)' },
  { value: 'lighten', label: '밝게 (Lighten)' },
  { value: 'color-dodge', label: '컬러 닷지' },
  { value: 'color-burn', label: '컬러 번' },
  { value: 'hard-light', label: '하드 라이트' },
  { value: 'soft-light', label: '소프트 라이트' },
  { value: 'difference', label: '차이 (Difference)' },
  { value: 'exclusion', label: '제외 (Exclusion)' },
  { value: 'hue', label: '색조 (Hue)' },
  { value: 'saturation', label: '채도 (Saturation)' },
  { value: 'color', label: '색상 (Color)' },
  { value: 'luminosity', label: '광도 (Luminosity)' },
]

const HANDLE_KEYS = ['nw', 'ne', 'sw', 'se']

export default function CompositeBoard({ open, layers, onLayersChange, config, onConfigChange, history = [], resolveItem, onAddImage, onClose }) {
  const compRef = useRef(null)
  const overlayRef = useRef(null)
  const cacheRef = useRef(new Map()) // src -> HTMLImageElement
  const fileRef = useRef(null)
  const dragRef = useRef(null)
  const [tick, setTick] = useState(0) // 이미지 로드 후 리렌더 트리거
  const [selectedId, setSelectedId] = useState(null)
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)

  // 레이어 이미지 로드 (src 캐시)
  useEffect(() => {
    if (!open) return
    let alive = true
    layers.forEach((l) => {
      if (!l.src || cacheRef.current.has(l.src)) return
      const img = new Image()
      img.onload = () => {
        if (!alive) return
        cacheRef.current.set(l.src, img)
        setTick((t) => t + 1)
      }
      img.src = l.src
    })
    return () => {
      alive = false
    }
  }, [layers, open])

  const update = (id, patch) =>
    onLayersChange((prev) => prev.map((l) => (l.id === id ? { ...l, ...(typeof patch === 'function' ? patch(l) : patch) } : l)))

  // ── 렌더 ──────────────────────────────
  const renderComposite = (forExport, jpegBg) => {
    const c = compRef.current
    if (!c) return null
    c.width = config.w
    c.height = config.h
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    const bg = forExport && jpegBg && config.bg === 'transparent' ? '#ffffff' : config.bg
    if (bg && bg !== 'transparent') {
      ctx.fillStyle = bg === 'white' ? '#ffffff' : bg
      ctx.fillRect(0, 0, c.width, c.height)
    }
    for (const l of layers) {
      if (!l.visible) continue
      const img = cacheRef.current.get(l.src)
      if (!img) continue
      ctx.globalAlpha = l.opacity == null ? 1 : l.opacity
      ctx.globalCompositeOperation = l.blend || 'source-over'
      ctx.drawImage(img, l.x, l.y, l.w, l.h)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    return c
  }

  const renderOverlay = () => {
    const o = overlayRef.current
    if (!o) return
    o.width = config.w
    o.height = config.h
    const ctx = o.getContext('2d')
    ctx.clearRect(0, 0, o.width, o.height)
    const l = layers.find((x) => x.id === selectedId)
    if (!l) return
    const lw = Math.max(2, config.w / 360)
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = lw
    ctx.strokeRect(l.x, l.y, l.w, l.h)
    const hs = Math.max(10, config.w / 90)
    ctx.fillStyle = '#2563eb'
    corners(l).forEach(([cx, cy]) => ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs))
  }

  useEffect(() => {
    if (open) renderComposite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, config, tick, open])

  useEffect(() => {
    if (open) renderOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, selectedId, config, tick, open])

  // ── 좌표/히트테스트 ───────────────────
  const toBoard = (e) => {
    const o = overlayRef.current
    const r = o.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * config.w, y: ((e.clientY - r.top) / r.height) * config.h }
  }
  const corners = (l) => [
    [l.x, l.y],
    [l.x + l.w, l.y],
    [l.x, l.y + l.h],
    [l.x + l.w, l.y + l.h],
  ]
  const hitCorner = (l, p) => {
    const r = Math.max(14, config.w / 70)
    const c = corners(l)
    for (let i = 0; i < c.length; i++) {
      if (Math.hypot(p.x - c[i][0], p.y - c[i][1]) <= r) return HANDLE_KEYS[i]
    }
    return null
  }
  const inRect = (l, p) => p.x >= l.x && p.x <= l.x + l.w && p.y >= l.y && p.y <= l.y + l.h

  const onPointerDown = (e) => {
    e.preventDefault()
    overlayRef.current.setPointerCapture?.(e.pointerId)
    const p = toBoard(e)
    const sel = layers.find((x) => x.id === selectedId)
    if (sel && sel.visible) {
      const corner = hitCorner(sel, p)
      if (corner) {
        dragRef.current = { type: 'resize', id: sel.id, corner, aspect: sel.aspect || sel.w / sel.h }
        return
      }
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i]
      if (l.visible && inRect(l, p)) {
        setSelectedId(l.id)
        dragRef.current = { type: 'move', id: l.id, offX: p.x - l.x, offY: p.y - l.y }
        return
      }
    }
    setSelectedId(null)
  }

  const onPointerMove = (e) => {
    if (!dragRef.current) return
    const p = toBoard(e)
    const d = dragRef.current
    if (d.type === 'move') {
      update(d.id, (l) => ({ x: p.x - d.offX, y: p.y - d.offY }))
    } else if (d.type === 'resize') {
      update(d.id, (l) => {
        const aspect = d.aspect || l.w / l.h || 1
        let { x, y, w, h } = l
        if (d.corner === 'se') {
          w = Math.max(16, p.x - l.x)
          h = w / aspect
        } else if (d.corner === 'ne') {
          w = Math.max(16, p.x - l.x)
          h = w / aspect
          y = l.y + l.h - h
        } else if (d.corner === 'sw') {
          w = Math.max(16, l.x + l.w - p.x)
          h = w / aspect
          x = l.x + l.w - w
        } else {
          // nw
          w = Math.max(16, l.x + l.w - p.x)
          h = w / aspect
          x = l.x + l.w - w
          y = l.y + l.h - h
        }
        return { x, y, w, h }
      })
    }
  }

  const onPointerUp = (e) => {
    dragRef.current = null
    overlayRef.current.releasePointerCapture?.(e.pointerId)
  }

  // ── 레이어 조작 ──────────────────────
  const removeLayer = (id) => {
    onLayersChange((prev) => prev.filter((l) => l.id !== id))
    if (selectedId === id) setSelectedId(null)
  }
  const move = (id, dir) =>
    onLayersChange((prev) => {
      const i = prev.findIndex((l) => l.id === id)
      if (i < 0) return prev
      const j = dir === 'up' ? i + 1 : i - 1 // up = 앞으로(위) = 배열 뒤
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  // ── 이미지 추가 ──────────────────────
  const addFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await blobToDataUrl(file)
      const dims = await imgDims(dataUrl)
      onAddImage({ dataUrl, name: file.name || '레이어', ...dims })
    } catch (e) {
      /* 무시 */
    }
  }
  const addFromHistory = async (item) => {
    if (!resolveItem) return
    setBusy(true)
    try {
      const payload = await resolveItem(item)
      if (payload) onAddImage(payload)
      setPicker(false)
    } catch (e) {
      /* 무시 */
    } finally {
      setBusy(false)
    }
  }

  // ── 내보내기 ─────────────────────────
  const exportBoard = (format) => {
    const isJpeg = format === 'jpeg'
    const c = renderComposite(true, isJpeg)
    if (!c) return
    c.toBlob(
      (blob) => {
        if (blob) downloadBlob(blob, `board-${uid()}.${isJpeg ? 'jpg' : 'png'}`)
        renderComposite() // 표시용 재렌더 (jpeg 흰배경 제거)
      },
      isJpeg ? 'image/jpeg' : 'image/png',
      0.92
    )
  }

  if (!open) return null
  const selected = layers.find((l) => l.id === selectedId)
  // 패널은 위가 앞(front) → 배열 역순
  const ordered = [...layers].reverse()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,20,22,0.92)', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 바 */}
      <div style={{ flex: 'none', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>🎨 합성 보드</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>레이어 {layers.length}개</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => exportBoard('png')} style={btn('#ff4800')}>PNG 저장</button>
          <button onClick={() => exportBoard('jpeg')} style={btn('#222')}>JPEG 저장</button>
          <button onClick={onClose} style={{ ...btn('transparent'), border: '1px solid rgba(255,255,255,0.3)' }}>닫기</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* 캔버스 영역 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' }}>
          <div
            style={{
              position: 'relative',
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: `${config.w} / ${config.h}`,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              backgroundColor: '#fff',
              backgroundImage:
                config.bg === 'transparent'
                  ? 'linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)'
                  : 'none',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
            }}
          >
            <canvas ref={compRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
            <canvas
              ref={overlayRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', cursor: 'move', touchAction: 'none' }}
            />
          </div>
        </div>

        {/* 우측 패널 */}
        <div style={{ flex: 'none', width: 300, background: '#ffffff', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* 보드 설정 */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #ebebeb' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#222', marginBottom: 10 }}>아트보드</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input type="number" value={config.w} onChange={(e) => onConfigChange({ ...config, w: Math.max(16, Number(e.target.value) || 16) })} style={numInput} />
              <span style={{ color: '#6a6a6a' }}>×</span>
              <input type="number" value={config.h} onChange={(e) => onConfigChange({ ...config, h: Math.max(16, Number(e.target.value) || 16) })} style={numInput} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { v: 'transparent', t: '투명' },
                { v: 'white', t: '흰색' },
                { v: '#111111', t: '검정' },
              ].map((o) => (
                <button key={o.v} onClick={() => onConfigChange({ ...config, bg: o.v })} style={chip(config.bg === o.v)}>
                  {o.t}
                </button>
              ))}
            </div>
          </div>

          {/* 이미지 추가 */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #ebebeb', display: 'flex', gap: 8 }}>
            <button onClick={() => fileRef.current && fileRef.current.click()} style={{ ...addBtn, flex: 1 }}>＋ 업로드</button>
            <button onClick={() => setPicker((v) => !v)} style={{ ...addBtn, flex: 1, background: picker ? '#fff1eb' : '#fff', borderColor: picker ? '#ff4800' : '#dddddd', color: picker ? '#ff4800' : '#222' }}>
              ＋ 기록에서
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { Array.from(e.target.files || []).forEach(addFile); e.target.value = '' }} />
          </div>

          {picker && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #ebebeb', maxHeight: 220, overflowY: 'auto' }}>
              {history.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6a6a6a' }}>기록이 없습니다.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {history.slice(0, 30).map((item) => (
                    <img
                      key={item.id}
                      src={item.url}
                      alt=""
                      onClick={() => !busy && addFromHistory(item)}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid #ebebeb', opacity: busy ? 0.5 : 1 }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 레이어 목록 */}
          <div style={{ flex: 1, minHeight: 0, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#222', marginBottom: 10 }}>레이어 <span style={{ fontWeight: 400, color: '#6a6a6a' }}>(위가 앞)</span></div>
            {layers.length === 0 && <div style={{ fontSize: 12, color: '#6a6a6a', lineHeight: 1.6 }}>이미지를 추가해 레이어를 쌓아 보세요.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ordered.map((l) => (
                <div
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 6,
                    borderRadius: 10,
                    cursor: 'pointer',
                    border: '1px solid ' + (selectedId === l.id ? '#2563eb' : '#ebebeb'),
                    background: selectedId === l.id ? '#eff5ff' : '#fff',
                  }}
                >
                  <img src={l.src} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flex: 'none', background: '#f7f7f7' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || '레이어'}</div>
                    <div style={{ fontSize: 10, color: '#6a6a6a' }}>{BLEND_MODES.find((b) => b.value === (l.blend || 'source-over'))?.label}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); update(l.id, (x) => ({ visible: !x.visible })) }} title="표시/숨김" style={iconBtn}>{l.visible ? '👁' : '🚫'}</button>
                </div>
              ))}
            </div>
          </div>

          {/* 선택 레이어 컨트롤 */}
          {selected && (
            <div style={{ flex: 'none', padding: '14px 16px', borderTop: '1px solid #ebebeb', background: '#fafafa' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#222', marginBottom: 10 }}>선택한 레이어</div>
              <label style={lbl}>블렌딩 모드</label>
              <select value={selected.blend || 'source-over'} onChange={(e) => update(selected.id, { blend: e.target.value })} style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 10, padding: '9px 10px', fontSize: 13, color: '#222', marginBottom: 12, background: '#fff' }}>
                {BLEND_MODES.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={lbl}>불투명도</label>
                <span style={{ fontSize: 11, color: '#6a6a6a' }}>{Math.round((selected.opacity == null ? 1 : selected.opacity) * 100)}%</span>
              </div>
              <input type="range" min="0" max="100" value={Math.round((selected.opacity == null ? 1 : selected.opacity) * 100)} onChange={(e) => update(selected.id, { opacity: Number(e.target.value) / 100 })} style={{ width: '100%', accentColor: '#2563eb', marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => move(selected.id, 'up')} style={miniBtn}>앞으로</button>
                <button onClick={() => move(selected.id, 'down')} style={miniBtn}>뒤로</button>
                <button onClick={() => removeLayer(selected.id)} style={{ ...miniBtn, color: '#d4351c', borderColor: '#f0c9c0' }}>삭제</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function imgDims(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({})
    img.src = src
  })
}

const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' })
const numInput = { width: '100%', border: '1px solid #dddddd', borderRadius: 8, padding: '7px 9px', fontSize: 13, color: '#222' }
const chip = (active) => ({ flex: 1, border: '1px solid ' + (active ? '#ff4800' : '#dddddd'), background: active ? '#fff1eb' : '#fff', color: active ? '#ff4800' : '#222', borderRadius: 8, padding: '7px 4px', fontSize: 12, fontWeight: 600, cursor: 'pointer' })
const addBtn = { border: '1px solid #dddddd', background: '#fff', color: '#222', borderRadius: 9, padding: '9px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const iconBtn = { background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer', flex: 'none', lineHeight: 1 }
const lbl = { fontSize: 11, fontWeight: 600, color: '#6a6a6a' }
const miniBtn = { flex: 1, border: '1px solid #dddddd', background: '#fff', color: '#222', borderRadius: 8, padding: '8px 4px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
