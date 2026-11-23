import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import { SessionActivityGuard } from "@/components/auth/SessionActivityGuard";
import { APP_BRAND } from "@/lib/app-metadata";
import "./globals.css";

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["italic"],
  variable: "--font-newsreader",
  display: "swap",
});

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
    <html
      lang={APP_BRAND.defaultLocale}
      className={`${bricolageGrotesque.variable} ${dmSans.variable} ${newsreader.variable}`}
    >
      <body className="min-h-screen bg-paper text-ink font-body antialiased">
        <a href="#contenido" className="skip-link">
          Saltar al contenido principal
        </a>
        {children}
        <SessionActivityGuard />
      </body>
    </html>
  );
}
