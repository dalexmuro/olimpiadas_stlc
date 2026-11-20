/**
 * Edition Prompts API Route (/api/admin/consignas-edicion)
 * Step 2.5: GET active edition prompts + available bank prompts + majority status,
 * POST assign from bank (SUPERADMIN), PATCH superadmin override, DELETE return to bank (SUPERADMIN).
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import {
  editionPackageVotes,
  editionPrompts,
  editions,
  promptBank,
  users,
  type MediaType,
} from "@/db/schema";
import { canAccessAdminPanel, isSuperadmin } from "@/lib/admin-access";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  assignPromptFromBankToEdition,
  evaluatePackageMajority,
  removePromptFromEditionToBank,
  superadminOverrideEditionPrompt,
} from "@/lib/edition-prompts";
import { caracasLocalToUtcIso } from "@/lib/timezone";

async function requireAdminSession(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return {
      ok: false as const,
      errorResponse: NextResponse.json(
        { ok: false, error: "No autenticado." },
        { status: 401 }
      ),
    };
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  const actor = rows[0];
  if (!actor || !canAccessAdminPanel(actor.role)) {
    return {
      ok: false as const,
      errorResponse: NextResponse.json(
        { ok: false, error: "Acceso restringido a administradores." },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, db, actor, cfEnv };
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await requireAdminSession(request);
  if (!ctx.ok) return ctx.errorResponse;

  const activeEditions = await ctx.db
    .select()
    .from(editions)
    .where(eq(editions.isActive, true));
  const activeEdition = activeEditions[0];

  if (!activeEdition) {
    return NextResponse.json({
      ok: true,
      edition: null,
      editionPrompts: [],
      availableBank: [],
      majority: null,
      isSuperadmin: isSuperadmin(ctx.actor.role),
    });
  }

  const [scheduledPrompts, availableBank, pkgVotes, allAdmins] =
    await Promise.all([
      ctx.db
        .select()
        .from(editionPrompts)
        .where(eq(editionPrompts.editionId, activeEdition.id)),
      ctx.db
        .select()
        .from(promptBank)
        .where(eq(promptBank.status, "AVAILABLE")),
      ctx.db
        .select()
        .from(editionPackageVotes)
        .where(eq(editionPackageVotes.editionId, activeEdition.id)),
      ctx.db.select().from(users).where(eq(users.role, "ADMIN")),
    ]);

  const sortedPrompts = [...scheduledPrompts].sort(
    (a, b) => a.promptNumber - b.promptNumber
  );
  const majority = evaluatePackageMajority(pkgVotes, allAdmins.length);
  const myVote = pkgVotes.find((v) => v.adminId === ctx.actor.id);

  return NextResponse.json({
    ok: true,
    edition: {
      id: activeEdition.id,
      title: activeEdition.title,
      promptPackageStatus: activeEdition.promptPackageStatus,
    },
    editionPrompts: sortedPrompts,
    availableBank,
    majority,
    myVoteApproved: myVote ? myVote.approved : null,
    isSuperadmin: isSuperadmin(ctx.actor.role),
  });
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireAdminSession(request);
  if (!ctx.ok) return ctx.errorResponse;

  if (!isSuperadmin(ctx.actor.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Solo el superadministrador puede asignar consignas a la edición.",
      },
      { status: 403 }
    );
  }

  const body = (await request.json()) as {
    editionId?: string;
    promptBankId?: string;
    promptNumber?: number;
    publishedAtCaracas?: string;
    durationHours?: number;
    editedTitle?: string;
    editedBody?: string;
  };

  let publishedAtUtc: string;
  try {
    publishedAtUtc = caracasLocalToUtcIso(String(body.publishedAtCaracas ?? ""));
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Fecha de publicación inválida.",
      },
      { status: 400 }
    );
  }

  const result = await assignPromptFromBankToEdition(ctx.db, {
    editionId: String(body.editionId ?? ""),
    promptBankId: String(body.promptBankId ?? ""),
    promptNumber: Number(body.promptNumber ?? 1),
    publishedAtUtc,
    durationHours: Number(body.durationHours ?? 24),
    editedTitle: body.editedTitle,
    editedBody: body.editedBody,
  });

  if (!result.assigned) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { ok: true, editionPromptId: result.editionPromptId },
    { status: 201 }
  );
}

export async function PATCH(request: Request): Promise<Response> {
  const ctx = await requireAdminSession(request);
  if (!ctx.ok) return ctx.errorResponse;

  if (!isSuperadmin(ctx.actor.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Solo el superadministrador puede modificar consignas oficiales.",
      },
      { status: 403 }
    );
  }

  const body = (await request.json()) as {
    editionPromptId?: string;
    title?: string;
    body?: string;
    mediaType?: MediaType | null;
    mediaUrl?: string | null;
    publishedAtCaracas?: string;
    closesAtCaracas?: string;
    justification?: string;
  };

  const result = await superadminOverrideEditionPrompt(ctx.db, {
    editionPromptId: String(body.editionPromptId ?? ""),
    superadminId: ctx.actor.id,
    title: String(body.title ?? ""),
    body: String(body.body ?? ""),
    mediaType: body.mediaType ?? null,
    mediaUrl: body.mediaUrl ?? null,
    publishedAtUtc: body.publishedAtCaracas
      ? caracasLocalToUtcIso(body.publishedAtCaracas)
      : undefined,
    closesAtUtc: body.closesAtCaracas
      ? caracasLocalToUtcIso(body.closesAtCaracas)
      : undefined,
    justification: String(body.justification ?? ""),
  });

  if (!result.updated) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request): Promise<Response> {
  const ctx = await requireAdminSession(request);
  if (!ctx.ok) return ctx.errorResponse;

  if (!isSuperadmin(ctx.actor.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Solo el superadministrador puede devolver consignas al banco.",
      },
      { status: 403 }
    );
  }

  const body = (await request.json()) as { editionPromptId?: string };
  const result = await removePromptFromEditionToBank(ctx.db, {
    editionPromptId: String(body.editionPromptId ?? ""),
  });

  if (!result.removed) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, returnedToBank: result.returnedToBank });
}
