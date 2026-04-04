import type { Metadata } from "next";
import "./globals.css";
import AppShell from "./components/app-shell";
import { ToastProvider } from "./components/toast-provider";

export const metadata: Metadata = {
  title: "Lead OS",
  description: "Lead distribution and routing platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f5f7fb] text-gray-900">
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
