import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, CloseIcon } from "./Icons";

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; message: string };
type Notify = (kind: ToastKind, message: string) => void;

const ToastContext = createContext<Notify>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems(current => current.filter(item => item.id !== id));
  }, []);

  const notify = useCallback<Notify>((kind, message) => {
    const id = nextId.current++;
    setItems(current => [...current, { id, kind, message }]);
    // Errors stay longer: they usually need to be read and acted on.
    window.setTimeout(() => dismiss(id), kind === "error" ? 8000 : 4000);
  }, [dismiss]);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {items.map(item => (
          <div key={item.id} className={`toast ${item.kind}`}>
            <span className="toast-icon">
              {item.kind === "success" ? <CheckIcon /> : <AlertIcon />}
            </span>
            <span className="toast-message">{item.message}</span>
            <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => dismiss(item.id)}>
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
