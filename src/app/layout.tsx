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
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-paper text-ink font-body antialiased">
        {children}
      </body>
    </html>
  );
}
