import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { Home } from '@/pages/Home'
import { Login } from '@/pages/Login'
import { AuthCallback } from '@/pages/AuthCallback'
import { Join } from '@/pages/Join'
import { League } from '@/pages/League'
import { Pick } from '@/pages/Pick'
import { Admin } from '@/pages/Admin'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/league/:id" element={<League />} />
          <Route path="/league/:id/pick" element={<Pick />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
