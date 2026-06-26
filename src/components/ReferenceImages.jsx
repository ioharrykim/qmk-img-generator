import { useRef, useState } from 'react'
import { MAX_REFERENCES } from '../config'

// 참조 이미지 첨부 — 파일 선택 / 드래그앤드롭 / (전역) 클립보드 붙여넣기
export default function ReferenceImages({ references, onAdd, onRemove, onClear }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const full = references.length >= MAX_REFERENCES

  const pickFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'))
    if (files.length) onAdd(files)
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          참조 이미지{' '}
          <span style={{ fontWeight: 400, color: '#6a6a6a', fontSize: 12 }}>
            {references.length}/{MAX_REFERENCES}
          </span>
        </div>
        {references.length > 0 && (
          <button
            onClick={onClear}
            className="q-link"
            style={{ background: 'transparent', border: 'none', fontSize: 12, fontWeight: 600, color: '#6a6a6a', cursor: 'pointer', padding: '2px 4px' }}
          >
            모두 지우기
          </button>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#6a6a6a', marginBottom: 12 }}>
        첨부하면 이미지를 참조해 변형/합성합니다. 끌어다 놓거나 <b style={{ color: '#222' }}>Ctrl/⌘+V</b> 로 붙여넣기 하세요.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {references.map((ref) => (
          <div
            key={ref.id}
            style={{
              position: 'relative',
              width: 72,
              height: 72,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid #ebebeb',
              background: '#f7f7f7',
            }}
          >
            <img src={ref.dataUrl} alt={ref.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              onClick={() => onRemove(ref.id)}
              title="제거"
              style={{
                position: 'absolute',
                top: 3,
                right: 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(34,34,34,0.82)',
                color: '#fff',
                fontSize: 12,
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        ))}

        {!full && (
          <button
            onClick={() => inputRef.current && inputRef.current.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              pickFiles(e.dataTransfer.files)
            }}
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              border: '1.5px dashed ' + (dragOver ? '#ff4800' : '#dddddd'),
              background: dragOver ? '#fff1eb' : '#ffffff',
              color: dragOver ? '#ff4800' : '#6a6a6a',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              fontSize: 22,
              lineHeight: 1,
              transition: 'all .15s ease',
            }}
          >
            +<span style={{ fontSize: 10, fontWeight: 600 }}>추가</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          pickFiles(e.target.files)
          e.target.value = ''
        }}
        style={{ display: 'none' }}
      />
    </section>
  )
}
