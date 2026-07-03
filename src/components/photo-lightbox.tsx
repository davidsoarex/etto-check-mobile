type Props = {
  open: boolean
  src: string | null
  alt: string
  onClose: () => void
}

export function PhotoLightbox({ open, src, alt, onClose }: Props) {
  if (!open || !src) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
        onClick={onClose}
      >
        Fechar
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}
