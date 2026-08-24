/** Compressão de evidência operacional E•Check (antes do upload). */

export const ECHECK_PHOTO_MAX_SIDE = 1920
export const ECHECK_PHOTO_JPEG_QUALITY = 0.75

export type EcheckPhotoCompressMetrics = {
  beforeBytes: number
  afterBytes: number
  beforeWidth: number
  beforeHeight: number
  afterWidth: number
  afterHeight: number
  mime: string
  processMs: number
  skipped: boolean
  skipReason?: string
}

export type EcheckPhotoCompressResult = {
  file: File
  metrics: EcheckPhotoCompressMetrics
}

/** Dimensões de destino preservando aspect ratio (maior lado ≤ maxSide). */
export function computeResizeDimensions(
  width: number,
  height: number,
  maxSide = ECHECK_PHOTO_MAX_SIDE,
): { width: number; height: number; scaled: boolean } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: Math.max(1, width || 1), height: Math.max(1, height || 1), scaled: false }
  }
  const long = Math.max(width, height)
  if (long <= maxSide) {
    return { width: Math.round(width), height: Math.round(height), scaled: false }
  }
  const scale = maxSide / long
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  }
}

function logMetrics(metrics: EcheckPhotoCompressMetrics) {
  // Sem conteúdo da imagem — só metadados para diagnóstico de gate.
  console.info('[echeck-photo-compress]', {
    beforeBytes: metrics.beforeBytes,
    afterBytes: metrics.afterBytes,
    before: `${metrics.beforeWidth}x${metrics.beforeHeight}`,
    after: `${metrics.afterWidth}x${metrics.afterHeight}`,
    mime: metrics.mime,
    processMs: metrics.processMs,
    skipped: metrics.skipped,
    skipReason: metrics.skipReason,
    ratio:
      metrics.beforeBytes > 0
        ? Number((metrics.afterBytes / metrics.beforeBytes).toFixed(3))
        : null,
  })
}

/**
 * Redimensiona e reencode como JPEG quando necessário.
 * Preserva orientação via createImageBitmap({ imageOrientation: 'from-image' }).
 */
export async function compressEcheckPhotoForUpload(
  input: File,
  options?: { maxSide?: number; quality?: number },
): Promise<EcheckPhotoCompressResult> {
  const maxSide = options?.maxSide ?? ECHECK_PHOTO_MAX_SIDE
  const quality = options?.quality ?? ECHECK_PHOTO_JPEG_QUALITY
  const started = performance.now()
  const beforeBytes = input.size

  if (!input.type.startsWith('image/') && input.type !== '') {
    const metrics: EcheckPhotoCompressMetrics = {
      beforeBytes,
      afterBytes: beforeBytes,
      beforeWidth: 0,
      beforeHeight: 0,
      afterWidth: 0,
      afterHeight: 0,
      mime: input.type || 'unknown',
      processMs: Math.round(performance.now() - started),
      skipped: true,
      skipReason: 'not-image',
    }
    logMetrics(metrics)
    return { file: input, metrics }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(input, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  } catch {
    // Fallback sem orientação explícita (browsers antigos).
    try {
      bitmap = await createImageBitmap(input)
    } catch {
      const metrics: EcheckPhotoCompressMetrics = {
        beforeBytes,
        afterBytes: beforeBytes,
        beforeWidth: 0,
        beforeHeight: 0,
        afterWidth: 0,
        afterHeight: 0,
        mime: input.type || 'unknown',
        processMs: Math.round(performance.now() - started),
        skipped: true,
        skipReason: 'decode-failed',
      }
      logMetrics(metrics)
      return { file: input, metrics }
    }
  }

  const beforeWidth = bitmap.width
  const beforeHeight = bitmap.height
  const { width, height, scaled } = computeResizeDimensions(beforeWidth, beforeHeight, maxSide)

  const alreadySmallJpeg =
    !scaled &&
    beforeBytes <= 450_000 &&
    (input.type === 'image/jpeg' || input.type === 'image/jpg')

  if (alreadySmallJpeg) {
    bitmap.close()
    const metrics: EcheckPhotoCompressMetrics = {
      beforeBytes,
      afterBytes: beforeBytes,
      beforeWidth,
      beforeHeight,
      afterWidth: beforeWidth,
      afterHeight: beforeHeight,
      mime: input.type,
      processMs: Math.round(performance.now() - started),
      skipped: true,
      skipReason: 'already-small-jpeg',
    }
    logMetrics(metrics)
    return { file: input, metrics }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    const metrics: EcheckPhotoCompressMetrics = {
      beforeBytes,
      afterBytes: beforeBytes,
      beforeWidth,
      beforeHeight,
      afterWidth: beforeWidth,
      afterHeight: beforeHeight,
      mime: input.type || 'unknown',
      processMs: Math.round(performance.now() - started),
      skipped: true,
      skipReason: 'no-canvas',
    }
    logMetrics(metrics)
    return { file: input, metrics }
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  })

  if (!blob || blob.size === 0) {
    const metrics: EcheckPhotoCompressMetrics = {
      beforeBytes,
      afterBytes: beforeBytes,
      beforeWidth,
      beforeHeight,
      afterWidth: width,
      afterHeight: height,
      mime: input.type || 'unknown',
      processMs: Math.round(performance.now() - started),
      skipped: true,
      skipReason: 'encode-failed',
    }
    logMetrics(metrics)
    return { file: input, metrics }
  }

  // Se o JPEG ficou maior que o original (raro), mantém o original.
  if (blob.size >= beforeBytes && input.type.startsWith('image/')) {
    const metrics: EcheckPhotoCompressMetrics = {
      beforeBytes,
      afterBytes: beforeBytes,
      beforeWidth,
      beforeHeight,
      afterWidth: beforeWidth,
      afterHeight: beforeHeight,
      mime: input.type,
      processMs: Math.round(performance.now() - started),
      skipped: true,
      skipReason: 'no-gain',
    }
    logMetrics(metrics)
    return { file: input, metrics }
  }

  const baseName = input.name.replace(/\.[^.]+$/, '') || 'echeck-photo'
  const file = new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })

  const metrics: EcheckPhotoCompressMetrics = {
    beforeBytes,
    afterBytes: file.size,
    beforeWidth,
    beforeHeight,
    afterWidth: width,
    afterHeight: height,
    mime: 'image/jpeg',
    processMs: Math.round(performance.now() - started),
    skipped: false,
  }
  logMetrics(metrics)
  return { file, metrics }
}
