import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_BRAND } from "@/lib/app-metadata";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_BRAND.contestName,
  description: APP_BRAND.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang={APP_BRAND.defaultLocale}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
