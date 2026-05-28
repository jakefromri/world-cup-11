import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { cn } from '@/lib/cn'

interface Toast {
  id: string
  message: string
  type?: 'default' | 'error' | 'success'
}

interface ToastContextValue {
  toast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: Toast['type'] = 'default') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'rounded-lg px-4 py-3 text-sm font-medium shadow-lg pointer-events-auto',
              t.type === 'error' && 'bg-accent-red text-white',
              t.type === 'success' && 'bg-accent-green text-black',
              (!t.type || t.type === 'default') && 'bg-surface-raised text-text-primary border border-border'
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// Dummy export to keep hook file consistent
export function useEffect_unused() { useEffect(() => {}, []) }
