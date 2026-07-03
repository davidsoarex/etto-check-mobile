import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchEcheckPhotoBlob } from '@/services/echeck-api'

export type EcheckPhotoPreviewItem = {
  photoId: number
  takenAt: string | null
  label: string
}

function previewCacheKey(photoId: number, takenAt: string | null | undefined): string {
  return `${photoId}:${takenAt ?? ''}`
}

export function useEcheckPhotoPreviews(
  token: string | undefined,
  items: EcheckPhotoPreviewItem[],
) {
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null)
  const urlsRef = useRef<Set<string>>(new Set())

  const itemsKey = useMemo(
    () => items.map((item) => previewCacheKey(item.photoId, item.takenAt)).join('|'),
    [items],
  )

  useEffect(() => {
    if (!token || items.length === 0) return

    let cancelled = false

    void Promise.all(
      items.map(async (item) => {
        const key = previewCacheKey(item.photoId, item.takenAt)
        try {
          const url = await fetchEcheckPhotoBlob(token, item.photoId, item.takenAt)
          if (cancelled) {
            URL.revokeObjectURL(url)
            return
          }
          urlsRef.current.add(url)
          setPreviewUrls((prev) => ({ ...prev, [key]: url }))
        } catch {
          /* ignore preview errors */
        }
      }),
    )

    return () => {
      cancelled = true
    }
  }, [token, itemsKey, items])

  useEffect(
    () => () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url)
      urlsRef.current.clear()
    },
    [],
  )

  const previewFor = useCallback(
    (photoId: number, takenAt: string | null | undefined) =>
      previewUrls[previewCacheKey(photoId, takenAt)] ?? null,
    [previewUrls],
  )

  const setLocalPreview = useCallback((photoId: number, takenAt: string | null, file: File) => {
    const key = previewCacheKey(photoId, takenAt)
    const url = URL.createObjectURL(file)
    urlsRef.current.add(url)
    setPreviewUrls((prev) => ({ ...prev, [key]: url }))
  }, [])

  const openLightbox = useCallback((src: string, label: string) => {
    setLightbox({ src, label })
  }, [])

  const closeLightbox = useCallback(() => {
    setLightbox(null)
  }, [])

  return {
    previewFor,
    setLocalPreview,
    lightbox,
    openLightbox,
    closeLightbox,
  }
}
