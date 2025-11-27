import React, { useState, useCallback } from "react";
import { toast as sonnerToast } from "sonner";

export type Toast = {
  id: string;
  title?: string;
  description?: string | React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    ({
      title,
      description,
      variant = "default",
      duration = 3000,
    }: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).substring(7);
      const newToast: Toast = { id, title, description, variant, duration };

      setToasts(prev => [...prev, newToast]);

      if (variant === "destructive") {
        sonnerToast.error(title || "Error", {
          description:
            typeof description === "string" ? description : undefined,
          duration,
        });
      } else {
        sonnerToast.success(title || "Éxito", {
          description:
            typeof description === "string" ? description : undefined,
          duration,
        });
      }

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);

      return {
        id,
        dismiss: () => {
          setToasts(prev => prev.filter(t => t.id !== id));
          sonnerToast.dismiss(id);
        },
      };
    },
    []
  );

  return {
    toast,
    toasts,
  };
}

