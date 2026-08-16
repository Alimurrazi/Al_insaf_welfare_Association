import localFont from "next/font/local";

// Insaf Ledger design system — see the approved design-system artifact.
// Headings only; used sparingly.
export const fontDisplay = localFont({
  src: [
    { path: "./fonts/fraunces-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/fraunces-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/fraunces-italic-500.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

// Body copy, forms, UI text.
export const fontBody = localFont({
  src: [
    { path: "./fonts/public-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/public-sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/public-sans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

// Amounts, dates, badges, labels — anything that needs tabular figures.
export const fontMono = localFont({
  src: [
    { path: "./fonts/plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});
