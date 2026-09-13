import type { Metadata } from "next";
import { fontBody, fontDisplay, fontMono } from "@/fonts";
import { TopNav } from "@/components/top-nav";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Al-Insaf Welfare Association",
  description: "Deposit and land fund management for Al-Insaf Welfare Association",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ToastProvider>
          <TopNav />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
