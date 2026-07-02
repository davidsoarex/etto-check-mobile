import { AppShell } from '@/app/app-shell'
import { StoreDocumentTitle } from '@/components/store-document-title'
import { AuthProvider } from '@/features/auth/context/auth-context'

function App() {
  return (
    <AuthProvider>
      <StoreDocumentTitle />
      <AppShell />
    </AuthProvider>
  )
}

export default App
