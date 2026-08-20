import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/features/auth/pages/login-page'
import { ProtectedRoute } from '@/features/auth/components/protected-route'
import { HomePage } from '@/features/check/pages/home-page'
import { RoutinePage } from '@/features/check/pages/routine-page'
import { RoutinesListPage } from '@/features/check/pages/routines-list-page'
import { ValidationDetailPage } from '@/features/check/pages/validation-detail-page'
import { ValidationListPage } from '@/features/check/pages/validation-list-page'
import { ActivitiesPage, ConferencesPage } from '@/features/activities/pages/activities-page'
import { ConferenceActivityPage } from '@/features/activities/pages/conference-activity-page'
import { ChecklistActivityPage } from '@/features/activities/pages/checklist-activity-page'
import { SimpleTaskActivityPage } from '@/features/activities/pages/simple-task-activity-page'
import { ReportIssuePage } from '@/features/activities/pages/report-issue-page'
import { MyIssuesPage } from '@/features/activities/pages/my-issues-page'
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
        path="/atividades"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ActivitiesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/conferencias"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ConferencesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/atividades/:activityId/conferencia"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ConferenceActivityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/atividades/:activityId/checklist"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ChecklistActivityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/atividades/:activityId/tarefa"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <SimpleTaskActivityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/atividades/:activityId/problema"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ReportIssuePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/relatar-problema"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ReportIssuePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meus-problemas"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <MyIssuesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rotinas"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <RoutinesListPage />
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
