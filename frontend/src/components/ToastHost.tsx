import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'
export type ToastPayload = { message: string; kind?: ToastKind; duration?: number }

export function notifyToast(message: string, kind: ToastKind = 'info', duration = 4500) {
  window.dispatchEvent(new CustomEvent<ToastPayload>('app-toast', { detail: { message, kind, duration } }))
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Array<ToastPayload & { id: number }>>([])
  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail
      const id = Date.now() + Math.random()
      setToasts(current => [...current, { ...detail, id }].slice(-4))
      window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), detail.duration || 4500)
    }
    const onError = (event: ErrorEvent) => notifyToast(event.message || 'Unexpected application error.', 'error')
    const onRejection = (event: PromiseRejectionEvent) => notifyToast(event.reason instanceof Error ? event.reason.message : 'A background request failed.', 'error')
    window.addEventListener('app-toast', onToast)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => { window.removeEventListener('app-toast', onToast); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection) }
  }, [])
  return <div className="toast-region" aria-live="polite" aria-atomic="true">{toasts.map(toast => <div className={`app-toast app-toast-${toast.kind || 'info'}`} key={toast.id}><span className="material-symbols-outlined">{toast.kind === 'success' ? 'check_circle' : toast.kind === 'error' ? 'error' : toast.kind === 'warning' ? 'warning' : 'info'}</span><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))}>×</button></div>)}</div>
}
