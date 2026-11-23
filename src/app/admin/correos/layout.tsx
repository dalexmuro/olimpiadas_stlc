import type { ReactNode } from "react";
import { requireSuperadminOrRedirect } from "@/lib/admin-session";

export default async function SuperadminCorreosLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireSuperadminOrRedirect();
  return <>{children}</>;
}
