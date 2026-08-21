"use client";

import { useState, useTransition } from "react";
import type { Feedback } from "./form-feedback";

// Shared by every Add-* form (deposits, top-ups, expenses, members): run a
// server action, show a success or error message inline, and never leak the
// action's raw error (which may be an internal message like
// "Member not found: <id>") to the screen — just a generic retry prompt.
export function useServerActionFeedback() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>, successMessage: string, onSuccess?: () => void) {
    setFeedback(null);
    startTransition(async () => {
      try {
        await action();
        onSuccess?.();
        setFeedback({ type: "success", message: successMessage });
      } catch {
        setFeedback({ type: "error", message: "Couldn't save — please try again." });
      }
    });
  }

  return { feedback, pending, run };
}
