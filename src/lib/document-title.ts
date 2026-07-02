const DEFAULT_TRADE_NAME = 'E•tto'

export function formatEttoDocumentTitle(productLabel: string, tradeName?: string | null): string {
  const fantasy = tradeName?.trim() || DEFAULT_TRADE_NAME
  return `E•${productLabel} - ${fantasy}`
}

export function applyEttoDocumentTitle(productLabel: string, tradeName?: string | null): void {
  document.title = formatEttoDocumentTitle(productLabel, tradeName)
}
