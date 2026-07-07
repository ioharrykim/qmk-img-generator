import { useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header'
import ControlPanel from './components/ControlPanel'
import Viewport from './components/Viewport'
import HistoryStrip from './components/HistoryStrip'
import HistoryPanel from './components/HistoryPanel'
import Lightbox from './components/Lightbox'
import ApiKeyModal from './components/ApiKeyModal'
import Toast from './components/Toast'
import Login from './components/Login'
import CostBadge from './components/CostBadge'
import MaskEditor from './components/MaskEditor'
import PasswordModal from './components/PasswordModal'
import CompositeBoard from './components/CompositeBoard'
import { DEFAULT_SETTINGS, PERSISTED_FIELDS, STORAGE_KEYS, SIZE_DEFS } from './constants'
import { KEY_REQUIRED, MAX_REFERENCES, SUPABASE_ENABLED } from './config'
import { generateImages, buildPrompt } from './api'
import { generateDetailPrompt } from './promptgen'
import { buildTypographyPrompt, DEFAULT_TYPOGRAPHY, sizeForCount } from './typography'
import { sumUsd, textCostUsd, fetchKrwRate, DEFAULT_KRW_RATE, estimateGenerationCost } from './pricing'
import { supabase } from './supabase'
import * as historyStore from './history'
import { addHistoryItem } from './db'
import { b64ToBlob, blobToDataUrl, downloadBlob, uid } from './utils'

async function optimizeReferenceFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const maxEdge = 1536
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= 1_500_000) {
      bitmap.close && bitmap.close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close && bitmap.close()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
    if (!blob || blob.size >= file.size) return file
    const baseName = (file.name || 'reference').replace(/\.[^.]+$/, '')
    return new File([blob], baseName + '.jpg', { type: 'image/jpeg' })
  } catch (e) {
    return file
  }
}

async function measureImageBlob(blob) {
  if (!blob || !blob.type || !blob.type.startsWith('image/')) return {}
  try {
    const bitmap = await createImageBitmap(blob)
    const dims = { width: bitmap.width, height: bitmap.height }
    bitmap.close && bitmap.close()
    return dims
  } catch (e) {
    return {}
  }
}

function loadSettings() {
  let loaded = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings)
    if (raw) loaded = JSON.parse(raw) || {}
  } catch (e) {
    // 무시 — 기본값 사용
  }
  if (!loaded.model || loaded.model === 'gpt-image-1') loaded.model = 'gpt-image-2'
  return { ...DEFAULT_SETTINGS, ...loaded }
}

function loadApiKey() {
  try {
    return localStorage.getItem(STORAGE_KEYS.apiKey) || ''
  } catch (e) {
    return ''
  }
}

function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.presets)
    return raw ? JSON.parse(raw) || [] : []
  } catch (e) {
    return []
  }
}

const DEFAULT_QMARKET = { enabled: false, version: 'realistic', title: '', subtitle: '', concept: '' }

function loadQmarket() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.qmarket)
    if (raw) return { ...DEFAULT_QMARKET, ...(JSON.parse(raw) || {}) }
  } catch (e) {
    // 무시
  }
  return DEFAULT_QMARKET
}

function loadTypography() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.typography)
    if (raw) {
      const saved = JSON.parse(raw) || {}
      const loaded = { ...DEFAULT_TYPOGRAPHY, ...saved }
      if (!Object.prototype.hasOwnProperty.call(saved, 'emphasisLines') && saved.emphasis && saved.emphasis !== 'equal') {
        loaded.emphasisLines = [saved.emphasis]
      }
      return loaded
    }
  } catch (e) {
    // 무시
  }
  return DEFAULT_TYPOGRAPHY
}

function loadKrwRate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.krwRate)
    if (raw) {
      const obj = JSON.parse(raw)
      if (obj && obj.rate > 0) return obj // { rate, manual }
    }
  } catch (e) {
    // 무시
  }
  return { rate: DEFAULT_KRW_RATE, manual: false }
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [apiKey, setApiKey] = useState(loadApiKey)
  const [apiKeyInput, setApiKeyInput] = useState(apiKey)
  const [showKeyModal, setShowKeyModal] = useState(KEY_REQUIRED && !apiKey)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [results, setResults] = useState([])
  const [references, setReferences] = useState([])
  const [history, setHistory] = useState([])
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)
  const [savedPresets, setSavedPresets] = useState(loadPresets)
  const [lightbox, setLightbox] = useState(null)

  // 팀 모드 인증 세션
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(!SUPABASE_ENABLED)

  // 비용 추산: 환율 + 이번 세션 누적 USD
  const [krw, setKrw] = useState(loadKrwRate) // { rate, manual }
  const [sessionUsd, setSessionUsd] = useState(0)

  // 큐마켓 상세페이지 모드 + AI 프롬프트 생성
  const [qmarket, setQmarket] = useState(loadQmarket)
  const [generatingPrompt, setGeneratingPrompt] = useState(false)

  // 타이포그래피 제작 모드 (AI 미사용)
  const [typography, setTypography] = useState(loadTypography)

  // 마스크 부분 편집
  const [maskBase, setMaskBase] = useState(null) // { dataUrl, blob }
  const [maskGenerating, setMaskGenerating] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordPrompt, setPasswordPrompt] = useState(false)

  // 합성 보드 (레이어/블렌딩) + undo/redo 히스토리
  const [boardOpen, setBoardOpen] = useState(false)
  const [boardLayers, setBoardLayers] = useState([])
  const [boardConfig, setBoardConfig] = useState({ w: 1024, h: 1024, bg: 'transparent' })
  const [boardSelectedId, setBoardSelectedId] = useState(null)
  const [boardUndo, setBoardUndo] = useState([])
  const [boardRedo, setBoardRedo] = useState([])

  // 설정 저장
  useEffect(() => {
    try {
      const subset = {}
      PERSISTED_FIELDS.forEach((k) => {
        subset[k] = settings[k]
      })
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(subset))
    } catch (e) {
      // 무시
    }
  }, [settings])

  // 프리셋 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(savedPresets))
    } catch (e) {
      // 무시
    }
  }, [savedPresets])

  // 환율 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.krwRate, JSON.stringify(krw))
    } catch (e) {
      // 무시
    }
  }, [krw])

  // 큐마켓 모드 상태 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.qmarket, JSON.stringify(qmarket))
    } catch (e) {
      // 무시
    }
  }, [qmarket])

  // 타이포그래피 모드 상태 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.typography, JSON.stringify(typography))
    } catch (e) {
      // 무시
    }
  }, [typography])

  // 실시간 환율 조회 (수동 지정이 아니면 1회)
  useEffect(() => {
    if (krw.manual) return
    let cancelled = false
    fetchKrwRate().then((rate) => {
      if (!cancelled && rate) setKrw((cur) => (cur.manual ? cur : { rate, manual: false }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setRateManual = (rate) => setKrw({ rate, manual: true })
  const refreshRate = async () => {
    const rate = await fetchKrwRate()
    if (rate) setKrw({ rate, manual: false })
  }

  // 인증 상태 구독 (팀 모드)
  useEffect(() => {
    if (!SUPABASE_ENABLED) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!SUPABASE_ENABLED || !session) return
    const key = `qimg.passwordPromptSeen.${session.user.id}`
    let seen = false
    try {
      seen = localStorage.getItem(key) === '1'
    } catch (e) {
      seen = true
    }
    if (!seen) {
      setPasswordPrompt(true)
      setPasswordModalOpen(true)
    }
  }, [session])

  // 히스토리 로드 (모드별 백엔드)
  useEffect(() => {
    if (SUPABASE_ENABLED && !session) {
      setHistory([])
      return
    }
    let cancelled = false
    historyStore
      .loadHistory()
      .then((items) => {
        if (!cancelled) setHistory(items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [session])

  // 성공 토스트 자동 사라짐
  useEffect(() => {
    if (toast && toast.type === 'success') {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }))

  const toggleStyle = (key) =>
    setSettings((s) => {
      const has = s.styles.includes(key)
      return { ...s, styles: has ? s.styles.filter((k) => k !== key) : [...s.styles, key] }
    })

  const toggleCustomSize = () =>
    setSettings((s) => {
      const on = !s.useCustomSize
      return { ...s, useCustomSize: on, size: on ? s.customW + 'x' + s.customH : '1024x1024' }
    })

  const setCustomSize = (patch) =>
    setSettings((s) => {
      const cw = patch.customW != null ? patch.customW : s.customW
      const ch = patch.customH != null ? patch.customH : s.customH
      return { ...s, ...patch, useCustomSize: true, size: cw + 'x' + ch }
    })

  // ── 참조 이미지 ──────────────────────────────
  const addReferences = async (files) => {
    const list = Array.from(files || [])
    const entries = []
    for (const f of list) {
      try {
        const optimized = await optimizeReferenceFile(f)
        const dims = await measureImageBlob(optimized)
        const dataUrl = await blobToDataUrl(optimized)
        entries.push({ id: uid(), name: optimized.name || 'image.jpg', blob: optimized, dataUrl, type: optimized.type, ...dims })
      } catch (e) {
        // 한 장 실패는 건너뜀
      }
    }
    setReferences((prev) => {
      const room = MAX_REFERENCES - prev.length
      if (room <= 0) {
        setToast({ type: 'error', message: `참조 이미지는 최대 ${MAX_REFERENCES}장입니다.` })
        return prev
      }
      return [...prev, ...entries.slice(0, room)]
    })
  }

  const removeReference = (id) => setReferences((prev) => prev.filter((r) => r.id !== id))
  const clearReferences = () => setReferences([])

  const itemToBlob = async (item) => {
    if (item.blob) return item.blob
    if (item.b64) return b64ToBlob(item.b64, item.format)
    if (item.url) return (await fetch(item.url)).blob()
    return null
  }

  const addItemAsReference = async (item) => {
    let blob
    try {
      blob = await itemToBlob(item)
    } catch (e) {
      blob = null
    }
    if (!blob) return
    let dataUrl
    try {
      dataUrl = await blobToDataUrl(blob)
    } catch (e) {
      return
    }
    const dims = await measureImageBlob(blob)
    setReferences((prev) => {
      if (prev.length >= MAX_REFERENCES) {
        setToast({ type: 'error', message: `참조 이미지는 최대 ${MAX_REFERENCES}장입니다.` })
        return prev
      }
      return [...prev, { id: uid(), name: 'ref-' + item.id + '.' + item.format, blob, dataUrl, type: blob.type, ...dims }]
    })
    setToast({ type: 'success', message: '참조 이미지에 추가됨' })
  }

  // ── 프리셋 ──────────────────────────────────
  const savePreset = (name) => {
    const config = {}
    PERSISTED_FIELDS.forEach((k) => {
      config[k] = settings[k]
    })
    setSavedPresets((p) => [{ id: uid(), name, config }, ...p])
    setToast({ type: 'success', message: `프리셋 "${name}" 저장됨` })
  }
  const applyPreset = (config) => {
    update({ ...config })
    setToast({ type: 'success', message: '프리셋을 적용했습니다' })
  }
  const deletePreset = (id) => setSavedPresets((p) => p.filter((x) => x.id !== id))

  // ── 큐마켓 상세페이지 모드 ──────────────────
  const toggleQmarket = () => {
    const enabled = !qmarket.enabled
    setQmarket((q) => ({ ...q, enabled }))
    if (enabled) update({ size: '1024x1536', useCustomSize: false }) // 2:3 권장 기본값
  }

  const onQmarketChange = (patch) => setQmarket((q) => ({ ...q, ...patch }))

  const onGeneratePrompt = async () => {
    if (generatingPrompt) return
    if (KEY_REQUIRED && !apiKey) {
      setShowKeyModal(true)
      return
    }
    const brief = { title: qmarket.title, subtitle: qmarket.subtitle, concept: qmarket.concept }
    if (!brief.title.trim() && !brief.concept.trim()) {
      setToast({ type: 'error', message: '타이틀이나 컨셉을 입력해 주세요.' })
      return
    }
    setGeneratingPrompt(true)
    setToast(null)
    try {
      const { text, usage, model } = await generateDetailPrompt({
        apiKey,
        model: settings.promptModel,
        version: qmarket.version,
        brief,
        refCount: references.length,
      })
      if (!text) throw new Error('프롬프트를 받지 못했습니다.')
      update({ prompt: text, styles: [] })
      if (usage) setSessionUsd((u) => u + textCostUsd(model, usage.prompt_tokens, usage.completion_tokens))
      setToast({ type: 'success', message: 'AI 프롬프트를 생성했어요. 아래에서 확인·수정하세요.' })
    } catch (e) {
      setToast({ type: 'error', message: e.message || '프롬프트 생성 중 오류가 발생했습니다.' })
    } finally {
      setGeneratingPrompt(false)
    }
  }

  // ── 타이포그래피 모드 (AI 미사용) ────────────
  // 시안 개수에 따라 이미지 비율 자동 설정 (커스텀으로 변경 가능)
  const applyCountSize = (count) => {
    const { w, h } = sizeForCount(count)
    update({ useCustomSize: true, customW: w, customH: h, size: `${w}x${h}` })
  }
  const toggleTypography = () => {
    const enabled = !typography.enabled
    setTypography((t) => ({ ...t, enabled }))
    if (enabled) applyCountSize(typography.count)
  }
  const onTypographyChange = (patch) => {
    setTypography((t) => ({ ...t, ...patch }))
    if (patch.count != null) applyCountSize(patch.count)
  }
  const applyTypography = () => {
    const p = buildTypographyPrompt(typography)
    if (!p) {
      setToast({ type: 'error', message: '문구를 한 줄 이상 입력해 주세요.' })
      return
    }
    update({ prompt: p, styles: [] })
    setToast({ type: 'success', message: '타이포 프롬프트를 적용했어요. 아래에서 확인·수정하세요.' })
  }

  // ── 히스토리 ────────────────────────────────
  const downloadItem = async (item) => {
    try {
      const blob = await itemToBlob(item)
      if (blob) downloadBlob(blob, 'qimage-' + item.id + '.' + item.format)
    } catch (e) {
      setToast({ type: 'error', message: '다운로드에 실패했습니다.' })
    }
  }

  const removeHistory = async (item) => {
    try {
      await historyStore.removeHistory(item)
    } catch (e) {
      // 무시
    }
    setHistory((h) => h.filter((x) => x.id !== item.id))
  }

  const clearHistory = async () => {
    const snapshot = history
    try {
      await historyStore.clearHistory(snapshot)
    } catch (e) {
      // 무시
    }
    setHistory([])
  }

  const reuseItem = (item) => {
    const sizeIsPreset = SIZE_DEFS.some((d) => d.value === item.size)
    const patch = {
      prompt: item.prompt || '',
      styles: [],
      negative: '',
      format: item.format || 'png',
      model: item.model || settings.model,
      size: item.size || '1024x1024',
    }
    if (sizeIsPreset) {
      patch.useCustomSize = false
    } else {
      const m = String(item.size).match(/^(\d+)x(\d+)$/)
      if (m) {
        patch.useCustomSize = true
        patch.customW = Number(m[1])
        patch.customH = Number(m[2])
      }
    }
    update(patch)
    setHistoryPanelOpen(false)
    setToast({ type: 'success', message: '설정을 불러왔습니다' })
  }

  const reusePrompt = (item) => {
    update({ prompt: item.prompt || '', styles: [], negative: '' })
    setToast({ type: 'success', message: '프롬프트를 불러왔습니다' })
  }

  // 생성 결과를 화면/기록/비용에 반영 (일반 생성 + 마스크 편집 공통)
  const commitResults = async (imgs) => {
    setResults(imgs)
    if (SUPABASE_ENABLED) {
      setHistory((h) => [...imgs, ...h])
    } else {
      const fresh = []
      for (const img of imgs) {
        const blob = b64ToBlob(img.b64, img.format)
        const rec = {
          id: img.id,
          blob,
          format: img.format,
          prompt: img.prompt,
          size: img.size,
          quality: img.quality,
          model: img.model,
          n: img.n,
          refCount: img.refCount,
          createdAt: Date.now(),
        }
        try {
          await addHistoryItem(rec)
        } catch (e) {
          // 무시
        }
        fresh.push({ ...rec, url: URL.createObjectURL(blob) })
      }
      setHistory((h) => [...fresh, ...h])
    }
    setSessionUsd((u) => u + sumUsd(imgs))
  }

  // ── 마스크 부분 편집 ────────────────────────
  const openMaskEditor = async (item) => {
    try {
      const blob = await itemToBlob(item)
      if (!blob) return
      const dataUrl = await blobToDataUrl(blob)
      setMaskBase({ dataUrl, blob })
    } catch (e) {
      setToast({ type: 'error', message: '이미지를 불러오지 못했습니다.' })
    }
  }

  const runMaskEdit = async ({ maskBlob, maskDataUrl, prompt, size }) => {
    if (maskGenerating || !maskBase) return
    if (KEY_REQUIRED && !apiKey) {
      setShowKeyModal(true)
      return
    }
    setMaskGenerating(true)
    setToast(null)
    try {
      const maskEdit = {
        prompt,
        size,
        baseBlob: maskBase.blob,
        baseDataUrl: maskBase.dataUrl,
        maskBlob,
        maskDataUrl,
      }
      const imgs = await generateImages({ apiKey, settings, maskEdit })
      await commitResults(imgs)
      setMaskBase(null)
      setToast({ type: 'success', message: '부분 편집 완료' })
    } catch (e) {
      setToast({ type: 'error', message: e.message || '부분 편집 중 오류가 발생했습니다.' })
    } finally {
      setMaskGenerating(false)
    }
  }

  // ── 합성 보드 + 히스토리 ─────────────────────
  const HISTORY_MAX = 50
  // 편집 메타데이터만 snapshot (Image/File 원본은 src 문자열로 참조 유지)
  const snapshotBoard = () => ({
    layers: boardLayers.map((l) => ({
      ...l,
      crop: l.crop ? { ...l.crop } : null,
      mask: l.mask ? { ...l.mask } : null,
    })),
    config: { ...boardConfig },
    selectedId: boardSelectedId,
  })
  const commitBoard = (before) => {
    setBoardUndo((u) => [...u, before].slice(-HISTORY_MAX))
    setBoardRedo([])
  }
  const applyBoardSnapshot = (s) => {
    setBoardLayers(s.layers.map((l) => ({
      ...l,
      crop: l.crop ? { ...l.crop } : null,
      mask: l.mask ? { ...l.mask } : null,
    })))
    setBoardConfig({ ...s.config })
    setBoardSelectedId(s.selectedId)
  }
  const boardUndoAction = () => {
    if (!boardUndo.length) return
    const prev = boardUndo[boardUndo.length - 1]
    setBoardRedo((r) => [...r, snapshotBoard()].slice(-HISTORY_MAX))
    setBoardUndo((u) => u.slice(0, -1))
    applyBoardSnapshot(prev)
  }
  const boardRedoAction = () => {
    if (!boardRedo.length) return
    const next = boardRedo[boardRedo.length - 1]
    setBoardUndo((u) => [...u, snapshotBoard()].slice(-HISTORY_MAX))
    setBoardRedo((r) => r.slice(0, -1))
    applyBoardSnapshot(next)
  }

  const addBoardLayer = ({ dataUrl, name, width, height }) => {
    if (!dataUrl) return
    const before = snapshotBoard()
    const aspect = width && height ? width / height : 1
    const isFirst = boardLayers.length === 0
    let cfg = boardConfig
    if (isFirst && width && height) {
      cfg = { ...boardConfig, w: width, h: height }
      setBoardConfig(cfg)
    }
    const natW = width || cfg.w
    const natH = height || cfg.h
    const crop = { sx: 0, sy: 0, sw: natW, sh: natH }
    let layer
    if (isFirst) {
      layer = { id: uid(), name: name || '레이어', src: dataUrl, x: 0, y: 0, w: cfg.w, h: cfg.h, aspect, rotation: 0, opacity: 1, blend: 'source-over', visible: true, crop }
    } else {
      const s = Math.min((cfg.w * 0.8) / natW, (cfg.h * 0.8) / natH, 1)
      const w = natW * s
      const h = natH * s
      layer = { id: uid(), name: name || '레이어', src: dataUrl, x: (cfg.w - w) / 2, y: (cfg.h - h) / 2, w, h, aspect, rotation: 0, opacity: 1, blend: 'source-over', visible: true, crop }
    }
    setBoardLayers((prev) => [...prev, layer])
    setBoardSelectedId(layer.id)
    commitBoard(before)
  }

  const resolveItemForBoard = async (item) => {
    const blob = await itemToBlob(item)
    if (!blob) return null
    const dataUrl = await blobToDataUrl(blob)
    const dims = await measureImageBlob(blob)
    return { dataUrl, name: '레이어', width: dims.width, height: dims.height }
  }

  const sendToBoard = async (item) => {
    const payload = await resolveItemForBoard(item)
    if (!payload) {
      setToast({ type: 'error', message: '이미지를 불러오지 못했습니다.' })
      return
    }
    addBoardLayer(payload)
    setBoardOpen(true)
    setToast({ type: 'success', message: '합성 보드에 추가됨' })
  }

  // ── 생성 ────────────────────────────────────
  const generate = async () => {
    if (loading) return
    if (KEY_REQUIRED && !apiKey) {
      setShowKeyModal(true)
      return
    }
    if (!settings.prompt.trim()) {
      setToast({ type: 'error', message: '프롬프트를 입력해 주세요.' })
      return
    }
    setLoading(true)
    setToast(null)
    setResults([])
    try {
      const imgs = await generateImages({ apiKey, settings, references })
      await commitResults(imgs)
      setToast({ type: 'success', message: imgs.length + '장 생성 완료' })
    } catch (e) {
      setToast({ type: 'error', message: e.message || '이미지 생성 중 오류가 발생했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  // ── 전역 리스너 (붙여넣기 / 단축키) — 항상 최신 핸들러 참조 ──
  const addRefRef = useRef(addReferences)
  addRefRef.current = addReferences
  const genRef = useRef(generate)
  genRef.current = generate

  useEffect(() => {
    const onPaste = (e) => {
      const items = (e.clipboardData && e.clipboardData.items) || []
      const files = []
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length) {
        e.preventDefault()
        addRefRef.current(files)
      }
    }
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        genRef.current()
      }
      if (e.key === 'Escape') {
        setLightbox(null)
      }
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const openKeyModal = () => {
    setApiKeyInput(apiKey)
    setShowKeyModal(true)
  }

  const saveKey = () => {
    const k = (apiKeyInput || '').trim()
    try {
      localStorage.setItem(STORAGE_KEYS.apiKey, k)
    } catch (e) {
      // 무시
    }
    setApiKey(k)
    setShowKeyModal(false)
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      // 무시
    }
    setHistory([])
    setResults([])
    setReferences([])
    setPasswordModalOpen(false)
    setPasswordPrompt(false)
  }

  const markPasswordPromptSeen = () => {
    if (!session) return
    try {
      localStorage.setItem(`qimg.passwordPromptSeen.${session.user.id}`, '1')
    } catch (e) {
      // 무시
    }
  }

  const openPasswordModal = () => {
    setPasswordPrompt(false)
    setPasswordModalOpen(true)
  }

  const closePasswordModal = () => {
    if (passwordPrompt) markPasswordPromptSeen()
    setPasswordModalOpen(false)
    setPasswordPrompt(false)
  }

  const onPasswordChanged = () => {
    markPasswordPromptSeen()
    setPasswordModalOpen(false)
    setPasswordPrompt(false)
    setToast({ type: 'success', message: '비밀번호가 변경되었습니다.' })
  }

  const finalPrompt = buildPrompt(settings)
  const finalPromptPreview = finalPrompt || '(프롬프트를 입력하면 여기에 표시됩니다)'
  const generationEstimate = useMemo(
    () => estimateGenerationCost({ settings, prompt: finalPrompt, references, krwRate: krw.rate }),
    [settings, finalPrompt, references, krw.rate]
  )

  // 팀 모드 게이트
  if (SUPABASE_ENABLED && !authReady) {
    return <div style={{ height: '100vh', background: '#f7f7f7' }} />
  }
  if (SUPABASE_ENABLED && !session) {
    return <Login />
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f7f7f7',
        color: '#222222',
        letterSpacing: '-0.13px',
      }}
    >
      <Header
        hasKey={!!apiKey}
        keyRequired={KEY_REQUIRED}
        onOpenKeyModal={openKeyModal}
        teamMode={SUPABASE_ENABLED}
        userEmail={session ? session.user.email : ''}
        onChangePassword={openPasswordModal}
        onLogout={logout}
        costSlot={
          <CostBadge
            history={history}
            krwRate={krw.rate}
            sessionUsd={sessionUsd}
            onRateChange={setRateManual}
            onRefreshRate={refreshRate}
          />
        }
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <ControlPanel
          settings={settings}
          update={update}
          toggleStyle={toggleStyle}
          toggleCustomSize={toggleCustomSize}
          setCustomSize={setCustomSize}
          onGenerate={generate}
          loading={loading}
          hasKey={!!apiKey}
          keyRequired={KEY_REQUIRED}
          advancedOpen={advancedOpen}
          onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
          finalPromptPreview={finalPromptPreview}
          generationEstimate={generationEstimate}
          references={references}
          onAddReferences={addReferences}
          onRemoveReference={removeReference}
          onClearReferences={clearReferences}
          savedPresets={savedPresets}
          onSavePreset={savePreset}
          onApplyPreset={applyPreset}
          onDeletePreset={deletePreset}
          qmarket={qmarket}
          onToggleQmarket={toggleQmarket}
          onQmarketChange={onQmarketChange}
          onGeneratePrompt={onGeneratePrompt}
          generatingPrompt={generatingPrompt}
          typography={typography}
          onToggleTypography={toggleTypography}
          onTypographyChange={onTypographyChange}
          onApplyTypography={applyTypography}
        />

        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Viewport
            loading={loading}
            results={results}
            settings={settings}
            krwRate={krw.rate}
            onExpand={setLightbox}
            onDownload={downloadItem}
            onUseAsReference={addItemAsReference}
            onReusePrompt={reusePrompt}
            onMaskEdit={openMaskEditor}
            onSendToBoard={sendToBoard}
          />
          <HistoryStrip
            history={history}
            onExpand={setLightbox}
            onOpenPanel={() => setHistoryPanelOpen(true)}
            onOpenBoard={() => setBoardOpen(true)}
          />
        </main>
      </div>

      <HistoryPanel
        open={historyPanelOpen}
        onClose={() => setHistoryPanelOpen(false)}
        history={history}
        krwRate={krw.rate}
        onExpand={setLightbox}
        onDownload={downloadItem}
        onDelete={removeHistory}
        onClear={clearHistory}
        onReuse={reuseItem}
        onUseAsReference={addItemAsReference}
        onMaskEdit={openMaskEditor}
        onSendToBoard={sendToBoard}
      />

      {maskBase && (
        <MaskEditor base={maskBase} generating={maskGenerating} onClose={() => setMaskBase(null)} onSubmit={runMaskEdit} />
      )}

      <CompositeBoard
        open={boardOpen}
        layers={boardLayers}
        onLayersChange={setBoardLayers}
        config={boardConfig}
        onConfigChange={setBoardConfig}
        selectedId={boardSelectedId}
        onSelect={setBoardSelectedId}
        getSnapshot={snapshotBoard}
        onCommit={commitBoard}
        onUndo={boardUndoAction}
        onRedo={boardRedoAction}
        canUndo={boardUndo.length > 0}
        canRedo={boardRedo.length > 0}
        history={history}
        resolveItem={resolveItemForBoard}
        onAddImage={addBoardLayer}
        onClose={() => setBoardOpen(false)}
      />

      <PasswordModal
        open={passwordModalOpen}
        prompt={passwordPrompt}
        onClose={closePasswordModal}
        onSuccess={onPasswordChanged}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
      <Lightbox item={lightbox} onClose={() => setLightbox(null)} onDownload={downloadItem} />
      {showKeyModal && (
        <ApiKeyModal
          value={apiKeyInput}
          onChange={setApiKeyInput}
          onSave={saveKey}
          onClose={() => setShowKeyModal(false)}
        />
      )}
    </div>
  )
}
