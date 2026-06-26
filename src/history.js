// 생성 기록 추상화 — 팀 모드(Supabase) / 로컬 모드(IndexedDB) 양쪽 지원
//
// 반환 아이템 공통 형태: { id, url, format, prompt, size, model, refCount, createdAt, storage_path?, blob? }
//  - 팀 모드: url = Supabase Storage 서명 URL, storage_path 보유
//  - 로컬 모드: url = object URL, blob 보유

import { supabase } from './supabase'
import { SUPABASE_ENABLED, STORAGE_BUCKET } from './config'
import * as idb from './db'

const SIGN_TTL = 3600 // 서명 URL 유효시간(초)

async function signRow(row) {
  let url = null
  try {
    const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(row.storage_path, SIGN_TTL)
    url = data ? data.signedUrl : null
  } catch (e) {
    /* 무시 */
  }
  return {
    id: row.id,
    url,
    storage_path: row.storage_path,
    prompt: row.prompt,
    size: row.size,
    quality: row.quality,
    format: row.format,
    model: row.model,
    n: row.n,
    refCount: row.ref_count,
    createdAt: new Date(row.created_at).getTime(),
  }
}

// 서버(또는 함수)가 반환한 새 row 들을 화면용 아이템으로 변환
export async function decorateNew(rows) {
  return Promise.all(rows.map(signRow))
}

export async function loadHistory() {
  if (SUPABASE_ENABLED) {
    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) throw error
    return Promise.all((data || []).map(signRow))
  }
  const items = await idb.getAllHistory()
  return items.map((it) => ({ ...it, url: URL.createObjectURL(it.blob) }))
}

export async function removeHistory(item) {
  if (SUPABASE_ENABLED) {
    await supabase.from('generations').delete().eq('id', item.id)
    if (item.storage_path) await supabase.storage.from(STORAGE_BUCKET).remove([item.storage_path])
    return
  }
  await idb.deleteHistoryItem(item.id)
  if (item.url) URL.revokeObjectURL(item.url)
}

export async function clearHistory(items) {
  if (SUPABASE_ENABLED) {
    const ids = items.map((i) => i.id)
    const paths = items.map((i) => i.storage_path).filter(Boolean)
    if (ids.length) await supabase.from('generations').delete().in('id', ids)
    if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
    return
  }
  await idb.clearAllHistory()
  items.forEach((i) => i.url && URL.revokeObjectURL(i.url))
}
