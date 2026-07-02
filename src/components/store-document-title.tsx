import { useEffect } from 'react'
import { applyEttoDocumentTitle } from '@/lib/document-title'
import { fetchStoreTradeName } from '@/lib/store-bootstrap'

const PRODUCT_LABEL = 'E•Check'

export function StoreDocumentTitle() {
  useEffect(() => {
    void fetchStoreTradeName()
      .then((tradeName) => applyEttoDocumentTitle(PRODUCT_LABEL, tradeName))
      .catch(() => applyEttoDocumentTitle(PRODUCT_LABEL))
  }, [])

  return null
}