"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface ToastInput {
  type: "success" | "error";
  message: string;
}

interface ToastMessage extends ToastInput {
  id: number;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

let nextToastId = 0;

// App-wide toast host: every Add-*/edit form fires a toast through
// useServerActionFeedback so a save is confirmed even after its modal/panel
// has already closed — see CLAUDE.md's UI conventions for the accent/danger
// color tokens used here.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(({ type, message }: ToastInput) => {
    const id = nextToastId++;
    setToasts((current) => [...current, { id, type, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto w-full max-w-sm rounded-md px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.type === "success" ? "bg-accent" : "bg-danger"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
