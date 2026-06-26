import { useEffect, useRef, useState } from 'react'
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
import { DEFAULT_SETTINGS, PERSISTED_FIELDS, STORAGE_KEYS, SIZE_DEFS } from './constants'
import { KEY_REQUIRED, MAX_REFERENCES, SUPABASE_ENABLED } from './config'
import { generateImages, buildPrompt } from './api'
import { sumUsd, fetchKrwRate, DEFAULT_KRW_RATE } from './pricing'
import { supabase } from './supabase'
import * as historyStore from './history'
import { addHistoryItem } from './db'
import { b64ToBlob, blobToDataUrl, downloadBlob, uid } from './utils'

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
        const dataUrl = await blobToDataUrl(f)
        entries.push({ id: uid(), name: f.name || 'image.png', blob: f, dataUrl, type: f.type })
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
    setReferences((prev) => {
      if (prev.length >= MAX_REFERENCES) {
        setToast({ type: 'error', message: `참조 이미지는 최대 ${MAX_REFERENCES}장입니다.` })
        return prev
      }
      return [...prev, { id: uid(), name: 'ref-' + item.id + '.' + item.format, blob, dataUrl, type: blob.type }]
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
      setResults(imgs)
      if (SUPABASE_ENABLED) {
        // 팀 모드: 서버(함수)가 이미 저장함 → 화면 상태만 갱신
        setHistory((h) => [...imgs, ...h])
      } else {
        // 로컬 모드: IndexedDB 에 저장
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
            // 저장 실패해도 결과는 표시
          }
          fresh.push({ ...rec, url: URL.createObjectURL(blob) })
        }
        setHistory((h) => [...fresh, ...h])
      }
      setSessionUsd((u) => u + sumUsd(imgs))
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
  }

  const finalPromptPreview = buildPrompt(settings) || '(프롬프트를 입력하면 여기에 표시됩니다)'

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
          references={references}
          onAddReferences={addReferences}
          onRemoveReference={removeReference}
          onClearReferences={clearReferences}
          savedPresets={savedPresets}
          onSavePreset={savePreset}
          onApplyPreset={applyPreset}
          onDeletePreset={deletePreset}
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
          />
          <HistoryStrip history={history} onExpand={setLightbox} onOpenPanel={() => setHistoryPanelOpen(true)} />
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
