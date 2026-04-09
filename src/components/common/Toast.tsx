'use client'

/**
 * @컴포넌트: Toast
 * @설명: 전역 Toast 알림 시스템 — ToastProvider + useToast 훅
 */

import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface Toast {
  id: string
  type: 'success' | 'error'
  message: string
}

interface ToastCtx {
  showToast: (type: 'success' | 'error', message: string) => void
}

const ToastContext = createContext<ToastCtx>({ showToast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* 화면 우상단 토스트 컨테이너 */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none min-w-[260px] max-w-[360px]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl pointer-events-auto
              ${toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400'
                : 'bg-red-950/90 border-red-500/30 text-red-400'
              }`}
          >
            {toast.type === 'success'
              ? <CheckCircle size={15} className="shrink-0 mt-0.5" />
              : <XCircle size={15} className="shrink-0 mt-0.5" />
            }
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              onClick={() => remove(toast.id)}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
