"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { primaryButtonClasses, secondaryButtonClasses } from "./styles";

interface ModalProps {
  triggerLabel: string;
  title: string;
  children: ReactNode;
}

// Wraps the native <dialog> element rather than a hand-rolled overlay div —
// gets focus trapping, Escape-to-close, and top-layer stacking for free.
// The form inside is deliberately left in control of its own submit/reset
// behavior: this component only opens and closes the dialog, so a form that
// wants to stay open after saving (e.g. AddDepositForm's "add another month"
// workflow) can, without fighting the modal for control.
export function Modal({ triggerLabel, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClasses}>
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        // A click lands with target === the dialog element itself only when
        // it hits the backdrop (content clicks target their own element) —
        // the standard vanilla-JS "click outside to close" trick for <dialog>.
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="m-auto w-[min(90vw,42rem)] rounded-md border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className={secondaryButtonClasses}
          >
            Close
          </button>
        </div>
        <div className="p-6">{children}</div>
      </dialog>
    </>
  );
}
