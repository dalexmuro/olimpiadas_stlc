import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageReveal } from "@/components/layout/PageReveal";

export default function ConcursoLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-paper text-ink">
      <Navbar currentPath="/concurso" userRole="PARTICIPANT" />
      <div id="contenido" className="flex-1">
        <PageReveal>{children}</PageReveal>
      </div>
      <Footer />
    </div>
  );
}
