import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const Ctx = createContext(null);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const remove = (id) => setItems((l) => l.filter((x) => x.id !== id));
  const push = useCallback((kind, msg) => {
    const text = typeof msg === 'string' ? msg : msg?.message || 'Something went wrong.';
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => remove(id), kind === 'error' ? 7000 : 3500);
  }, []);
  const api = useMemo(() => ({ success: (m) => push('success', m), error: (m) => push('error', m) }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex max-w-md animate-rise items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${t.kind === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
            {t.kind === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />}
            <span>{t.text}</span>
            <button className="ml-1 opacity-70 hover:opacity-100" onClick={() => remove(t.id)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
