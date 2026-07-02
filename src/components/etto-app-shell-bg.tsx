/**
 * Fundo fixo (imagem + véus) — mesma linha visual do salgadetto-manager-front.
 */
export function EttoAppShellBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1]" aria-hidden>
      <img
        src="/imgs/etto-tech-background.png"
        alt=""
        className="h-full w-full object-cover object-center"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-deep/78 via-brand-deep/66 to-brand-deep/84" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(15,59,130,0.45)_70%,rgba(15,59,130,0.82)_100%)]" />
    </div>
  )
}
