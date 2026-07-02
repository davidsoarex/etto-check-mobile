import { createContext } from 'react'

export type LoginInput = {
  cpf: string
  transactionalPin: string
}

export type AuthContextValue = {
  isAuthLoading: boolean
  isAuthenticated: boolean
  collaboratorName: string
  portalToken: string | null
  login: (input: LoginInput) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
