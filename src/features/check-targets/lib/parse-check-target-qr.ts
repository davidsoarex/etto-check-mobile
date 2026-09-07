/**
 * Extrai token de QR E.Check. Só aceita deep link /t/{token} (URL completa ou path).
 * Conteúdo arbitrário / outro QR → not_echeck_qr (não navegar para /t/…).
 */

export type ParseCheckTargetQrResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'empty' | 'not_echeck_qr' | 'invalid_token' }

const TOKEN_RE = /^[A-Za-z0-9._~-]{8,200}$/

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '')
}

function isAllowedHost(hostname: string): boolean {
  const h = normalizeHost(hostname)
  if (h === 'check.etto.one') return true
  if (h === 'localhost' || h === '127.0.0.1') return true
  // Vite preview / LAN smoke
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true
  return false
}

function tokenFromPathname(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  const tIdx = parts.findIndex((p) => p === 't')
  if (tIdx < 0 || tIdx + 1 >= parts.length) return null
  const raw = parts[tIdx + 1] ?? ''
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null
  }
  return decoded
}

function validateToken(token: string): ParseCheckTargetQrResult {
  const t = token.trim()
  if (!t || !TOKEN_RE.test(t)) {
    return { ok: false, reason: 'invalid_token' }
  }
  return { ok: true, token: t }
}

/**
 * @param raw valor lido pelo scanner (URL, path /t/…, ou lixo)
 */
export function parseCheckTargetQr(raw: string): ParseCheckTargetQrResult {
  const text = String(raw ?? '').trim()
  if (!text) return { ok: false, reason: 'empty' }

  // Path relativo interno
  if (text.startsWith('/t/')) {
    const token = tokenFromPathname(text.split(/[?#]/, 1)[0] ?? text)
    if (!token) return { ok: false, reason: 'not_echeck_qr' }
    return validateToken(token)
  }

  // URL absoluta (com ou sem scheme)
  let urlText = text
  if (!/^[a-z][a-z0-9+.-]*:/i.test(urlText)) {
    if (urlText.startsWith('check.etto.one/') || urlText.startsWith('localhost')) {
      urlText = `https://${urlText}`
    } else {
      return { ok: false, reason: 'not_echeck_qr' }
    }
  }

  let url: URL
  try {
    url = new URL(urlText)
  } catch {
    return { ok: false, reason: 'not_echeck_qr' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'not_echeck_qr' }
  }
  if (!isAllowedHost(url.hostname)) {
    return { ok: false, reason: 'not_echeck_qr' }
  }

  const token = tokenFromPathname(url.pathname)
  if (!token) return { ok: false, reason: 'not_echeck_qr' }
  return validateToken(token)
}

export function parseCheckTargetQrMessage(result: ParseCheckTargetQrResult): string | null {
  if (result.ok) return null
  if (result.reason === 'empty') return 'Nenhum código lido. Aponte para o QR do local ou equipamento.'
  if (result.reason === 'invalid_token') {
    return 'QR do E.Check inválido. Use a etiqueta oficial do local ou equipamento.'
  }
  return 'Este QR não é de um local ou equipamento E.Check. Escaneie a etiqueta oficial ou abra o link com a câmera do celular.'
}
