import type { ReactNode } from "react";

export default function PaginasLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
