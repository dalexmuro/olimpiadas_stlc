/**
 * Complete Database Schema for "Olimpíadas Literarias de SiTeLoCuento"
 * Step 1.5: Drizzle ORM SQLite / Cloudflare D1 Schema Definition
 */

import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
   type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

export const SCHEMA_DIALECT = "sqlite" as const;

// ============================================================================
// Domain Enumerations & Constants
// ============================================================================

export const USER_ROLES = [
  "PARTICIPANT",
  "JURY",
  "ADMIN",
  "SUPERADMIN",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROMPT_PACKAGE_STATUSES = [
  "DRAFT",
  "PENDING_VALIDATION",
  "ACCEPTED",
] as const;
export type PromptPackageStatus = (typeof PROMPT_PACKAGE_STATUSES)[number];

export const PROMPT_BANK_STATUSES = [
  "AVAILABLE",
  "ASSIGNED_TO_EDITION",
  "USED",
] as const;
export type PromptBankStatus = (typeof PROMPT_BANK_STATUSES)[number];

export const MEDIA_TYPES = ["IMAGE", "VIDEO"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const ENROLLMENT_STATUSES = ["ACTIVE", "DISQUALIFIED"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const DISQUALIFICATION_REASONS = [
  "MAX_MISSES",
  "NO_POSTULATION",
  "MODIFICATION_REJECTED",
  "NO_VOTE",
  "MANUAL_ADMIN",
] as const;
export type DisqualificationReason = (typeof DISQUALIFICATION_REASONS)[number];

export const ALERT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_DECISIONS = ["VALIDATE", "REJECT"] as const;
export type AlertDecision = (typeof ALERT_DECISIONS)[number];

export const VOTER_ROLES = ["PARTICIPANT", "JURY"] as const;
export type VoterRole = (typeof VOTER_ROLES)[number];

export const AUDIT_ACTION_TYPES = [
  "DISQUALIFY_USER",
  "REINSTATE_USER",
  "LATE_STORY_UPLOAD",
  "LATE_STORY_EDIT",
  "TRIGGER_MOD_ALERT",
  "VOTE_MOD_ALERT",
  "PROMPT_OVERRIDE",
  "PUBLISH_WINNERS",
  "ROLE_CHANGE",
] as const;
export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number];

export const DEFAULT_JURY_BRACKETS_JSON = JSON.stringify([
  { min: 0, max: 29, k: 5 },
  { min: 30, max: 60, k: 10 },
  { min: 61, max: 100, k: 15 },
  { min: 101, max: 99999, k: 20 },
]);

// ============================================================================
// 1. Users & Authentication Tables (users, sessions, accounts, verifications)
// ============================================================================

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    country: text("country"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    profileCompleted: integer("profile_completed", { mode: "boolean" })
      .notNull()
      .default(false),
    role: text("role", { enum: USER_ROLES }).notNull().default("PARTICIPANT"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)]
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: text("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("sessions_token_unique").on(table.token)]
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: text("access_token_expires_at"),
    refreshTokenExpiresAt: text("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("accounts_provider_account_unique").on(
      table.providerId,
      table.accountId
    ),
  ]
);

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ============================================================================
// 2. Static Public Content Table (site_pages)
// ============================================================================

export const sitePages = sqliteTable("site_pages", {
  slug: text("slug").primaryKey(), // 'bases-del-concurso' | 'quienes-somos'
  title: text("title").notNull(),
  contentHtml: text("content_html").notNull(),
  updatedById: text("updated_by_id").references(() => users.id),
  updatedAt: text("updated_at").notNull(),
});

// ============================================================================
// 3. Contest Editions Table (editions)
// ============================================================================

export const editions = sqliteTable(
  "editions",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(false),

    // Writing & Editing Parameters
    minChars: integer("min_chars").notNull().default(100),
    maxChars: integer("max_chars").notNull().default(3000),
    maxAllowedMisses: integer("max_allowed_misses").notNull().default(2),
    minSimilarityPct: integer("min_similarity_pct").notNull().default(70),

    // Jury Multiplier Brackets JSON
    juryBracketsJson: text("jury_brackets_json")
      .notNull()
      .default(DEFAULT_JURY_BRACKETS_JSON),

    // Prompt Package Validation Status
    promptPackageStatus: text("prompt_package_status", {
      enum: PROMPT_PACKAGE_STATUSES,
    })
      .notNull()
      .default("DRAFT"),

    // Stage Schedule (ISO-8601 UTC corresponding to America/Caracas inputs)
    registrationStartAt: text("registration_start_at").notNull(),
    registrationEndAt: text("registration_end_at").notNull(),
    writingStartAt: text("writing_start_at").notNull(),
    writingEndAt: text("writing_end_at").notNull(),
    submissionStartAt: text("submission_start_at").notNull(),
    submissionEndAt: text("submission_end_at").notNull(),
    adminReviewStartAt: text("admin_review_start_at").notNull(),
    adminReviewEndAt: text("admin_review_end_at").notNull(),
    votingStartAt: text("voting_start_at").notNull(),
    votingEndAt: text("voting_end_at").notNull(),
    juryStartAt: text("jury_start_at").notNull(),
    juryEndAt: text("jury_end_at").notNull(),

    // Runtime Stage Flags
    juryPausedMissingVotes: integer("jury_paused_missing_votes", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    tieBreakerActive: integer("tie_breaker_active", { mode: "boolean" })
      .notNull()
      .default(false),
    tieBreakerCompleted: integer("tie_breaker_completed", { mode: "boolean" })
      .notNull()
      .default(false),
    winnersAnnounced: integer("winners_announced", { mode: "boolean" })
      .notNull()
      .default(false),
    winnersAnnouncedAt: text("winners_announced_at"),

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("editions_slug_unique").on(table.slug)]
);

// ============================================================================
// 4. Collaborative Prompt Bank & Edition Prompts
// ============================================================================

export const promptBank = sqliteTable("prompt_bank", {
  id: text("id").primaryKey(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  mediaType: text("media_type", { enum: MEDIA_TYPES }),
  mediaUrl: text("media_url"),
  status: text("status", { enum: PROMPT_BANK_STATUSES })
    .notNull()
    .default("AVAILABLE"),
  assignedEditionId: text("assigned_edition_id").references(() => editions.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const promptBankVotes = sqliteTable(
  "prompt_bank_votes",
  {
    id: text("id").primaryKey(),
    promptBankId: text("prompt_bank_id")
      .notNull()
      .references(() => promptBank.id, { onDelete: "cascade" }),
    adminId: text("admin_id")
      .notNull()
      .references(() => users.id),
    voteValue: integer("vote_value").notNull(), // +1 (Like) or -1 (Dislike)
  },
  (table) => [
    uniqueIndex("prompt_bank_votes_prompt_admin_unique").on(
      table.promptBankId,
      table.adminId
    ),
  ]
);

export const promptBankComments = sqliteTable("prompt_bank_comments", {
  id: text("id").primaryKey(),
  promptBankId: text("prompt_bank_id")
    .notNull()
    .references(() => promptBank.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  commentText: text("comment_text").notNull(),
  createdAt: text("created_at").notNull(),
});

export const editionPrompts = sqliteTable(
  "edition_prompts",
  {
    id: text("id").primaryKey(),
    editionId: text("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    sourcePromptBankId: text("source_prompt_bank_id").references(
      () => promptBank.id
    ),
    promptNumber: integer("prompt_number").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    mediaType: text("media_type", { enum: MEDIA_TYPES }),
    mediaUrl: text("media_url"),
    publishedAt: text("published_at").notNull(),
    closesAt: text("closes_at").notNull(),
    closesProcessed: integer("closes_processed", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    uniqueIndex("edition_prompts_edition_number_unique").on(
      table.editionId,
      table.promptNumber
    ),
  ]
);

export const editionPackageVotes = sqliteTable(
  "edition_package_votes",
  {
    id: text("id").primaryKey(),
    editionId: text("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    adminId: text("admin_id")
      .notNull()
      .references(() => users.id),
    approved: integer("approved", { mode: "boolean" }).notNull(),
    votedAt: text("voted_at").notNull(),
  },
  (table) => [
    uniqueIndex("edition_package_votes_edition_admin_unique").on(
      table.editionId,
      table.adminId
    ),
  ]
);

// ============================================================================
// 5. Edition Enrollments & Participant Status (enrollments)
// ============================================================================

export const enrollments = sqliteTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    editionId: text("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acceptedRules: integer("accepted_rules", { mode: "boolean" })
      .notNull()
      .default(true),

    // Lifecycle Status
    status: text("status", { enum: ENROLLMENT_STATUSES })
      .notNull()
      .default("ACTIVE"),
    disqualificationReason: text("disqualification_reason", {
      enum: DISQUALIFICATION_REASONS,
    }),
    disqualifiedAt: text("disqualified_at"),

    // Progress Counters & References
    missesCount: integer("misses_count").notNull().default(0),
    selectedStoryId: text("selected_story_id"),
    postulatedAt: text("postulated_at"),

    // 24-Hour Exception Window (Stage 4 Rejection)
    inCorrectionWindow: integer("in_correction_window", { mode: "boolean" })
      .notNull()
      .default(false),
    correctionDeadlineAt: text("correction_deadline_at"),
    correctionSubmittedAt: text("correction_submitted_at"),

    hasVoted: integer("has_voted", { mode: "boolean" })
      .notNull()
      .default(false),
    votedAt: text("voted_at"),

    enrolledAt: text("enrolled_at").notNull(),
  },
  (table) => [
    uniqueIndex("enrollments_edition_user_unique").on(
      table.editionId,
      table.userId
    ),
  ]
);

// ============================================================================
// 6. Stories & Modification Alerts (stories, story_modification_alerts, story_alert_votes)
// ============================================================================

export const stories = sqliteTable(
  "stories",
  {
    id: text("id").primaryKey(),
    editionId: text("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references((): AnySQLiteColumn => enrollments.id, {
        onDelete: "cascade",
      }),
    promptId: text("prompt_id")
      .notNull()
      .references(() => editionPrompts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),

    // Stage 2 Original Submission
    originalTitle: text("original_title").notNull(),
    originalBody: text("original_body").notNull(),
    originalCharCount: integer("original_char_count").notNull(),
    submittedAt: text("submitted_at").notNull(),

    // Stage 3 Selection & Editing
    isSelectedForPostulation: integer("is_selected_for_postulation", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    isPostulated: integer("is_postulated", { mode: "boolean" })
      .notNull()
      .default(false),
    editedTitle: text("edited_title"),
    editedBody: text("edited_body"),
    editedCharCount: integer("edited_char_count"),
    similarityPct: real("similarity_pct"),
    postulatedAt: text("postulated_at"),

    // Final Scoring & Podium Outcome (Hidden from participants/public/jury)
    participantPoints: integer("participant_points").notNull().default(0),
    passedToJury: integer("passed_to_jury", { mode: "boolean" })
      .notNull()
      .default(false),
    juryPoints: integer("jury_points").notNull().default(0),
    totalPoints: integer("total_points").notNull().default(0),
    tieBreakerRank: integer("tie_breaker_rank"),
    podiumPlace: integer("podium_place"), // NULL | 1 | 2 | 3

    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("stories_enrollment_prompt_unique").on(
      table.enrollmentId,
      table.promptId
    ),
  ]
);

export const storyModificationAlerts = sqliteTable(
  "story_modification_alerts",
  {
    id: text("id").primaryKey(),
    storyId: text("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    round: integer("round").notNull().default(1), // 1 = Initial Admin Review, 2 = Post-24h Correction Review
    triggeredByAdminId: text("triggered_by_admin_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ALERT_STATUSES })
      .notNull()
      .default("PENDING"),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    uniqueIndex("story_mod_alerts_story_round_unique").on(
      table.storyId,
      table.round
    ),
  ]
);

export const storyAlertVotes = sqliteTable(
  "story_alert_votes",
  {
    id: text("id").primaryKey(),
    alertId: text("alert_id")
      .notNull()
      .references(() => storyModificationAlerts.id, { onDelete: "cascade" }),
    adminId: text("admin_id")
      .notNull()
      .references(() => users.id),
    decision: text("decision", { enum: ALERT_DECISIONS }).notNull(),
    votedAt: text("voted_at").notNull(),
  },
  (table) => [
    uniqueIndex("story_alert_votes_alert_admin_unique").on(
      table.alertId,
      table.adminId
    ),
  ]
);

// ============================================================================
// 7. Reading Progress, Pre-selection & Voting
// ============================================================================

export const storyReadsPreselections = sqliteTable(
  "story_reads_preselections",
  {
    id: text("id").primaryKey(),
    editionId: text("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    voterId: text("voter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storyId: text("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    isPreselected: integer("is_preselected", { mode: "boolean" })
      .notNull()
      .default(false),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("story_reads_preselections_voter_story_unique").on(
      table.voterId,
      table.storyId
    ),
  ]
);

export const votes = sqliteTable(
  "votes",
  {
    id: text("id").primaryKey(),
    editionId: text("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    voterId: text("voter_id")
      .notNull()
      .references(() => users.id),
    voterRole: text("voter_role", { enum: VOTER_ROLES }).notNull(),
    firstPlaceStoryId: text("first_place_story_id")
      .notNull()
      .references(() => stories.id),
    secondPlaceStoryId: text("second_place_story_id")
      .notNull()
      .references(() => stories.id),
    thirdPlaceStoryId: text("third_place_story_id")
      .notNull()
      .references(() => stories.id),
    firstPlacePoints: integer("first_place_points").notNull(),
    secondPlacePoints: integer("second_place_points").notNull(),
    thirdPlacePoints: integer("third_place_points").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("votes_edition_voter_role_unique").on(
      table.editionId,
      table.voterId,
      table.voterRole
    ),
  ]
);

export const tieBreakerRounds = sqliteTable("tie_breaker_rounds", {
  id: text("id").primaryKey(),
  editionId: text("edition_id")
    .notNull()
    .references(() => editions.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull().default(1),
  tiedPositions: text("tied_positions").notNull(), // '1_2', '2_3', '3_ONLY', '1_2_3'
  tiedStoryIdsJson: text("tied_story_ids_json").notNull(),
  isResolved: integer("is_resolved", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const tieBreakerVotes = sqliteTable(
  "tie_breaker_votes",
  {
    id: text("id").primaryKey(),
    tieBreakerRoundId: text("tie_breaker_round_id")
      .notNull()
      .references(() => tieBreakerRounds.id, { onDelete: "cascade" }),
    jurorId: text("juror_id")
      .notNull()
      .references(() => users.id),
    firstChoiceStoryId: text("first_choice_story_id")
      .notNull()
      .references(() => stories.id),
    secondChoiceStoryId: text("second_choice_story_id").references(
      () => stories.id
    ),
    votedAt: text("voted_at").notNull(),
  },
  (table) => [
    uniqueIndex("tie_breaker_votes_round_juror_unique").on(
      table.tieBreakerRoundId,
      table.jurorId
    ),
  ]
);

// ============================================================================
// 8. Audit Log & Automated Email System
// ============================================================================

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  editionId: text("edition_id").references(() => editions.id),
  actorId: text("actor_id")
    .notNull()
    .references(() => users.id),
  actionType: text("action_type", { enum: AUDIT_ACTION_TYPES }).notNull(),
  targetUserId: text("target_user_id").references(() => users.id),
  targetStoryId: text("target_story_id").references(() => stories.id),
  justification: text("justification").notNull(),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull(),
});

export const emailTemplates = sqliteTable("email_templates", {
  code: text("code").primaryKey(), // 'E01' through 'E26'
  name: text("name").notNull(),
  description: text("description").notNull(),
  subjectTemplate: text("subject_template").notNull(),
  bodyHtmlTemplate: text("body_html_template").notNull(),
  availableTagsJson: text("available_tags_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const emailDispatchLogs = sqliteTable(
  "email_dispatch_logs",
  {
    id: text("id").primaryKey(),
    editionId: text("edition_id").references(() => editions.id),
    templateCode: text("template_code").notNull(),
    recipientUserId: text("recipient_user_id").notNull(),
    contextKey: text("context_key").notNull(),
    sentAt: text("sent_at").notNull(),
  },
  (table) => [
    uniqueIndex("email_dispatch_logs_idempotency_unique").on(
      table.templateCode,
      table.recipientUserId,
      table.contextKey
    ),
  ]
);

/**
 * Registry of all database tables for introspection and validation.
 */
export const ALL_SCHEMA_TABLES = {
  users,
  sessions,
  accounts,
  verifications,
  sitePages,
  editions,
  promptBank,
  promptBankVotes,
  promptBankComments,
  editionPrompts,
  editionPackageVotes,
  enrollments,
  stories,
  storyModificationAlerts,
  storyAlertVotes,
  storyReadsPreselections,
  votes,
  tieBreakerRounds,
  tieBreakerVotes,
  auditLogs,
  emailTemplates,
  emailDispatchLogs,
} as const;
