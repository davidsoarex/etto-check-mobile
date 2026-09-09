import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, ScanLine } from 'lucide-react'
import {
  parseCheckTargetQr,
  parseCheckTargetQrMessage,
} from '@/features/check-targets/lib/parse-check-target-qr'
import { createQrFrameDecoder } from '@/features/check-targets/lib/decode-qr-frame'
import {
  attachStreamToVideo,
  openEcheckCameraStream,
} from '@/features/check-targets/lib/open-echeck-camera'

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
  const runningRef = useRef(false)
  const [live, setLive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanHint, setScanHint] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    runningRef.current = false
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) video.srcObject = null
    setLive(false)
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

  const startCamera = useCallback(async () => {
    if (runningRef.current || lockedRef.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Este navegador não permite câmera no app. Use a câmera do celular no QR da etiqueta.',
      )
      return
    }

    runningRef.current = true
    setStarting(true)
    setCameraError(null)
    setScanHint(null)

    try {
      const stream = await openEcheckCameraStream()
      if (lockedRef.current) {
        for (const t of stream.getTracks()) t.stop()
        runningRef.current = false
        setStarting(false)
        return
      }

      let video = videoRef.current
      if (!video) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        video = videoRef.current
      }
      if (!video) {
        for (const t of stream.getTracks()) t.stop()
        runningRef.current = false
        setStarting(false)
        setCameraError('Não foi possível ligar o preview da câmera. Toque para tentar de novo.')
        return
      }

      streamRef.current = stream
      await attachStreamToVideo(video, stream)
      setLive(true)
      setStarting(false)
    } catch {
      runningRef.current = false
      setStarting(false)
      setLive(false)
      setCameraError(
        'Não foi possível abrir a câmera. Permita o acesso nas configurações do navegador, ou use a câmera do celular na etiqueta.',
      )
    }
  }, [])

  useEffect(() => {
    lockedRef.current = false
    void startCamera()
    return () => {
      lockedRef.current = true
      stopCamera()
    }
  }, [startCamera, stopCamera])

  useEffect(() => {
    if (!live) return
    const watchdog = window.setTimeout(() => {
      const video = videoRef.current
      if (!video || video.videoWidth > 0) return
      stopCamera()
      setCameraError(null)
    }, 1800)
    return () => window.clearTimeout(watchdog)
  }, [live, stopCamera])

  useEffect(() => {
    if (!live) return
    let cancelled = false
    let timer = 0

    void (async () => {
      const decoder = await createQrFrameDecoder()
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
            const raw = await decoder.detect(canvas)
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
      window.clearTimeout(timer)
    }
  }, [live, handleRaw])

  const showStartOverlay = !live && !starting

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

      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          muted
          playsInline
          autoPlay
          disablePictureInPicture
        />
        <canvas ref={canvasRef} className="hidden" />
        {live ? (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-[18%] bg-black/35" />
            <div className="absolute inset-x-0 bottom-0 h-[18%] bg-black/35" />
            <div className="absolute inset-y-[18%] left-0 w-[10%] bg-black/35" />
            <div className="absolute inset-y-[18%] right-0 w-[10%] bg-black/35" />
            <div className="absolute left-[10%] right-[10%] top-[18%] bottom-[18%] rounded-2xl border-2 border-white/85" />
          </div>
        ) : null}
        {live ? (
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-xs text-white">
            <ScanLine className="size-4 shrink-0 opacity-90" />
            <span>Aponte para o QR da etiqueta</span>
          </div>
        ) : null}
        {starting ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-900/80 px-6 text-center text-sm text-white">
            Abrindo câmera…
          </div>
        ) : null}
        {showStartOverlay ? (
          <button
            type="button"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center"
            onClick={() => {
              lockedRef.current = false
              void startCamera()
            }}
          >
            <span className="grid size-14 place-items-center rounded-full bg-white/10 text-white">
              <Camera className="size-7" />
            </span>
            <span className="text-sm font-semibold text-white">Toque para ligar a câmera</span>
            <span className="text-xs text-white/70">
              Necessário no iPhone e em alguns Androids para o preview aparecer.
            </span>
          </button>
        ) : null}
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

      <p className="text-xs leading-relaxed text-slate-500">
        Se a câmera não abrir no app, use a câmera do celular na etiqueta — o caminho oficial continua
        sendo o link <span className="font-medium text-slate-700">check.etto.one/t/…</span>.
      </p>
    </section>
  )
}
