import { EttoAppShellBg } from '@/components/etto-app-shell-bg'
import { EttoAppFooter } from '@/components/etto-app-footer'
import { useAuth } from '@/features/auth/context/use-auth'
import { useLocation } from 'react-router-dom'
import { AppRoutes } from './routes'

export function AppShell() {
  const { isAuthenticated, isAuthLoading, login, logout } = useAuth()
  const location = useLocation()
  const isLoginRoute = location.pathname === '/login'

  if (isAuthLoading) {
    return (
      <div
        className="relative grid min-h-dvh w-full place-items-center overflow-hidden bg-brand-deep"
        style={{ backgroundColor: 'var(--etto-brand-deep, #0f3b82)' }}
      >
        <EttoAppShellBg />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <img
            src="/imgs/etto-logo.png"
            alt="E•tto"
            className="h-auto w-[72vw] max-w-[13rem] object-contain drop-shadow-lg"
            draggable={false}
          />
          <p className="text-sm text-white/80">Carregando...</p>
        </div>
      </div>
    )
  }

  if (isLoginRoute) {
    return (
      <div className="w-full min-h-dvh overflow-x-hidden">
        <AppRoutes isAuthenticated={isAuthenticated} onLogin={login} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full min-h-dvh max-w-md overflow-x-hidden bg-[#f3f6ff] pb-8">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-[#f3f6ff]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/etto-mark.png" alt="E•tto" className="h-8 w-8 object-contain" draggable={false} />
          <div>
            <p className="text-sm font-semibold text-slate-900">E•Check</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Registro fotográfico</p>
          </div>
        </div>
      </header>

      <main className="min-w-0 space-y-3 px-3 py-3">
        <AppRoutes isAuthenticated={isAuthenticated} onLogin={login} onLogout={logout} />
        <EttoAppFooter compact className="pt-2" />
      </main>
    </div>
  )
}
