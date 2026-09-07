import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ScanLine } from 'lucide-react'
import {
  parseCheckTargetQr,
  parseCheckTargetQrMessage,
} from '@/features/check-targets/lib/parse-check-target-qr'

type NativeBarcodeDetector = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

type NativeBarcodeDetectorCtor = new (options?: { formats?: string[] }) => NativeBarcodeDetector

function getBarcodeDetectorCtor(): NativeBarcodeDetectorCtor | null {
  return (
    (globalThis as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector ??
    null
  )
}

async function createQrDetector(): Promise<NativeBarcodeDetector | null> {
  const Ctor = getBarcodeDetectorCtor()
  if (!Ctor) return null
  try {
    return new Ctor({ formats: ['qr_code'] })
  } catch {
    try {
      return new Ctor()
    } catch {
      return null
    }
  }
}

/**
 * Scanner in-app: lê QR → /t/:token. Sem API própria.
 * Fallback oficial: câmera nativa do SO abrindo check.etto.one/t/…
 */
export function QrScanPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lockedRef = useRef(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanHint, setScanHint] = useState<string | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  const stopCamera = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) video.srcObject = null
  }, [])

  const handleRaw = useCallback(
    (raw: string) => {
      if (lockedRef.current) return
      const parsed = parseCheckTargetQr(raw)
      if (!parsed.ok) {
        setScanHint(parseCheckTargetQrMessage(parsed))
        return
      }
      lockedRef.current = true
      stopCamera()
      navigate(`/t/${encodeURIComponent(parsed.token)}`, { replace: true })
    },
    [navigate, stopCamera],
  )

  useEffect(() => {
    let cancelled = false
    let timer = 0
    lockedRef.current = false

    const release = () => {
      window.clearTimeout(timer)
      stopCamera()
    }

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Este navegador não permite câmera no app. Use a câmera do celular no QR da etiqueta.')
        setUnsupported(true)
        return
      }

      const detector = await createQrDetector()
      if (cancelled) return
      if (!detector) {
        setUnsupported(true)
        setCameraError(
          'Leitura de QR neste navegador não está disponível. Use a câmera do celular na etiqueta (abre check.etto.one) — é o caminho oficial.',
        )
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop()
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) {
          for (const t of stream.getTracks()) t.stop()
          return
        }
        video.setAttribute('playsinline', 'true')
        video.setAttribute('webkit-playsinline', 'true')
        video.srcObject = stream
        await video.play()
      } catch {
        if (!cancelled) {
          setCameraError(
            'Não foi possível abrir a câmera. Permita o acesso ou use a câmera do celular na etiqueta.',
          )
        }
        return
      }

      const tick = async () => {
        if (cancelled || lockedRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d', { willReadFrequently: true }) ?? null
        if (
          video &&
          canvas &&
          ctx &&
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.videoWidth > 0
        ) {
          const maxW = 720
          const scale = Math.min(1, maxW / video.videoWidth)
          const w = Math.max(1, Math.round(video.videoWidth * scale))
          const h = Math.max(1, Math.round(video.videoHeight * scale))
          canvas.width = w
          canvas.height = h
          ctx.drawImage(video, 0, 0, w, h)
          try {
            const codes = await detector.detect(canvas)
            const raw = codes.map((c) => c.rawValue?.trim()).find((v) => v && v.length > 0)
            if (raw) {
              handleRaw(raw)
              return
            }
          } catch {
            /* frame sem QR */
          }
        }
        timer = window.setTimeout(() => {
          void tick()
        }, 120)
      }

      void tick()
    })()

    return () => {
      cancelled = true
      release()
    }
  }, [handleRaw, stopCamera])

  return (
    <section className="flex min-h-[70vh] flex-col gap-3">
      <header className="flex items-center gap-2 px-0.5">
        <Link
          to="/inicio"
          className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-900">Escanear</h1>
          <p className="text-xs text-slate-500">Local ou equipamento E.Check</p>
        </div>
      </header>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
        <video
          ref={videoRef}
          className="aspect-[3/4] w-full object-cover"
          muted
          playsInline
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-48 w-48 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-xs text-white">
          <ScanLine className="size-4 shrink-0 opacity-90" />
          <span>Aponte para o QR da etiqueta</span>
        </div>
      </div>

      {cameraError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {cameraError}
        </p>
      ) : null}

      {scanHint ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {scanHint}
        </p>
      ) : null}

      {unsupported ? (
        <p className="text-xs leading-relaxed text-slate-500">
          O scanner in-app é uma conveniência. O caminho oficial continua sendo a câmera do celular
          abrindo o link <span className="font-medium text-slate-700">check.etto.one/t/…</span> da
          etiqueta.
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          QR de outro app ou código de barras não abre verificação. Só etiquetas E.Check.
        </p>
      )}
    </section>
  )
}
