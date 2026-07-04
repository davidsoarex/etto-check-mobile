import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import { AuthContext, type AuthContextValue } from './auth-context-instance'

import { normalizeCpfDigits, normalizeTransactionalPin } from '@/lib/portal-auth'

import { fetchEcheckMe, loginEcheckPortal, type EcheckPortalProfile } from '@/services/echeck-api'



const TOKEN_KEY = 'etto.echeck.token'

const NAME_KEY = 'etto.echeck.name'

const SUPERVISOR_KEY = 'etto.echeck.supervisor'

const ROUTINE_ACCESS_KEY = 'etto.echeck.routineAccess'



function applyProfile(profile: EcheckPortalProfile) {

  localStorage.setItem(NAME_KEY, profile.name || 'Colaborador')

  localStorage.setItem(SUPERVISOR_KEY, profile.isSupervisor ? '1' : '0')

  localStorage.setItem(ROUTINE_ACCESS_KEY, profile.hasRoutineAccess ? '1' : '0')

  return {

    collaboratorName: profile.name || 'Colaborador',

    isSupervisor: profile.isSupervisor,

    hasRoutineAccess: profile.hasRoutineAccess,

    canValidateSubmissions: profile.canValidateSubmissions,

  }

}



export function AuthProvider({ children }: PropsWithChildren) {

  const initialToken = localStorage.getItem(TOKEN_KEY)

  const initialName = localStorage.getItem(NAME_KEY)



  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(initialToken))

  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(initialToken))

  const [portalToken, setPortalToken] = useState<string | null>(initialToken)

  const [collaboratorName, setCollaboratorName] = useState(initialName || 'Colaborador')

  const [isSupervisor, setIsSupervisor] = useState(localStorage.getItem(SUPERVISOR_KEY) === '1')

  const [hasRoutineAccess, setHasRoutineAccess] = useState(

    localStorage.getItem(ROUTINE_ACCESS_KEY) !== '0',

  )

  const [canValidateSubmissions, setCanValidateSubmissions] = useState(

    localStorage.getItem(SUPERVISOR_KEY) === '1',

  )



  const logout = useCallback(() => {

    setIsAuthenticated(false)

    setPortalToken(null)

    setIsAuthLoading(false)

    setCollaboratorName('Colaborador')

    setIsSupervisor(false)

    setHasRoutineAccess(false)

    setCanValidateSubmissions(false)

    localStorage.removeItem(TOKEN_KEY)

    localStorage.removeItem(NAME_KEY)

    localStorage.removeItem(SUPERVISOR_KEY)

    localStorage.removeItem(ROUTINE_ACCESS_KEY)

  }, [])



  useEffect(() => {

    if (!portalToken) return

    void fetchEcheckMe(portalToken)

      .then((me) => {

        const next = applyProfile(me)

        setCollaboratorName(next.collaboratorName)

        setIsSupervisor(next.isSupervisor)

        setHasRoutineAccess(next.hasRoutineAccess)

        setCanValidateSubmissions(next.canValidateSubmissions)

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

    const next = applyProfile(result.collaborator)

    setPortalToken(result.token)

    setCollaboratorName(next.collaboratorName)

    setIsSupervisor(next.isSupervisor)

    setHasRoutineAccess(next.hasRoutineAccess)

    setCanValidateSubmissions(next.canValidateSubmissions)

    setIsAuthenticated(true)

    setIsAuthLoading(false)

    localStorage.setItem(TOKEN_KEY, result.token)

  }, [])



  const value = useMemo<AuthContextValue>(

    () => ({

      isAuthLoading,

      isAuthenticated,

      portalToken,

      collaboratorName,

      isSupervisor,

      hasRoutineAccess,

      canValidateSubmissions,

      login,

      logout,

    }),

    [

      canValidateSubmissions,

      collaboratorName,

      hasRoutineAccess,

      isAuthLoading,

      isAuthenticated,

      isSupervisor,

      login,

      logout,

      portalToken,

    ],

  )



  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>

}


