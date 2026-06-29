import { useEffect, useRef, useState } from 'react'
import { downloadBlob, blobToDataUrl, uid } from '../utils'

// 포토샵 웹 느낌의 레이어 합성 보드 (100% 클라이언트, OpenAI 미사용)
// - 블렌딩(globalCompositeOperation), 이동/리사이즈, 비파괴 crop, undo/redo
// - 레이어 마스크(브러쉬로 비파괴 지우기)
// 히스토리(layers/config/selectedId)는 App 이 소유 — 여기선 onCommit/getSnapshot 으로 기록.

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
const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
const CROP_MIN = 10
const BRUSH_MIN = 8
const BRUSH_MAX = 240
const BRUSH_STEP = 8
const BRUSH_TYPES = [
  { value: 'soft', label: '원형 소프트' },
  { value: 'hard', label: '원형 기본' },
]

function cropOf(l, img) {
  if (l.crop && l.crop.sw > 0 && l.crop.sh > 0) return l.crop
  return { sx: 0, sy: 0, sw: img ? img.naturalWidth : l.w, sh: img ? img.naturalHeight : l.h }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function localPointForLayer(l, p) {
  const rot = l.rotation || 0
  if (!rot) return { x: p.x - l.x, y: p.y - l.y }
  const cx = l.x + l.w / 2
  const cy = l.y + l.h / 2
  const rad = (-rot * Math.PI) / 180
  const dx = p.x - cx
  const dy = p.y - cy
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad) + l.w / 2,
    y: dx * Math.sin(rad) + dy * Math.cos(rad) + l.h / 2,
  }
}

function maskPointForLayer(l, p, cr) {
  const local = localPointForLayer(l, p)
  if (local.x < 0 || local.y < 0 || local.x > l.w || local.y > l.h) return null
  return {
    x: cr.sx + (local.x / Math.max(1, l.w)) * cr.sw,
    y: cr.sy + (local.y / Math.max(1, l.h)) * cr.sh,
  }
}

function brushRadiusForLayer(l, cr, size) {
  return {
    rx: (size / 2) * (l.w / Math.max(1, cr.sw)),
    ry: (size / 2) * (l.h / Math.max(1, cr.sh)),
  }
}

function paintMaskStamp(ctx, p, size, type) {
  const r = size / 2
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  if (type === 'soft') {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
    g.addColorStop(0, 'rgba(0,0,0,0.85)')
    g.addColorStop(0.55, 'rgba(0,0,0,0.45)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = '#000000'
  }
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function paintMaskStroke(canvas, from, to, size, type) {
  const ctx = canvas.getContext('2d')
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  const step = Math.max(1, size / 4)
  const count = Math.max(1, Math.ceil(dist / step))
  for (let i = 0; i <= count; i++) {
    const t = i / count
    paintMaskStamp(ctx, { x: from.x + dx * t, y: from.y + dy * t }, size, type)
  }
}

// 공통 사각형 리사이즈 (transform: 비율옵션 / crop: bounds 제한)
function resizeRect(r, handle, p, { aspect, keepAspect = false, bounds = null, min = 16 } = {}) {
  let x = r.x, y = r.y, w = r.w, h = r.h
  const right = x + w, bottom = y + h
  const he = handle.includes('e'), hw = handle.includes('w'), hn = handle.includes('n'), hs = handle.includes('s')
  if (he) w = Math.max(min, p.x - x)
  else if (hw) { w = Math.max(min, right - p.x); x = right - w }
  if (hs) h = Math.max(min, p.y - y)
  else if (hn) { h = Math.max(min, bottom - p.y); y = bottom - h }
  const isCorner = (he || hw) && (hn || hs)
  if (keepAspect && isCorner && aspect) {
    h = w / aspect
    if (hn) y = bottom - h
  }
  if (bounds) {
    if (x < bounds.x) { w -= bounds.x - x; x = bounds.x }
    if (y < bounds.y) { h -= bounds.y - y; y = bounds.y }
    if (x + w > bounds.x + bounds.w) w = bounds.x + bounds.w - x
    if (y + h > bounds.y + bounds.h) h = bounds.y + bounds.h - y
    w = Math.max(min, w); h = Math.max(min, h)
  }
  return { x, y, w, h }
}

export default function CompositeBoard({
  open,
  layers,
  onLayersChange,
  config,
  onConfigChange,
  selectedId,
  onSelect,
  getSnapshot,
  onCommit,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  history = [],
  resolveItem,
  onAddImage,
  onClose,
}) {
  const compRef = useRef(null)
  const overlayRef = useRef(null)
  const workspaceRef = useRef(null)
  const cacheRef = useRef(new Map())
  const maskCacheRef = useRef(new Map())
  const fileRef = useRef(null)
  const dragRef = useRef(null)
  const beforeRef = useRef(null) // 슬라이더/사이즈 입력용 임시 snapshot
  const [tick, setTick] = useState(0)
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [cursor, setCursor] = useState('default')
  const [cropMode, setCropMode] = useState(false)
  const [cropDraft, setCropDraft] = useState(null) // {x,y,w,h} (보드 좌표)
  const [maskMode, setMaskMode] = useState(false)
  const [maskCursor, setMaskCursor] = useState(null)
  const [brushType, setBrushType] = useState('soft')
  const [brushSize, setBrushSize] = useState(56)

  const selected = layers.find((l) => l.id === selectedId)

  // 디스크리트 액션 = before snapshot 저장 후 적용
  const commitAct = (fn) => {
    const before = getSnapshot()
    fn()
    onCommit(before)
  }

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

  // ── 줌 맞춤 ──────────────────────────
  const fitZoom = () => {
    const el = workspaceRef.current
    if (!el) return
    const z = Math.min((el.clientWidth - 56) / config.w, (el.clientHeight - 72) / config.h, 1)
    setZoom(Math.max(0.05, z || 1))
  }
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(fitZoom)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, config.w, config.h])

  // crop 모드 종료 시 draft 정리, 선택 변경 시 crop 모드 해제
  useEffect(() => {
    if (!cropMode) setCropDraft(null)
  }, [cropMode])
  useEffect(() => {
    setCropMode(false)
    setMaskMode(false)
    setMaskCursor(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const update = (id, patch) =>
    onLayersChange((prev) => prev.map((l) => (l.id === id ? { ...l, ...(typeof patch === 'function' ? patch(l) : patch) } : l)))

  const setBrushSizeSafe = (next) => setBrushSize((cur) => clamp(typeof next === 'function' ? next(cur) : next, BRUSH_MIN, BRUSH_MAX))

  const getMaskEntry = (layer, img, create = false) => {
    if (!layer || !img) return null
    const w = layer.mask?.width || img.naturalWidth
    const h = layer.mask?.height || img.naturalHeight
    const key = layer.mask?.dataUrl || `full:${w}x${h}`
    const existing = maskCacheRef.current.get(layer.id)
    if (existing && existing.key === key && existing.canvas.width === w && existing.canvas.height === h) return existing
    if (!create && !layer.mask) return existing || null

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    const entry = { canvas, key, width: w, height: h }
    maskCacheRef.current.set(layer.id, entry)

    if (layer.mask?.dataUrl) {
      const maskImg = new Image()
      maskImg.onload = () => {
        const current = maskCacheRef.current.get(layer.id)
        if (current !== entry) return
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(maskImg, 0, 0, w, h)
        setTick((t) => t + 1)
      }
      maskImg.src = layer.mask.dataUrl
    }
    return entry
  }

  // ── 렌더 (preview = export 동일 경로, crop rect 반영) ──
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
      const cr = cropOf(l, img)
      const maskEntry = getMaskEntry(l, img, false)
      const layerCanvas = document.createElement('canvas')
      layerCanvas.width = Math.max(1, Math.round(l.w))
      layerCanvas.height = Math.max(1, Math.round(l.h))
      const layerCtx = layerCanvas.getContext('2d')
      layerCtx.drawImage(img, cr.sx, cr.sy, cr.sw, cr.sh, 0, 0, layerCanvas.width, layerCanvas.height)
      if (maskEntry) {
        layerCtx.save()
        layerCtx.globalCompositeOperation = 'destination-in'
        layerCtx.drawImage(maskEntry.canvas, cr.sx, cr.sy, cr.sw, cr.sh, 0, 0, layerCanvas.width, layerCanvas.height)
        layerCtx.restore()
      }
      ctx.save()
      ctx.globalAlpha = l.opacity == null ? 1 : l.opacity
      ctx.globalCompositeOperation = l.blend || 'source-over'
      const rot = l.rotation || 0
      if (rot) {
        ctx.translate(l.x + l.w / 2, l.y + l.h / 2)
        ctx.rotate((rot * Math.PI) / 180)
        ctx.drawImage(layerCanvas, -l.w / 2, -l.h / 2, l.w, l.h)
      } else {
        ctx.drawImage(layerCanvas, l.x, l.y, l.w, l.h)
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
  const handlePos = (rect, key) => {
    const { x, y, w, h } = rect
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
  const drawHandles = (ctx, rect, s, fill) => {
    const hs = 9 * s
    HANDLE_KEYS.forEach((k) => {
      const [hx, hy] = handlePos(rect, k)
      ctx.fillStyle = fill
      ctx.strokeStyle = '#1f1f1f'
      ctx.lineWidth = 1 * s
      ctx.beginPath()
      ctx.rect(hx - hs / 2, hy - hs / 2, hs, hs)
      ctx.fill()
      ctx.stroke()
    })
  }

  const renderOverlay = () => {
    const o = overlayRef.current
    if (!o) return
    o.width = config.w
    o.height = config.h
    const ctx = o.getContext('2d')
    ctx.clearRect(0, 0, o.width, o.height)
    const s = boardScale()
    if (maskMode && selected) {
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 1.5 * s
      ctx.setLineDash([6 * s, 4 * s])
      ctx.strokeRect(selected.x, selected.y, selected.w, selected.h)
      ctx.setLineDash([])
      if (maskCursor) {
        const img = cacheRef.current.get(selected.src)
        const cr = cropOf(selected, img)
        const { rx, ry } = brushRadiusForLayer(selected, cr, brushSize)
        const rot = ((selected.rotation || 0) * Math.PI) / 180
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5 * s
        ctx.save()
        ctx.translate(maskCursor.x, maskCursor.y)
        ctx.rotate(rot)
        ctx.beginPath()
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'
        ctx.lineWidth = 1 * s
        ctx.beginPath()
        ctx.ellipse(0, 0, rx + 1.5 * s, ry + 1.5 * s, 0, 0, Math.PI * 2)
        ctx.stroke()
        if (brushType === 'soft') {
          ctx.strokeStyle = 'rgba(255,255,255,0.45)'
          ctx.lineWidth = 1 * s
          ctx.beginPath()
          ctx.ellipse(0, 0, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      }
      return
    }
    if (cropMode && selected && cropDraft) {
      const L = selected
      const d = cropDraft
      // 레이어 영역 중 crop 박스 밖을 어둡게
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(L.x, L.y, L.w, d.y - L.y) // top
      ctx.fillRect(L.x, d.y + d.h, L.w, L.y + L.h - (d.y + d.h)) // bottom
      ctx.fillRect(L.x, d.y, d.x - L.x, d.h) // left
      ctx.fillRect(d.x + d.w, d.y, L.x + L.w - (d.x + d.w), d.h) // right
      // crop 박스
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5 * s
      ctx.strokeRect(d.x, d.y, d.w, d.h)
      drawHandles(ctx, d, s, '#ffffff')
      return
    }
    if (!selected) return
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 1.5 * s
    ctx.setLineDash([6 * s, 4 * s])
    ctx.strokeRect(selected.x, selected.y, selected.w, selected.h)
    ctx.setLineDash([])
    drawHandles(ctx, selected, s, '#ffffff')
  }

  useEffect(() => {
    if (open) renderComposite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, config, tick, open])
  useEffect(() => {
    if (open) renderOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, selectedId, config, tick, open, zoom, cropMode, cropDraft, maskMode, maskCursor, brushSize, brushType])

  // ── 좌표/히트테스트 ───────────────────
  const toBoard = (e) => {
    const r = overlayRef.current.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * config.w, y: ((e.clientY - r.top) / r.height) * config.h }
  }
  const hitHandle = (rect, p) => {
    const rad = 13 * boardScale()
    for (const k of HANDLE_KEYS) {
      const [hx, hy] = handlePos(rect, k)
      if (Math.abs(p.x - hx) <= rad && Math.abs(p.y - hy) <= rad) return k
    }
    return null
  }
  const inRect = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

  const onPointerDown = (e) => {
    e.preventDefault()
    try { overlayRef.current.setPointerCapture?.(e.pointerId) } catch (err) { /* noop */ }
    const p = toBoard(e)

    if (maskMode && selected) {
      const img = cacheRef.current.get(selected.src)
      const cr = cropOf(selected, img)
      const mp = maskPointForLayer(selected, p, cr)
      if (!img || !mp) return
      const entry = getMaskEntry(selected, img, true)
      if (!entry) return
      const before = getSnapshot()
      paintMaskStroke(entry.canvas, mp, mp, brushSize, brushType)
      dragRef.current = { type: 'mask-paint', id: selected.id, before, last: mp, painted: true }
      setMaskCursor(p)
      setTick((t) => t + 1)
      return
    }

    if (cropMode && selected && cropDraft) {
      const k = hitHandle(cropDraft, p)
      if (k) { dragRef.current = { type: 'crop-resize', handle: k }; return }
      if (inRect(cropDraft, p)) { dragRef.current = { type: 'crop-move', offX: p.x - cropDraft.x, offY: p.y - cropDraft.y }; return }
      return
    }

    if (selected && selected.visible) {
      const k = hitHandle(selected, p)
      if (k) { dragRef.current = { type: 'resize', id: selected.id, handle: k, aspect: selected.w / selected.h || 1, before: getSnapshot(), moved: false }; return }
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i]
      if (l.visible && inRect(l, p)) {
        if (l.id !== selectedId) onSelect(l.id)
        dragRef.current = { type: 'move', id: l.id, offX: p.x - l.x, offY: p.y - l.y, before: getSnapshot(), moved: false }
        return
      }
    }
    onSelect(null)
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) {
      if (maskMode && selected) {
        const p = toBoard(e)
        const img = cacheRef.current.get(selected.src)
        const mp = img ? maskPointForLayer(selected, p, cropOf(selected, img)) : null
        setMaskCursor(mp ? p : null)
        setCursor(mp ? 'crosshair' : 'default')
        return
      }
      const ref = cropMode ? cropDraft : selected && selected.visible ? selected : null
      if (ref) {
        const p = toBoard(e)
        const k = hitHandle(ref, p)
        setCursor(k ? CURSORS[k] : inRect(ref, p) ? 'move' : 'default')
      } else setCursor('default')
      return
    }
    const p = toBoard(e)
    if (d.type === 'mask-paint') {
      const L = layers.find((l) => l.id === d.id)
      const img = L && cacheRef.current.get(L.src)
      const mp = img ? maskPointForLayer(L, p, cropOf(L, img)) : null
      const entry = L && img ? getMaskEntry(L, img, true) : null
      if (mp && entry) {
        paintMaskStroke(entry.canvas, d.last || mp, mp, brushSize, brushType)
        d.last = mp
        d.painted = true
        setMaskCursor(p)
        setTick((t) => t + 1)
      }
    } else if (d.type === 'crop-move') {
      const L = selected
      let nx = p.x - d.offX, ny = p.y - d.offY
      nx = Math.max(L.x, Math.min(nx, L.x + L.w - cropDraft.w))
      ny = Math.max(L.y, Math.min(ny, L.y + L.h - cropDraft.h))
      setCropDraft((c) => ({ ...c, x: nx, y: ny }))
    } else if (d.type === 'crop-resize') {
      const L = selected
      setCropDraft((c) => resizeRect(c, d.handle, p, { bounds: { x: L.x, y: L.y, w: L.w, h: L.h }, min: CROP_MIN }))
    } else if (d.type === 'move') {
      d.moved = true
      update(d.id, () => ({ x: p.x - d.offX, y: p.y - d.offY }))
    } else if (d.type === 'resize') {
      d.moved = true
      update(d.id, (l) => resizeRect(l, d.handle, p, { aspect: d.aspect, keepAspect: !e.shiftKey, min: 16 }))
    }
  }

  const onPointerUp = (e) => {
    const d = dragRef.current
    dragRef.current = null
    try { overlayRef.current.releasePointerCapture?.(e.pointerId) } catch (err) { /* noop */ }
    if (d && d.type === 'mask-paint') {
      const entry = maskCacheRef.current.get(d.id)
      if (d.painted && entry && d.before) {
        const dataUrl = entry.canvas.toDataURL('image/png')
        entry.key = dataUrl
        update(d.id, { mask: { dataUrl, width: entry.canvas.width, height: entry.canvas.height } })
        onCommit(d.before)
      }
      return
    }
    if (d && (d.type === 'move' || d.type === 'resize') && d.moved && d.before) onCommit(d.before)
  }

  // ── crop 적용/취소/초기화 ──────────────
  const enterCrop = () => {
    if (!selected) return
    setCropDraft({ x: selected.x, y: selected.y, w: selected.w, h: selected.h })
    setCropMode(true)
  }
  const applyCrop = () => {
    if (!selected || !cropDraft) return
    const img = cacheRef.current.get(selected.src)
    const cr = cropOf(selected, img)
    const scaleX = cr.sw / selected.w
    const scaleY = cr.sh / selected.h
    const d = cropDraft
    const nsx = Math.max(0, cr.sx + (d.x - selected.x) * scaleX)
    const nsy = Math.max(0, cr.sy + (d.y - selected.y) * scaleY)
    const nsw = Math.max(1, d.w * scaleX)
    const nsh = Math.max(1, d.h * scaleY)
    commitAct(() => update(selected.id, { x: d.x, y: d.y, w: d.w, h: d.h, crop: { sx: nsx, sy: nsy, sw: nsw, sh: nsh }, aspect: d.w / d.h }))
    setCropMode(false)
  }
  const cancelCrop = () => setCropMode(false)
  const resetCrop = () => {
    if (!selected) return
    const img = cacheRef.current.get(selected.src)
    if (!img) return
    const cr = cropOf(selected, img)
    const scaleX = selected.w / cr.sw
    const scaleY = selected.h / cr.sh
    const nw = img.naturalWidth * scaleX
    const nh = img.naturalHeight * scaleY
    const nx = selected.x - cr.sx * scaleX
    const ny = selected.y - cr.sy * scaleY
    commitAct(() => update(selected.id, { x: nx, y: ny, w: nw, h: nh, crop: { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight }, aspect: nw / nh }))
    setCropMode(false)
  }

  // ── 레이어 마스크 ─────────────────────
  const enterMask = () => {
    if (!selected) return
    const img = cacheRef.current.get(selected.src)
    if (!img) return
    getMaskEntry(selected, img, true)
    setCropMode(false)
    setMaskCursor(null)
    setMaskMode(true)
  }
  const exitMask = () => {
    setMaskMode(false)
    setMaskCursor(null)
  }
  const resetMask = () => {
    if (!selected) return
    const before = getSnapshot()
    maskCacheRef.current.delete(selected.id)
    update(selected.id, { mask: null })
    onCommit(before)
    setTick((t) => t + 1)
  }

  // ── 레이어 조작 (히스토리 포함) ────────
  const removeLayer = (id) =>
    commitAct(() => {
      onLayersChange((prev) => prev.filter((l) => l.id !== id))
      if (selectedId === id) onSelect(null)
    })
  const moveOrder = (id, dir) =>
    commitAct(() =>
      onLayersChange((prev) => {
        const i = prev.findIndex((l) => l.id === id)
        if (i < 0) return prev
        const j = dir === 'up' ? i + 1 : i - 1
        if (j < 0 || j >= prev.length) return prev
        const next = [...prev]
        ;[next[i], next[j]] = [next[j], next[i]]
        return next
      })
    )
  const setBlend = (id, blend) => commitAct(() => update(id, { blend }))
  const toggleVisible = (id) => commitAct(() => update(id, (l) => ({ visible: !l.visible })))
  const setBg = (bg) => commitAct(() => onConfigChange({ ...config, bg }))

  // ── 키보드 (단일 바인딩 + 최신 상태 ref) ──
  const stateRef = useRef({})
  stateRef.current = { selected, selectedId, layers, cropMode, cropDraft, maskMode, canUndo, canRedo, applyCrop, cancelCrop, enterCrop, enterMask, exitMask, removeLayer, update, getSnapshot, onCommit, onUndo, onRedo, onSelect, onClose, setBrushSizeSafe }
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return
      const st = stateRef.current
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) st.onRedo()
        else st.onUndo()
        return
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); st.onRedo(); return }
      if (mod && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        if (!st.selectedId && st.layers.length) st.onSelect(st.layers[st.layers.length - 1].id)
        return
      }
      if (st.cropMode) {
        if (e.key === 'Enter') { e.preventDefault(); st.applyCrop() }
        else if (e.key === 'Escape') { e.preventDefault(); st.cancelCrop() }
        return
      }
      if (st.maskMode) {
        if (e.key === 'Escape') { e.preventDefault(); st.exitMask() }
        else if (e.key === ']') { e.preventDefault(); st.setBrushSizeSafe((v) => v + BRUSH_STEP) }
        else if (e.key === '[') { e.preventDefault(); st.setBrushSizeSafe((v) => v - BRUSH_STEP) }
        return
      }
      if ((e.key === 'c' || e.key === 'C') && !mod && st.selected) { e.preventDefault(); st.enterCrop(); return }
      if ((e.key === 'm' || e.key === 'M') && !mod && st.selected) { e.preventDefault(); st.enterMask(); return }
      if (e.key === 'Escape') {
        if (st.selectedId) st.onSelect(null)
        else st.onClose()
        return
      }
      const sel = st.selected
      if (!sel) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); st.removeLayer(sel.id); return }
      const step = e.shiftKey ? 10 : 1
      const moveBy = (dx, dy) => {
        e.preventDefault()
        const before = st.getSnapshot()
        st.update(sel.id, (l) => ({ x: l.x + dx, y: l.y + dy }))
        st.onCommit(before)
      }
      if (e.key === 'ArrowLeft') moveBy(-step, 0)
      else if (e.key === 'ArrowRight') moveBy(step, 0)
      else if (e.key === 'ArrowUp') moveBy(0, -step)
      else if (e.key === 'ArrowDown') moveBy(0, step)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // ── 이미지 추가 ──────────────────────
  const addFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await blobToDataUrl(file)
      const dims = await imgDims(dataUrl)
      onAddImage({ dataUrl, name: file.name || '레이어', ...dims })
    } catch (e) { /* noop */ }
  }
  const addFromHistory = async (item) => {
    if (!resolveItem) return
    setBusy(true)
    try {
      const payload = await resolveItem(item)
      if (payload) onAddImage(payload)
      setPicker(false)
    } catch (e) { /* noop */ } finally { setBusy(false) }
  }

  // ── 내보내기 ─────────────────────────
  const exportBoard = (format) => {
    const isJpeg = format === 'jpeg'
    const c = renderComposite(document.createElement('canvas'), isJpeg)
    if (!c) return
    c.toBlob((blob) => blob && downloadBlob(blob, `board-${uid()}.${isJpeg ? 'jpg' : 'png'}`), isJpeg ? 'image/jpeg' : 'image/png', 0.92)
  }

  if (!open) return null
  const ordered = [...layers].reverse()
  const setZoomClamped = (z) => setZoom(Math.min(4, Math.max(0.05, z)))
  const clearSelectionFromWorkspace = (e) => {
    if (overlayRef.current && overlayRef.current.contains(e.target)) return
    onSelect(null)
    setCursor('default')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#2b2b2e', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 바 */}
      <div style={{ flex: 'none', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#202022', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>🎨 합성 보드</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>레이어 {layers.length}개</span>
          {cropMode && <span style={{ fontSize: 12, fontWeight: 700, color: '#ffd24a' }}>✂️ Crop 모드 · Enter 적용 / Esc 취소</span>}
          {maskMode && <span style={{ fontSize: 12, fontWeight: 700, color: '#fdba74' }}>🖌️ 마스크 모드 · 드래그로 지우기 · [ 작게 · ] 크게 · Esc 종료</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onUndo} disabled={!canUndo} style={topBtn(!canUndo)} title="실행 취소 (⌘/Ctrl+Z)">↶ Undo</button>
          <button onClick={onRedo} disabled={!canRedo} style={topBtn(!canRedo)} title="다시 실행 (⌘/Ctrl+Shift+Z)">↷ Redo</button>
          <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 6 }}>
            <button onClick={() => setZoomClamped(zoom / 1.25)} style={zoomBtn}>−</button>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, width: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
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
        <div ref={workspaceRef} onPointerDown={clearSelectionFromWorkspace} style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'auto', background: '#3a3a3d' }}>
          <div style={{ margin: 'auto', padding: 28 }}>
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
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #ebebeb' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#222', marginBottom: 10 }}>아트보드</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input
                type="number"
                value={config.w}
                onFocus={() => { beforeRef.current = { snap: getSnapshot(), w: config.w, h: config.h } }}
                onChange={(e) => onConfigChange({ ...config, w: Math.max(16, Number(e.target.value) || 16) })}
                onBlur={() => { const b = beforeRef.current; if (b && (b.w !== config.w || b.h !== config.h)) onCommit(b.snap); beforeRef.current = null }}
                style={numInput}
              />
              <span style={{ color: '#6a6a6a' }}>×</span>
              <input
                type="number"
                value={config.h}
                onFocus={() => { beforeRef.current = { snap: getSnapshot(), w: config.w, h: config.h } }}
                onChange={(e) => onConfigChange({ ...config, h: Math.max(16, Number(e.target.value) || 16) })}
                onBlur={() => { const b = beforeRef.current; if (b && (b.w !== config.w || b.h !== config.h)) onCommit(b.snap); beforeRef.current = null }}
                style={numInput}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ v: 'transparent', t: '투명' }, { v: 'white', t: '흰색' }, { v: '#111111', t: '검정' }].map((o) => (
                <button key={o.v} onClick={() => setBg(o.v)} style={chip(config.bg === o.v)}>{o.t}</button>
              ))}
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderBottom: '1px solid #ebebeb', display: 'flex', gap: 8 }}>
            <button onClick={() => fileRef.current && fileRef.current.click()} style={{ ...addBtn, flex: 1 }}>＋ 업로드</button>
            <button onClick={() => setPicker((v) => !v)} style={{ ...addBtn, flex: 1, background: picker ? '#fff1eb' : '#fff', border: '1px solid ' + (picker ? '#ff4800' : '#dddddd'), color: picker ? '#ff4800' : '#222' }}>＋ 기록에서</button>
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

          <div style={{ flex: 1, minHeight: 0, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#222', marginBottom: 10 }}>레이어 <span style={{ fontWeight: 400, color: '#6a6a6a' }}>(위가 앞)</span></div>
            {layers.length === 0 && <div style={{ fontSize: 12, color: '#6a6a6a', lineHeight: 1.6 }}>이미지를 추가해 레이어를 쌓아 보세요.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ordered.map((l) => (
                <div key={l.id} onClick={() => onSelect(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 10, cursor: 'pointer', border: '1px solid ' + (selectedId === l.id ? '#2563eb' : '#ebebeb'), background: selectedId === l.id ? '#eff5ff' : '#fff' }}>
                  <img src={l.src} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flex: 'none', background: '#f7f7f7' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || '레이어'}</div>
                    <div style={{ fontSize: 10, color: '#6a6a6a' }}>{BLEND_MODES.find((b) => b.value === (l.blend || 'source-over'))?.label}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); toggleVisible(l.id) }} title="표시/숨김" style={iconBtn}>{l.visible ? '👁' : '🚫'}</button>
                </div>
              ))}
            </div>
          </div>

          {selected && (
            <div style={{ flex: 'none', padding: '14px 16px', borderTop: '1px solid #ebebeb', background: '#fafafa' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#222', marginBottom: 10 }}>선택한 레이어</div>

              {/* Crop */}
              {cropMode ? (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button onClick={applyCrop} style={{ ...miniBtn, background: '#ff4800', color: '#fff', border: '1px solid #ff4800' }}>적용 (Enter)</button>
                  <button onClick={cancelCrop} style={miniBtn}>취소 (Esc)</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button onClick={enterCrop} style={miniBtn}>✂️ Crop (C)</button>
                  <button onClick={resetCrop} style={miniBtn}>Crop 초기화</button>
                </div>
              )}

              {/* Layer mask */}
              <div style={{ marginBottom: 12, padding: 10, border: '1px solid #e2e2e2', borderRadius: 10, background: maskMode ? '#fff7ed' : '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={lbl}>레이어 마스크</label>
                  <span style={{ fontSize: 10, color: maskMode ? '#ea580c' : '#8a8a8a', fontWeight: 700 }}>{maskMode ? '브러쉬 활성' : '비파괴 지우기'}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {maskMode ? (
                    <button onClick={exitMask} style={{ ...miniBtn, background: '#f97316', color: '#fff', border: '1px solid #f97316' }}>마스크 종료 (Esc)</button>
                  ) : (
                    <button onClick={enterMask} style={miniBtn}>브러쉬 마스크 (M)</button>
                  )}
                  <button onClick={resetMask} style={{ ...miniBtn, color: '#b45309', border: '1px solid #fed7aa' }}>마스크 초기화</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  {BRUSH_TYPES.map((b) => (
                    <button
                      key={b.value}
                      onClick={() => setBrushType(b.value)}
                      style={{
                        ...miniBtn,
                        background: brushType === b.value ? '#fff1eb' : '#fff',
                        color: brushType === b.value ? '#f97316' : '#222',
                        border: '1px solid ' + (brushType === b.value ? '#f97316' : '#dddddd'),
                      }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setBrushSizeSafe((v) => v - BRUSH_STEP)} style={{ ...miniBtn, flex: 'none', width: 38 }}>−</button>
                  <div style={{ flex: 1, height: 34, border: '1px solid #dddddd', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#222', background: '#fff' }}>{brushSize}px</div>
                  <button onClick={() => setBrushSizeSafe((v) => v + BRUSH_STEP)} style={{ ...miniBtn, flex: 'none', width: 38 }}>＋</button>
                </div>
              </div>

              <label style={lbl}>블렌딩 모드</label>
              <select value={selected.blend || 'source-over'} onChange={(e) => setBlend(selected.id, e.target.value)} style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 10, padding: '9px 10px', fontSize: 13, color: '#222', marginBottom: 12, background: '#fff' }}>
                {BLEND_MODES.map((b) => (<option key={b.value} value={b.value}>{b.label}</option>))}
              </select>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={lbl}>불투명도</label>
                <span style={{ fontSize: 11, color: '#6a6a6a' }}>{Math.round((selected.opacity == null ? 1 : selected.opacity) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round((selected.opacity == null ? 1 : selected.opacity) * 100)}
                onPointerDown={() => { beforeRef.current = { snap: getSnapshot() } }}
                onChange={(e) => update(selected.id, { opacity: Number(e.target.value) / 100 })}
                onPointerUp={() => { if (beforeRef.current) { onCommit(beforeRef.current.snap); beforeRef.current = null } }}
                style={{ width: '100%', accentColor: '#2563eb', marginBottom: 10 }}
              />
              <div style={{ fontSize: 10, color: '#8a8a8a', marginBottom: 10, lineHeight: 1.5 }}>
                코너=비율유지 · Shift=자유 · 방향키 1px(Shift 10) · C=Crop · M=마스크 · [/] 브러쉬 크기 · Del=삭제 · ⌘/Ctrl+Z=실행취소
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => moveOrder(selected.id, 'up')} style={miniBtn}>앞으로</button>
                <button onClick={() => moveOrder(selected.id, 'down')} style={miniBtn}>뒤로</button>
                <button onClick={() => removeLayer(selected.id)} style={{ ...miniBtn, color: '#d4351c', border: '1px solid #f0c9c0' }}>삭제</button>
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
const topBtn = (disabled) => ({ background: 'transparent', color: disabled ? 'rgba(255,255,255,0.3)' : '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: disabled ? 'default' : 'pointer' })
const zoomBtn = { width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontSize: 14, cursor: 'pointer', lineHeight: 1 }
const numInput = { width: '100%', border: '1px solid #dddddd', borderRadius: 8, padding: '7px 9px', fontSize: 13, color: '#222' }
const chip = (active) => ({ flex: 1, border: '1px solid ' + (active ? '#ff4800' : '#dddddd'), background: active ? '#fff1eb' : '#fff', color: active ? '#ff4800' : '#222', borderRadius: 8, padding: '7px 4px', fontSize: 12, fontWeight: 600, cursor: 'pointer' })
const addBtn = { border: '1px solid #dddddd', background: '#fff', color: '#222', borderRadius: 9, padding: '9px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const iconBtn = { background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer', flex: 'none', lineHeight: 1 }
const lbl = { fontSize: 11, fontWeight: 600, color: '#6a6a6a' }
const miniBtn = { flex: 1, border: '1px solid #dddddd', background: '#fff', color: '#222', borderRadius: 8, padding: '8px 4px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
