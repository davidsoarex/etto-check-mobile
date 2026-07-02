import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { AuthContext, type AuthContextValue } from './auth-context-instance'
import { normalizeCpfDigits, normalizeTransactionalPin } from '@/lib/portal-auth'
import { fetchEcheckMe, loginEcheckPortal } from '@/services/echeck-api'

const TOKEN_KEY = 'etto.echeck.token'
const NAME_KEY = 'etto.echeck.name'

export function AuthProvider({ children }: PropsWithChildren) {
  const initialToken = localStorage.getItem(TOKEN_KEY)
  const initialName = localStorage.getItem(NAME_KEY)

  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(initialToken))
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(initialToken))
  const [portalToken, setPortalToken] = useState<string | null>(initialToken)
  const [collaboratorName, setCollaboratorName] = useState(initialName || 'Colaborador')

  const logout = useCallback(() => {
    setIsAuthenticated(false)
    setPortalToken(null)
    setIsAuthLoading(false)
    setCollaboratorName('Colaborador')
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(NAME_KEY)
  }, [])

  useEffect(() => {
    if (!portalToken) return
    void fetchEcheckMe(portalToken)
      .then((me) => {
        setCollaboratorName(me.name || 'Colaborador')
        localStorage.setItem(NAME_KEY, me.name || 'Colaborador')
        setIsAuthenticated(true)
      })
      .catch(() => logout())
      .finally(() => setIsAuthLoading(false))
  }, [logout, portalToken])

  const login = useCallback(async ({ cpf, transactionalPin }: { cpf: string; transactionalPin: string }) => {
    const cpfDigits = normalizeCpfDigits(cpf)
    const pinDigits = normalizeTransactionalPin(transactionalPin)
    if (cpfDigits.length !== 11) throw new Error('Informe o CPF com 11 dígitos.')
    if (pinDigits.length !== 4) throw new Error('Informe a senha transacional com 4 dígitos.')

    const result = await loginEcheckPortal({ cpf: cpfDigits, transactionalPin: pinDigits })
    setPortalToken(result.token)
    setCollaboratorName(result.collaborator?.name || 'Colaborador')
    setIsAuthenticated(true)
    setIsAuthLoading(false)
    localStorage.setItem(TOKEN_KEY, result.token)
    localStorage.setItem(NAME_KEY, result.collaborator?.name || 'Colaborador')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthLoading,
      isAuthenticated,
      portalToken,
      collaboratorName,
      login,
      logout,
    }),
    [collaboratorName, isAuthLoading, isAuthenticated, login, logout, portalToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
