export interface Feedback {
  type: "success" | "error";
  message: string;
}

// Shared success/error banner for the Add-* forms — previously a failed
// server action just dropped the user on Next's error screen, which is
// alarming for non-technical users; this makes both outcomes visible inline
// without leaving the form.
export function FormFeedback({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;

  const classes =
    feedback.type === "success"
      ? "rounded-md bg-accent-soft px-4 py-3 text-sm text-accent"
      : "rounded-md bg-danger-soft px-4 py-3 text-sm text-danger";

  return (
    <p className={classes} role="status">
      {feedback.message}
    </p>
  );
}
