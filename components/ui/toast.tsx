"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

type ToastTone = "success" | "info" | "warning" | "error";
type ToastItem = { id: number; title: string; description?: string; tone: ToastTone };
type ToastInput = Omit<ToastItem, "id">;

const ToastContext = createContext<{ toast: (input: ToastInput) => void }>({
  toast: () => undefined,
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1_000);
    setItems((current) => [...current, { ...input, id }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 5_000);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-region" aria-live="polite">
        {items.map((item) => (
          <div className={`toast toast-${item.tone}`} key={item.id}>
            <strong>{item.title}</strong>
            {item.description ? <span>{item.description}</span> : null}
            <button
              aria-label="Dismiss notification"
              onClick={() => setItems((current) => current.filter((toast) => toast.id !== item.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
