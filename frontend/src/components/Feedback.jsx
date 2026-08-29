import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);
const ConfirmContext = createContext(null);

let idCounter = 0;

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const TOAST_STYLES = {
  success: "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300",
  error: "border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/70 text-red-700 dark:text-red-300",
  info: "border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300",
};

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const resolverRef = useRef(null);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = ++idCounter;
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const toast = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
    info: (message) => push("info", message),
  };

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const resolveConfirm = (result) => {
    setConfirmState(null);
    resolverRef.current?.(result);
  };

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-center gap-2 print:hidden sm:inset-x-auto sm:right-4 sm:items-end">
          <AnimatePresence>
            {toasts.map((t) => {
              const Icon = ICONS[t.type];
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: -12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg ${TOAST_STYLES[t.type]}`}
                >
                  <Icon size={17} className="mt-0.5 flex-none" />
                  <p className="flex-1 text-sm font-medium">{t.message}</p>
                  <button onClick={() => dismiss(t.id)} className="text-current/60 transition hover:text-current">
                    <X size={14} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {confirmState && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 grid place-items-center bg-ink-950/50 px-4"
              onClick={() => resolveConfirm(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl bg-white dark:bg-ink-900 p-6 shadow-xl"
              >
                <h3 className="font-bold text-ink-900 dark:text-white">{confirmState.title}</h3>
                {confirmState.message && <p className="mt-2 text-sm text-slate-500 dark:text-white/50">{confirmState.message}</p>}
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => resolveConfirm(false)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 dark:text-white/50 transition hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => resolveConfirm(true)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      confirmState.danger
                        ? "bg-red-600 text-white hover:bg-red-500"
                        : "bg-gold-500 text-white hover:bg-gold-600"
                    }`}
                  >
                    {confirmState.confirmLabel || "Confirm"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
