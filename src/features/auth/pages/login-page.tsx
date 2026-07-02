import { useState, type FormEvent } from 'react'
import { EttoLoginScreen } from '@/components/etto-login-screen'
import { formatCpf, normalizeCpfDigits, normalizeTransactionalPin } from '@/lib/portal-auth'
import type { LoginInput } from '../context/auth-context-instance'

type LoginPageProps = {
  onLogin: (input: LoginInput) => void
}

const inputClassName =
  'h-11 box-border w-full max-w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-brand-cobalt/40 focus:ring-2 sm:text-sm'

export function LoginPage({ onLogin }: LoginPageProps) {
  const [cpf, setCpf] = useState('')
  const [transactionalPin, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const cpfDigits = normalizeCpfDigits(cpf)
  const pinDigits = normalizeTransactionalPin(transactionalPin)
  const canSubmit = cpfDigits.length === 11 && pinDigits.length === 4

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || isSubmitting) return
    setErrorMessage(null)
    setIsSubmitting(true)
    try {
      await onLogin({ cpf: cpfDigits, transactionalPin: pinDigits })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao entrar.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <EttoLoginScreen
      portalLabel="E•Check"
      title="Entrar"
      description="Use seu CPF e a senha transacional de 4 dígitos para registrar fotos ou validar registros, conforme seu perfil."
    >
      <form className="min-w-0 space-y-4" onSubmit={submitLogin}>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-slate-600">CPF</span>
          <input
            type="text"
            value={cpf}
            onChange={(event) => setCpf(formatCpf(event.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            autoComplete="username"
            className={inputClassName}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-slate-600">Senha transacional</span>
          <input
            type="password"
            value={transactionalPin}
            onChange={(event) => setPassword(normalizeTransactionalPin(event.target.value))}
            placeholder="••••"
            inputMode="numeric"
            maxLength={4}
            autoComplete="current-password"
            className={inputClassName}
          />
        </label>
        <button type="submit" disabled={!canSubmit || isSubmitting} className="etto-btn-primary mt-1">
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
        {errorMessage ? <p className="text-xs text-rose-600">{errorMessage}</p> : null}
      </form>
    </EttoLoginScreen>
  )
}
