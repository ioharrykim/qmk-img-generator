import { useMemo, useState } from 'react'
import { STYLES, STYLE_CATEGORIES } from '../constants'

const ON_BG = '#fff1eb'
const ON_BORDER = '#ff4800'
const ON_COLOR = '#ff4800'

// 스타일 프리셋 — 카테고리 탭 + 검색 + 다중선택 칩 + 내 프리셋(전체 설정 스냅샷)
export default function StylePresets({ settings, toggleStyle, savedPresets, onSavePreset, onApplyPreset, onDeletePreset }) {
  const [cat, setCat] = useState('all')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return STYLES.filter((s) => {
      if (cat !== 'all' && s.cat !== cat) return false
      if (q && !(s.label.toLowerCase().includes(q) || (s.hint || '').toLowerCase().includes(q))) return false
      return true
    })
  }, [cat, search])

  const selectedCount = settings.styles.length

  const commitSave = () => {
    const n = name.trim()
    if (!n) return
    onSavePreset(n)
    setName('')
    setSaving(false)
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          스타일 프리셋{' '}
          {selectedCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ff4800', background: '#fff1eb', padding: '2px 7px', borderRadius: 20 }}>
              {selectedCount} 선택됨
            </span>
          )}
        </div>
        {selectedCount > 0 && (
          <button
            onClick={() => settings.styles.forEach((k) => toggleStyle(k))}
            className="q-link"
            style={{ background: 'transparent', border: 'none', fontSize: 12, fontWeight: 600, color: '#6a6a6a', cursor: 'pointer', padding: '2px 4px' }}
          >
            선택 해제
          </button>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#6a6a6a', marginBottom: 12 }}>클릭해서 켜고 끄세요. 중복 적용 가능합니다.</div>

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {STYLE_CATEGORIES.map((c) => {
          const active = cat === c.key
          return (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: '1px solid ' + (active ? '#222222' : '#ebebeb'),
                background: active ? '#222222' : '#ffffff',
                color: active ? '#ffffff' : '#6a6a6a',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .15s ease',
              }}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {/* 검색 */}
      <input
        className="q-field"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="스타일 검색 (예: 화이트, 수채화, 3D)"
        style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 12, padding: '9px 13px', fontSize: 13, color: '#222222', marginBottom: 12 }}
      />

      {/* 칩 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {filtered.map((opt) => {
          const active = settings.styles.includes(opt.key)
          return (
            <button
              key={opt.key}
              onClick={() => toggleStyle(opt.key)}
              title={opt.hint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 13px',
                borderRadius: 32,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .15s ease',
                border: '1px solid ' + (active ? ON_BORDER : '#dddddd'),
                background: active ? ON_BG : '#ffffff',
                color: active ? ON_COLOR : '#222222',
              }}
            >
              {opt.label}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ fontSize: 12, color: '#6a6a6a', padding: '8px 2px' }}>검색 결과가 없습니다.</div>
        )}
      </div>

      {/* 내 프리셋 */}
      <div style={{ marginTop: 16, borderTop: '1px dashed #ebebeb', paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a' }}>내 프리셋 <span style={{ color: '#222' }}>· 현재 설정 통째로 저장</span></span>
          {!saving && (
            <button
              onClick={() => setSaving(true)}
              style={{ background: 'transparent', border: '1px solid #dddddd', borderRadius: 8, padding: '5px 11px', fontSize: 12, fontWeight: 600, color: '#222222', cursor: 'pointer' }}
            >
              + 저장
            </button>
          )}
        </div>

        {saving && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input
              className="q-field"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitSave()
                if (e.key === 'Escape') {
                  setSaving(false)
                  setName('')
                }
              }}
              placeholder="프리셋 이름 (예: 화이트 제품컷 1:1)"
              style={{ flex: 1, border: '1px solid #dddddd', borderRadius: 10, padding: '8px 11px', fontSize: 13, color: '#222222' }}
            />
            <button
              onClick={commitSave}
              style={{ background: '#ff4800', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
            >
              저장
            </button>
          </div>
        )}

        {savedPresets.length === 0 ? (
          <div style={{ fontSize: 12, color: '#6a6a6a' }}>저장된 프리셋이 없습니다. 자주 쓰는 설정을 저장해 두세요.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {savedPresets.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '7px 8px 7px 12px',
                  borderRadius: 20,
                  border: '1px solid #dddddd',
                  background: '#ffffff',
                }}
              >
                <button
                  onClick={() => onApplyPreset(p.config)}
                  title="이 프리셋 적용"
                  style={{ background: 'transparent', border: 'none', fontSize: 12, fontWeight: 600, color: '#222222', cursor: 'pointer', padding: 0 }}
                >
                  {p.name}
                </button>
                <button
                  onClick={() => onDeletePreset(p.id)}
                  title="삭제"
                  style={{ background: 'transparent', border: 'none', fontSize: 12, color: '#c1c1c1', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
