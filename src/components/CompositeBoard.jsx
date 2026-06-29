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

const HANDLE_KEYS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const CORNER_KEYS = ['nw', 'ne', 'se', 'sw']
const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }

export default function CompositeBoard({ open, layers, onLayersChange, config, onConfigChange, history = [], resolveItem, onAddImage, onClose }) {
  const compRef = useRef(null)
  const overlayRef = useRef(null)
  const workspaceRef = useRef(null)
  const cacheRef = useRef(new Map()) // src -> HTMLImageElement
  const fileRef = useRef(null)
  const dragRef = useRef(null)
  const [tick, setTick] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [cursor, setCursor] = useState('default')

  // ── 이미지 로드 ──────────────────────
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

  // ── 줌: 열릴 때/보드 크기 변경 시 맞춤 ──
  const fitZoom = () => {
    const el = workspaceRef.current
    if (!el) return
    const availW = el.clientWidth - 56
    const availH = el.clientHeight - 72
    const z = Math.min(availW / config.w, availH / config.h, 1)
    setZoom(Math.max(0.05, z || 1))
  }
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(fitZoom)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, config.w, config.h])

  const update = (id, patch) =>
    onLayersChange((prev) => prev.map((l) => (l.id === id ? { ...l, ...(typeof patch === 'function' ? patch(l) : patch) } : l)))

  // ── 렌더 (preview = export 동일 경로) ──
  const renderComposite = (canvas, jpegBg) => {
    const c = canvas || compRef.current
    if (!c) return null
    c.width = config.w
    c.height = config.h
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    const bg = jpegBg && config.bg === 'transparent' ? '#ffffff' : config.bg
    if (bg && bg !== 'transparent') {
      ctx.fillStyle = bg === 'white' ? '#ffffff' : bg
      ctx.fillRect(0, 0, c.width, c.height)
    }
    for (const l of layers) {
      if (!l.visible) continue
      const img = cacheRef.current.get(l.src)
      if (!img) continue
      ctx.save()
      ctx.globalAlpha = l.opacity == null ? 1 : l.opacity
      ctx.globalCompositeOperation = l.blend || 'source-over'
      const rot = l.rotation || 0
      if (rot) {
        ctx.translate(l.x + l.w / 2, l.y + l.h / 2)
        ctx.rotate((rot * Math.PI) / 180)
        ctx.drawImage(img, -l.w / 2, -l.h / 2, l.w, l.h)
      } else {
        ctx.drawImage(img, l.x, l.y, l.w, l.h)
      }
      ctx.restore()
    }
    return c
  }

  const boardScale = () => {
    const o = overlayRef.current
    if (!o) return 1
    const r = o.getBoundingClientRect()
    return r.width > 0 ? config.w / r.width : 1
  }

  const handlePos = (l, key) => {
    const { x, y, w, h } = l
    switch (key) {
      case 'nw': return [x, y]
      case 'n': return [x + w / 2, y]
      case 'ne': return [x + w, y]
      case 'e': return [x + w, y + h / 2]
      case 'se': return [x + w, y + h]
      case 's': return [x + w / 2, y + h]
      case 'sw': return [x, y + h]
      case 'w': return [x, y + h / 2]
      default: return [x, y]
    }
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
    const s = boardScale()
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 1.5 * s
    ctx.setLineDash([6 * s, 4 * s])
    ctx.strokeRect(l.x, l.y, l.w, l.h)
    ctx.setLineDash([])
    const hs = 9 * s
    HANDLE_KEYS.forEach((k) => {
      const [hx, hy] = handlePos(l, k)
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 1.5 * s
      ctx.beginPath()
      ctx.rect(hx - hs / 2, hy - hs / 2, hs, hs)
      ctx.fill()
      ctx.stroke()
    })
  }

  useEffect(() => {
    if (open) renderComposite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, config, tick, open])

  useEffect(() => {
    if (open) renderOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, selectedId, config, tick, open, zoom])

  // ── 좌표/히트테스트 ───────────────────
  const toBoard = (e) => {
    const o = overlayRef.current
    const r = o.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * config.w, y: ((e.clientY - r.top) / r.height) * config.h }
  }
  const hitHandle = (l, p) => {
    const rad = 13 * boardScale()
    for (const k of HANDLE_KEYS) {
      const [hx, hy] = handlePos(l, k)
      if (Math.abs(p.x - hx) <= rad && Math.abs(p.y - hy) <= rad) return k
    }
    return null
  }
  const inRect = (l, p) => p.x >= l.x && p.x <= l.x + l.w && p.y >= l.y && p.y <= l.y + l.h

  const onPointerDown = (e) => {
    e.preventDefault()
    try {
      overlayRef.current.setPointerCapture?.(e.pointerId)
    } catch (err) {
      /* 일부 환경에서 capture 실패해도 인터랙션은 진행 */
    }
    const p = toBoard(e)
    const sel = layers.find((x) => x.id === selectedId)
    if (sel && sel.visible) {
      const k = hitHandle(sel, p)
      if (k) {
        dragRef.current = { type: 'resize', id: sel.id, handle: k, aspect: sel.w / sel.h || 1 }
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

  const resize = (l, handle, p, aspect, shift) => {
    let { x, y, w, h } = l
    const keep = CORNER_KEYS.includes(handle) && !shift // 코너 기본 비율 유지, Shift=자유
    const min = 16
    if (handle === 'e') w = Math.max(min, p.x - x)
    else if (handle === 'w') { const ax = x + w; w = Math.max(min, ax - p.x); x = ax - w }
    else if (handle === 's') h = Math.max(min, p.y - y)
    else if (handle === 'n') { const ay = y + h; h = Math.max(min, ay - p.y); y = ay - h }
    else if (handle === 'se') { w = Math.max(min, p.x - x); h = keep ? w / aspect : Math.max(min, p.y - y) }
    else if (handle === 'ne') { const ay = y + h; w = Math.max(min, p.x - x); h = keep ? w / aspect : Math.max(min, ay - p.y); y = ay - h }
    else if (handle === 'sw') { const ax = x + w; w = Math.max(min, ax - p.x); h = keep ? w / aspect : Math.max(min, p.y - y); x = ax - w }
    else if (handle === 'nw') { const ax = x + w, ay = y + h; w = Math.max(min, ax - p.x); h = keep ? w / aspect : Math.max(min, ay - p.y); x = ax - w; y = ay - h }
    return { x, y, w, h }
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) {
      // hover 커서
      const sel = layers.find((x) => x.id === selectedId)
      if (sel && sel.visible) {
        const k = hitHandle(sel, toBoard(e))
        setCursor(k ? CURSORS[k] : inRect(sel, toBoard(e)) ? 'move' : 'default')
      } else setCursor('default')
      return
    }
    const p = toBoard(e)
    if (d.type === 'move') {
      update(d.id, () => ({ x: p.x - d.offX, y: p.y - d.offY }))
    } else if (d.type === 'resize') {
      update(d.id, (l) => resize(l, d.handle, p, d.aspect, e.shiftKey))
    }
  }

  const onPointerUp = (e) => {
    dragRef.current = null
    try {
      overlayRef.current.releasePointerCapture?.(e.pointerId)
    } catch (err) {
      /* 무시 */
    }
  }

  // ── 레이어 조작 ──────────────────────
  const removeLayer = (id) => {
    onLayersChange((prev) => prev.filter((l) => l.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }
  const move = (id, dir) =>
    onLayersChange((prev) => {
      const i = prev.findIndex((l) => l.id === id)
      if (i < 0) return prev
      const j = dir === 'up' ? i + 1 : i - 1
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  // ── 키보드 ───────────────────────────
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return
      if ((e.metaKey || e.ctrlKey) && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        if (!selectedId && layers.length) setSelectedId(layers[layers.length - 1].id)
        return
      }
      if (e.key === 'Escape') {
        if (selectedId) setSelectedId(null)
        else onClose()
        return
      }
      const sel = layers.find((l) => l.id === selectedId)
      if (!sel) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeLayer(sel.id)
        return
      }
      const step = e.shiftKey ? 10 : 1
      if (e.key === 'ArrowLeft') { e.preventDefault(); update(sel.id, (l) => ({ x: l.x - step })) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); update(sel.id, (l) => ({ x: l.x + step })) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); update(sel.id, (l) => ({ y: l.y - step })) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); update(sel.id, (l) => ({ y: l.y + step })) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId, layers])

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
    const c = renderComposite(document.createElement('canvas'), isJpeg)
    if (!c) return
    c.toBlob(
      (blob) => blob && downloadBlob(blob, `board-${uid()}.${isJpeg ? 'jpg' : 'png'}`),
      isJpeg ? 'image/jpeg' : 'image/png',
      0.92
    )
  }

  if (!open) return null
  const selected = layers.find((l) => l.id === selectedId)
  const ordered = [...layers].reverse() // 패널: 위가 앞
  const setZoomClamped = (z) => setZoom(Math.min(4, Math.max(0.05, z)))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#2b2b2e', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 바 */}
      <div style={{ flex: 'none', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#202022', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>🎨 합성 보드</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>레이어 {layers.length}개</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 줌 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 6 }}>
            <button onClick={() => setZoomClamped(zoom / 1.25)} style={zoomBtn}>−</button>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, width: 46, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoomClamped(zoom * 1.25)} style={zoomBtn}>+</button>
            <button onClick={fitZoom} style={{ ...zoomBtn, width: 'auto', padding: '0 8px', fontSize: 11 }}>맞춤</button>
          </div>
          <button onClick={() => exportBoard('png')} style={btn('#ff4800')}>PNG 저장</button>
          <button onClick={() => exportBoard('jpeg')} style={btn('#3a3a3d')}>JPEG 저장</button>
          <button onClick={onClose} style={{ ...btn('transparent'), border: '1px solid rgba(255,255,255,0.25)' }}>닫기</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* 작업대 */}
        <div ref={workspaceRef} style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'auto', background: '#3a3a3d' }}>
          <div style={{ margin: 'auto', padding: 28 }}>
            {/* 사이즈 라벨 */}
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>
              {config.w} × {config.h} px · {Math.round(zoom * 100)}%
            </div>
            <div
              style={{
                position: 'relative',
                width: config.w * zoom,
                height: config.h * zoom,
                border: '1px solid rgba(0,0,0,0.5)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
                backgroundColor: config.bg === 'transparent' ? '#ffffff' : config.bg === 'white' ? '#fff' : config.bg,
                backgroundImage:
                  config.bg === 'transparent'
                    ? 'linear-gradient(45deg,#d8d8d8 25%,transparent 25%),linear-gradient(-45deg,#d8d8d8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d8d8d8 75%),linear-gradient(-45deg,transparent 75%,#d8d8d8 75%)'
                    : 'none',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0,0 12px,12px -12px,-12px 0',
              }}
            >
              <canvas ref={compRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
              <canvas
                ref={overlayRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', cursor, touchAction: 'none' }}
              />
            </div>
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
              {[{ v: 'transparent', t: '투명' }, { v: 'white', t: '흰색' }, { v: '#111111', t: '검정' }].map((o) => (
                <button key={o.v} onClick={() => onConfigChange({ ...config, bg: o.v })} style={chip(config.bg === o.v)}>{o.t}</button>
              ))}
            </div>
          </div>

          {/* 이미지 추가 */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #ebebeb', display: 'flex', gap: 8 }}>
            <button onClick={() => fileRef.current && fileRef.current.click()} style={{ ...addBtn, flex: 1 }}>＋ 업로드</button>
            <button onClick={() => setPicker((v) => !v)} style={{ ...addBtn, flex: 1, background: picker ? '#fff1eb' : '#fff', borderColor: picker ? '#ff4800' : '#dddddd', color: picker ? '#ff4800' : '#222' }}>＋ 기록에서</button>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { Array.from(e.target.files || []).forEach(addFile); e.target.value = '' }} />
          </div>

          {picker && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #ebebeb', maxHeight: 200, overflowY: 'auto' }}>
              {history.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6a6a6a' }}>기록이 없습니다.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {history.slice(0, 30).map((item) => (
                    <img key={item.id} src={item.url} alt="" onClick={() => !busy && addFromHistory(item)} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid #ebebeb', opacity: busy ? 0.5 : 1 }} />
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
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 10, cursor: 'pointer', border: '1px solid ' + (selectedId === l.id ? '#2563eb' : '#ebebeb'), background: selectedId === l.id ? '#eff5ff' : '#fff' }}
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
                {BLEND_MODES.map((b) => (<option key={b.value} value={b.value}>{b.label}</option>))}
              </select>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={lbl}>불투명도</label>
                <span style={{ fontSize: 11, color: '#6a6a6a' }}>{Math.round((selected.opacity == null ? 1 : selected.opacity) * 100)}%</span>
              </div>
              <input type="range" min="0" max="100" value={Math.round((selected.opacity == null ? 1 : selected.opacity) * 100)} onChange={(e) => update(selected.id, { opacity: Number(e.target.value) / 100 })} style={{ width: '100%', accentColor: '#2563eb', marginBottom: 10 }} />
              <div style={{ fontSize: 10, color: '#8a8a8a', marginBottom: 10, lineHeight: 1.5 }}>
                코너 드래그=비율 유지 · Shift=자유 · 방향키=1px(Shift 10px) · Del=삭제 · ⌘/Ctrl+T=변형
              </div>
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

const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' })
const zoomBtn = { width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontSize: 14, cursor: 'pointer', lineHeight: 1 }
const numInput = { width: '100%', border: '1px solid #dddddd', borderRadius: 8, padding: '7px 9px', fontSize: 13, color: '#222' }
const chip = (active) => ({ flex: 1, border: '1px solid ' + (active ? '#ff4800' : '#dddddd'), background: active ? '#fff1eb' : '#fff', color: active ? '#ff4800' : '#222', borderRadius: 8, padding: '7px 4px', fontSize: 12, fontWeight: 600, cursor: 'pointer' })
const addBtn = { border: '1px solid #dddddd', background: '#fff', color: '#222', borderRadius: 9, padding: '9px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const iconBtn = { background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer', flex: 'none', lineHeight: 1 }
const lbl = { fontSize: 11, fontWeight: 600, color: '#6a6a6a' }
const miniBtn = { flex: 1, border: '1px solid #dddddd', background: '#fff', color: '#222', borderRadius: 8, padding: '8px 4px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
