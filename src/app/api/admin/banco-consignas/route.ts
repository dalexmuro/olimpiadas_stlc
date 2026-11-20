/**
 * Collaborative Prompt Bank API Route (/api/admin/banco-consignas)
 * Step 2.4: GET available prompt proposals (with anonymous vote totals & visible comments),
 * POST new proposal, PATCH edit proposal (resets votes to zero).
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDbClient } from "@/db";
import {
  promptBank,
  promptBankComments,
  promptBankVotes,
  users,
  type MediaType,
} from "@/db/schema";
import { canAccessAdminPanel } from "@/lib/admin-access";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  aggregateAnonymousPromptVotes,
  createPromptProposalInDb,
  editPromptProposalInDb,
} from "@/lib/prompt-bank";

async function requireAdminContext(request: Request) {
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
  const ctx = await requireAdminContext(request);
  if (!ctx.ok) return ctx.errorResponse;

  const [prompts, allVotes, allComments, allUsers] = await Promise.all([
    ctx.db
      .select()
      .from(promptBank)
      .where(eq(promptBank.status, "AVAILABLE")),
    ctx.db.select().from(promptBankVotes),
    ctx.db.select().from(promptBankComments),
    ctx.db.select().from(users),
  ]);

  const userNameMap = new Map<string, string>();
  for (const u of allUsers) {
    const label =
      u.firstName || u.lastName
        ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
        : u.name ?? u.email;
    userNameMap.set(u.id, label);
  }

  const items = prompts.map((p) => {
    const promptVotes = allVotes.filter((v) => v.promptBankId === p.id);
    const voteSummary = aggregateAnonymousPromptVotes(
      promptVotes,
      ctx.actor.id
    );
    const comments = allComments
      .filter((c) => c.promptBankId === p.id)
      .map((c) => ({
        id: c.id,
        authorName: userNameMap.get(c.authorId) ?? "Administrador",
        commentText: c.commentText,
        createdAt: c.createdAt,
      }));

    return {
      id: p.id,
      authorId: p.authorId,
      authorName: userNameMap.get(p.authorId) ?? "Administrador",
      canEdit:
        p.authorId === ctx.actor.id || ctx.actor.role === "SUPERADMIN",
      title: p.title,
      body: p.body,
      mediaType: p.mediaType,
      mediaUrl: p.mediaUrl,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      likes: voteSummary.likes,
      dislikes: voteSummary.dislikes,
      currentAdminVote: voteSummary.currentAdminVote,
      comments,
    };
  });

  return NextResponse.json({ ok: true, prompts: items });
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireAdminContext(request);
  if (!ctx.ok) return ctx.errorResponse;

  const body = (await request.json()) as {
    title?: string;
    body?: string;
    mediaType?: MediaType | null;
    mediaUrl?: string | null;
  };

  const result = await createPromptProposalInDb(ctx.db, {
    authorId: ctx.actor.id,
    input: {
      title: String(body.title ?? ""),
      body: String(body.body ?? ""),
      mediaType: body.mediaType ?? null,
      mediaUrl: body.mediaUrl ?? null,
    },
  });

  if (!result.created) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { ok: true, promptId: result.promptId },
    { status: 201 }
  );
}

export async function PATCH(request: Request): Promise<Response> {
  const ctx = await requireAdminContext(request);
  if (!ctx.ok) return ctx.errorResponse;

  const body = (await request.json()) as {
    promptId?: string;
    title?: string;
    body?: string;
    mediaType?: MediaType | null;
    mediaUrl?: string | null;
  };

  const result = await editPromptProposalInDb(ctx.db, {
    promptId: String(body.promptId ?? ""),
    editorId: ctx.actor.id,
    editorRole: ctx.actor.role,
    input: {
      title: String(body.title ?? ""),
      body: String(body.body ?? ""),
      mediaType: body.mediaType ?? null,
      mediaUrl: body.mediaUrl ?? null,
    },
  });

  if (!result.updated) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, votesReset: result.votesReset });
}
