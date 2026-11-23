"use client";

import { AlertTriangle } from "lucide-react";
import type { DisqualificationReason } from "@/db/schema";
import { getDisqualificationReasonLabel } from "@/lib/stage2-writing";

interface DisqualifiedNoticeProps {
  reason: DisqualificationReason | null;
}

export function DisqualifiedNotice({ reason }: DisqualifiedNoticeProps) {
  return (
    <section className="rounded-card border border-error bg-paper-2 p-8">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-1 h-5 w-5 shrink-0 text-error"
          aria-hidden="true"
        />
        <div>
          <h2>Participación descalificada</h2>
          <p className="lead mt-3 text-ink-2">
            {getDisqualificationReasonLabel(reason)}
          </p>
        </div>
      </div>
    </section>
  );
}
