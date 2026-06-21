import { create } from "zustand";

let nextId = 1;

// Minimal toast queue. Kept tiny on purpose — no external toast library.
// success | error | warning. Auto-dismiss after `ttl` ms.
export const useToastStore = create((set, get) => ({
  toasts: [],

  push: (type, message, ttl = 3500) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, type, message }] });
    if (ttl > 0) {
      setTimeout(() => get().dismiss(id), ttl);
    }
    return id;
  },

  dismiss: (id) =>
    set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

// Convenience helpers usable outside React components.
export const toast = {
  success: (m) => useToastStore.getState().push("success", m),
  error: (m) => useToastStore.getState().push("error", m),
  warning: (m) => useToastStore.getState().push("warning", m),
};
