// 공용 유틸리티

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',')
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'image/png'
  const bin = atob(b64)
  const len = bin.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export function b64ToBlob(b64, format) {
  const mime = 'image/' + (format || 'png')
  const bin = atob(b64)
  const len = bin.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

// "방금 전 / 3분 전 / 2시간 전 / 4일 전" 형태
export function timeAgo(ts) {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '방금 전'
  const min = Math.floor(sec / 60)
  if (min < 60) return min + '분 전'
  const hr = Math.floor(min / 60)
  if (hr < 24) return hr + '시간 전'
  const day = Math.floor(hr / 24)
  if (day < 30) return day + '일 전'
  const d = new Date(ts)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
