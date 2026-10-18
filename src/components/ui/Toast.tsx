"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type Toast = { id: number; kind: "success" | "error" | "info"; title: string; description?: string };
type ToastApi = { toast: (t: Omit<Toast, "id">) => void; success: (title: string, description?: string) => void; error: (title: string, description?: string) => void; info: (title: string, description?: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const remove = useCallback((id: number) => setItems((x) => x.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq.current;
      setItems((x) => [...x.slice(-3), { ...t, id }]);
      setTimeout(() => remove(id), t.kind === "error" ? 6000 : 3800);
    },
    [remove],
  );
  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, description) => toast({ kind: "success", title, description }),
      error: (title, description) => toast({ kind: "error", title, description }),
      info: (title, description) => toast({ kind: "info", title, description }),
    }),
    [toast],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-3 safe-top" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="glass glass-strong glass-md pointer-events-auto flex w-full max-w-sm items-start gap-3 px-4 py-3"
              role="status"
            >
              <span className={t.kind === "success" ? "text-success" : t.kind === "error" ? "text-danger" : "text-brand"}>
                {t.kind === "success" ? <CheckCircle2 size={20} /> : t.kind === "error" ? <AlertTriangle size={20} /> : <Info size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{t.title}</div>
                {t.description && <div className="text-xs text-fg-muted">{t.description}</div>}
              </div>
              <button onClick={() => remove(t.id)} className="text-fg-muted" aria-label="סגירה">
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
