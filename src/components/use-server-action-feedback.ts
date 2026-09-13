"use client";

import { useState, useTransition } from "react";
import type { Feedback } from "./form-feedback";
import { useToast } from "./toast";

// Shared by every Add-*/edit form (deposits, top-ups, expenses, members): run
// a server action, disable the caller's submit button via `pending`, confirm
// the outcome with a toast, and never leak the action's raw error (which may
// be an internal message like "Member not found: <id>") to the screen — just
// a generic retry prompt. `feedback` only ever carries an error: the success
// case is toast-only, since most callers close their modal/panel as soon as
// `onSuccess` runs and an inline banner would just unmount half-shown.
export function useServerActionFeedback() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function run(action: () => Promise<void>, successMessage: string, onSuccess?: () => void) {
    setFeedback(null);
    startTransition(async () => {
      try {
        await action();
        onSuccess?.();
        showToast({ type: "success", message: successMessage });
      } catch {
        const message = "Couldn't save — please try again.";
        setFeedback({ type: "error", message });
        showToast({ type: "error", message });
      }
    });
  }

  return { feedback, pending, run };
}
