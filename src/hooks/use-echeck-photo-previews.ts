import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchEcheckPhotoBlob } from '@/services/echeck-api'

export type EcheckPhotoPreviewItem = {
  photoId: number
  takenAt: string | null
  label: string
}

export type PhotoPreviewStatus = 'idle' | 'loading' | 'ready' | 'error'

export type PhotoPreviewEntry = {
  status: PhotoPreviewStatus
  url: string | null
  error: string | null
}

function previewCacheKey(photoId: number, takenAt: string | null | undefined): string {
  return `${photoId}:${takenAt ?? ''}`
}

function emptyEntry(): PhotoPreviewEntry {
  return { status: 'idle', url: null, error: null }
}

/**
 * Carrega previews autenticados sem cancelar downloads irmãos a cada setState.
 * Depende só de token + itemsKey (chave estável), não da referência do array items.
 */
export function useEcheckPhotoPreviews(
  token: string | undefined,
  items: EcheckPhotoPreviewItem[],
) {
  const [entries, setEntries] = useState<Record<string, PhotoPreviewEntry>>({})
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const urlByKeyRef = useRef<Map<string, string>>(new Map())
  const inflightRef = useRef<Map<string, AbortController>>(new Map())
  const failedKeysRef = useRef<Set<string>>(new Set())
  const itemsRef = useRef(items)
  itemsRef.current = items

  const itemsKey = useMemo(
    () => items.map((item) => previewCacheKey(item.photoId, item.takenAt)).join('|'),
    [items],
  )

  const revokeKey = useCallback((key: string) => {
    const url = urlByKeyRef.current.get(key)
    if (url) {
      URL.revokeObjectURL(url)
      urlByKeyRef.current.delete(key)
    }
    const ctrl = inflightRef.current.get(key)
    if (ctrl) {
      ctrl.abort()
      inflightRef.current.delete(key)
    }
  }, [])

  const loadOne = useCallback(async (item: EcheckPhotoPreviewItem, tokenValue: string) => {
    const key = previewCacheKey(item.photoId, item.takenAt)
    if (urlByKeyRef.current.has(key)) return
    if (inflightRef.current.has(key)) return

    const ctrl = new AbortController()
    inflightRef.current.set(key, ctrl)

    setEntries((prev) => {
      const cur = prev[key]
      if (cur?.status === 'ready' && cur.url) return prev
      return {
        ...prev,
        [key]: { status: 'loading', url: null, error: null },
      }
    })

    try {
      const url = await fetchEcheckPhotoBlob(tokenValue, item.photoId, item.takenAt, ctrl.signal)
      if (ctrl.signal.aborted) {
        URL.revokeObjectURL(url)
        return
      }
      const previous = urlByKeyRef.current.get(key)
      if (previous) URL.revokeObjectURL(previous)
      urlByKeyRef.current.set(key, url)
      setEntries((prev) => ({
        ...prev,
        [key]: { status: 'ready', url, error: null },
      }))
    } catch (e) {
      if (ctrl.signal.aborted) return
      failedKeysRef.current.add(key)
      const message =
        e instanceof Error && e.message ? e.message : 'Não foi possível carregar a foto.'
      setEntries((prev) => ({
        ...prev,
        [key]: { status: 'error', url: null, error: message },
      }))
    } finally {
      if (inflightRef.current.get(key) === ctrl) {
        inflightRef.current.delete(key)
      }
    }
  }, [])

  useEffect(() => {
    if (!token) return

    const wantedKeys = new Set(
      itemsRef.current.map((item) => previewCacheKey(item.photoId, item.takenAt)),
    )

    for (const key of [...urlByKeyRef.current.keys()]) {
      if (!wantedKeys.has(key)) revokeKey(key)
    }
    for (const key of [...inflightRef.current.keys()]) {
      if (!wantedKeys.has(key)) {
        inflightRef.current.get(key)?.abort()
        inflightRef.current.delete(key)
      }
    }
    for (const key of [...failedKeysRef.current]) {
      if (!wantedKeys.has(key)) failedKeysRef.current.delete(key)
    }

    setEntries((prev) => {
      const next: Record<string, PhotoPreviewEntry> = {}
      for (const key of wantedKeys) {
        const existing = prev[key]
        if (existing?.status === 'ready' && existing.url && urlByKeyRef.current.has(key)) {
          next[key] = existing
        } else if (existing?.status === 'error') {
          next[key] = existing
        } else if (urlByKeyRef.current.has(key)) {
          next[key] = {
            status: 'ready',
            url: urlByKeyRef.current.get(key)!,
            error: null,
          }
        } else {
          next[key] = existing?.status === 'loading' ? existing : { status: 'loading', url: null, error: null }
        }
      }
      return next
    })

    for (const item of itemsRef.current) {
      const key = previewCacheKey(item.photoId, item.takenAt)
      if (urlByKeyRef.current.has(key)) continue
      if (failedKeysRef.current.has(key)) continue
      void loadOne(item, token)
    }
  }, [token, itemsKey, reloadNonce, loadOne, revokeKey])

  useEffect(
    () => () => {
      for (const ctrl of inflightRef.current.values()) ctrl.abort()
      inflightRef.current.clear()
      for (const url of urlByKeyRef.current.values()) URL.revokeObjectURL(url)
      urlByKeyRef.current.clear()
    },
    [],
  )

  const entryFor = useCallback(
    (photoId: number, takenAt: string | null | undefined): PhotoPreviewEntry =>
      entries[previewCacheKey(photoId, takenAt)] ?? emptyEntry(),
    [entries],
  )

  /** @deprecated prefer entryFor — mantido para callers que só precisam da URL pronta */
  const previewFor = useCallback(
    (photoId: number, takenAt: string | null | undefined) =>
      entryFor(photoId, takenAt).url,
    [entryFor],
  )

  const setLocalPreview = useCallback((photoId: number, takenAt: string | null, file: Blob) => {
    const key = previewCacheKey(photoId, takenAt)
    const previous = urlByKeyRef.current.get(key)
    if (previous) URL.revokeObjectURL(previous)
    const ctrl = inflightRef.current.get(key)
    if (ctrl) {
      ctrl.abort()
      inflightRef.current.delete(key)
    }
    const url = URL.createObjectURL(file)
    urlByKeyRef.current.set(key, url)
    setEntries((prev) => ({
      ...prev,
      [key]: { status: 'ready', url, error: null },
    }))
  }, [])

  const retryPreview = useCallback((photoId: number, takenAt: string | null | undefined) => {
    const key = previewCacheKey(photoId, takenAt)
    failedKeysRef.current.delete(key)
    revokeKey(key)
    setEntries((prev) => ({
      ...prev,
      [key]: { status: 'loading', url: null, error: null },
    }))
    setReloadNonce((n) => n + 1)
  }, [revokeKey])

  const openLightbox = useCallback((src: string, label: string) => {
    setLightbox({ src, label })
  }, [])

  const closeLightbox = useCallback(() => {
    setLightbox(null)
  }, [])

  return {
    entryFor,
    previewFor,
    setLocalPreview,
    retryPreview,
    lightbox,
    openLightbox,
    closeLightbox,
  }
}
