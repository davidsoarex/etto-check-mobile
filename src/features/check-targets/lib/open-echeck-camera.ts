/** Rear camera with progressive fallback. Avoid size constraints — they black out preview on some phones. */
export async function openEcheckCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('no_get_user_media')
  }

  const attempts: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: { facingMode: 'environment' } },
    { audio: false, video: true },
  ]

  let last: unknown
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      last = err
    }
  }

  throw last instanceof Error ? last : new Error('camera_denied')
}

export async function attachStreamToVideo(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<void> {
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.setAttribute('muted', '')
  video.srcObject = stream

  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('camera_metadata_timeout')), 8000)
      video.addEventListener(
        'loadedmetadata',
        () => {
          window.clearTimeout(t)
          resolve()
        },
        { once: true },
      )
      video.addEventListener(
        'error',
        () => {
          window.clearTimeout(t)
          reject(new Error('camera_element_error'))
        },
        { once: true },
      )
    })
  }

  await video.play()
}
