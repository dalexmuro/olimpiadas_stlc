import type { ReactNode } from "react";
import { requireSuperadminOrRedirect } from "@/lib/admin-session";

export default async function SuperadminEdicionesLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireSuperadminOrRedirect();
  return <>{children}</>;
}
