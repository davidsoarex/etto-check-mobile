import jsQR from 'jsqr'

type NativeBarcodeDetector = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

type NativeBarcodeDetectorCtor = new (options?: { formats?: string[] }) => NativeBarcodeDetector

export type QrFrameDecoder = {
  detect: (canvas: HTMLCanvasElement) => Promise<string | null>
}

function getBarcodeDetectorCtor(): NativeBarcodeDetectorCtor | null {
  return (
    (globalThis as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector ??
    null
  )
}

function decodeWithJsQr(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || canvas.width < 8 || canvas.height < 8) return null
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(image.data, image.width, image.height, {
    inversionAttempts: 'attemptBoth',
  })
  const raw = code?.data?.trim()
  return raw && raw.length > 0 ? raw : null
}

export async function createQrFrameDecoder(): Promise<QrFrameDecoder> {
  let native: NativeBarcodeDetector | null = null
  const Ctor = getBarcodeDetectorCtor()
  if (Ctor) {
    try {
      native = new Ctor({ formats: ['qr_code'] })
    } catch {
      try {
        native = new Ctor()
      } catch {
        native = null
      }
    }
  }

  return {
    async detect(canvas) {
      if (native) {
        try {
          const codes = await native.detect(canvas)
          const raw = codes.map((c) => c.rawValue?.trim()).find((v) => v && v.length > 0)
          if (raw) return raw
        } catch {
          /* fall through to jsQR (Safari / empty frame) */
        }
      }
      return decodeWithJsQr(canvas)
    },
  }
}
