import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  ClerkProvider,
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  useAuth,
} from '@clerk/clerk-react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import App from './App'
import './index.css'
import { setApiAuthTokenResolver } from './lib/api'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function AuthenticatedApp() {
  const { getToken } = useAuth()

  React.useEffect(() => {
    setApiAuthTokenResolver(() => getToken())
    return () => setApiAuthTokenResolver(null)
  }, [getToken])

  return (
    <>
      <SignedIn>
        <App />
      </SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {publishableKey ? (
      <ClerkProvider publishableKey={publishableKey}>
        <BrowserRouter>
          <Routes>
            <Route
              path="/sign-in/*"
              element={<SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/" />}
            />
            <Route
              path="/sign-up/*"
              element={<SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/" />}
            />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </React.StrictMode>,
)
