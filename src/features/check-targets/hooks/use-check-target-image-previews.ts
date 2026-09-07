import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchExecutionEvidenceBlob,
  fetchReferenceAttachmentBlob,
} from '@/features/check-targets/api/check-targets-api'

type PreviewEntry = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  url: string | null
}

function empty(): PreviewEntry {
  return { status: 'idle', url: null }
}

/** Previews autenticados para referências e evidências do CheckTarget. */
export function useCheckTargetImagePreviews(
  token: string | undefined,
  keys: Array<{ kind: 'ref' | 'evidence'; id: number }>,
) {
  const [entries, setEntries] = useState<Record<string, PreviewEntry>>({})
  const urlRef = useRef<Map<string, string>>(new Map())
  const itemsKey = useMemo(() => keys.map((k) => `${k.kind}:${k.id}`).join('|'), [keys])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const active = new Set(keys.map((k) => `${k.kind}:${k.id}`))

    for (const [key, url] of urlRef.current) {
      if (!active.has(key)) {
        URL.revokeObjectURL(url)
        urlRef.current.delete(key)
      }
    }

    void (async () => {
      for (const item of keys) {
        const key = `${item.kind}:${item.id}`
        if (urlRef.current.has(key)) continue
        setEntries((prev) => ({ ...prev, [key]: { status: 'loading', url: null } }))
        try {
          const url =
            item.kind === 'ref'
              ? await fetchReferenceAttachmentBlob(token, item.id)
              : await fetchExecutionEvidenceBlob(token, item.id)
          if (cancelled) {
            URL.revokeObjectURL(url)
            continue
          }
          urlRef.current.set(key, url)
          setEntries((prev) => ({ ...prev, [key]: { status: 'ready', url } }))
        } catch {
          if (!cancelled) setEntries((prev) => ({ ...prev, [key]: { status: 'error', url: null } }))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, itemsKey, keys])

  useEffect(() => {
    return () => {
      for (const url of urlRef.current.values()) URL.revokeObjectURL(url)
      urlRef.current.clear()
    }
  }, [])

  const entryFor = useCallback(
    (kind: 'ref' | 'evidence', id: number): PreviewEntry => {
      return entries[`${kind}:${id}`] ?? empty()
    },
    [entries],
  )

  return { entryFor }
}
