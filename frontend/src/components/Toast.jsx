import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((mensaje, tipo = 'success') => {
    const id = Date.now() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const close = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          const config = {
            success: 'border-emerald-500/30 bg-zinc-950/95 text-emerald-300 shadow-emerald-500/10',
            error: 'border-rose-500/30 bg-zinc-950/95 text-rose-300 shadow-rose-500/10',
            info: 'border-sky-500/30 bg-zinc-950/95 text-sky-300 shadow-sky-500/10',
          }[toast.tipo] || 'border-zinc-700 bg-zinc-950/95 text-zinc-100';

          const icon = {
            success: '✓',
            error: '✕',
            info: 'ℹ',
          }[toast.tipo] || '•';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border p-3.5 text-xs font-semibold shadow-2xl backdrop-blur-md animate-toast-in ${config}`}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
                  {icon}
                </span>
                <span className="leading-snug">{toast.mensaje}</span>
              </div>
              <button
                type="button"
                onClick={() => close(toast.id)}
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { show: () => {} };
  }
  return ctx;
}
