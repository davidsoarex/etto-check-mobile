import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/features/auth/pages/login-page'
import { ProtectedRoute } from '@/features/auth/components/protected-route'
import { HomePage } from '@/features/check/pages/home-page'
import { RoutinePage } from '@/features/check/pages/routine-page'
import { ValidationDetailPage } from '@/features/check/pages/validation-detail-page'
import { ValidationListPage } from '@/features/check/pages/validation-list-page'
import type { LoginInput } from '@/features/auth/context/auth-context-instance'

type AppRoutesProps = {
  isAuthenticated: boolean
  onLogin: (input: LoginInput) => Promise<void>
  onLogout?: () => void
}

export function AppRoutes({ isAuthenticated, onLogin }: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? '/inicio' : '/login'} replace />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/inicio" replace /> : <LoginPage onLogin={onLogin} />}
      />
      <Route
        path="/inicio"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rotinas/:routineId"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <RoutinePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/validacao"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ValidationListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/validacao/:submissionId"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ValidationDetailPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
