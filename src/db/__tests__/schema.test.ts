import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import {
  ALL_SCHEMA_TABLES,
  AUDIT_ACTION_TYPES,
  DEFAULT_JURY_BRACKETS_JSON,
  DISQUALIFICATION_REASONS,
  USER_ROLES,
  editions,
  editionPrompts,
  emailDispatchLogs,
  enrollments,
  promptBank,
  promptBankVotes,
  stories,
  storyAlertVotes,
  storyModificationAlerts,
  tieBreakerRounds,
  users,
  votes,
} from "../schema";

describe("Step 1.5 — Complete Drizzle D1 Schema Verification", () => {
  it("exports all 22 SQLite tables (4 auth + 18 contest domain tables)", () => {
    const tableKeys = Object.keys(ALL_SCHEMA_TABLES);
    expect(tableKeys).toHaveLength(22);

    const sqlTableNames = Object.values(ALL_SCHEMA_TABLES).map(
      (table) => getTableConfig(table).name
    );

    expect(sqlTableNames).toEqual([
      "users",
      "sessions",
      "accounts",
      "verifications",
      "site_pages",
      "editions",
      "prompt_bank",
      "prompt_bank_votes",
      "prompt_bank_comments",
      "edition_prompts",
      "edition_package_votes",
      "enrollments",
      "stories",
      "story_modification_alerts",
      "story_alert_votes",
      "story_reads_preselections",
      "votes",
      "tie_breaker_rounds",
      "tie_breaker_votes",
      "audit_logs",
      "email_templates",
      "email_dispatch_logs",
    ]);
  });

  it("defines mandatory user profile columns, unique email index, and 4 roles", () => {
    expect(USER_ROLES).toEqual(["PARTICIPANT", "JURY", "ADMIN", "SUPERADMIN"]);

    const usersConfig = getTableConfig(users);
    const columnNames = usersConfig.columns.map((c) => c.name);

    expect(columnNames).toEqual(
      expect.arrayContaining([
        "id",
        "email",
        "email_verified",
        "first_name",
        "last_name",
        "country",
        "phone",
        "avatar_url",
        "profile_completed",
        "role",
      ])
    );
    expect(usersConfig.indexes.map((i) => i.config.name)).toContain(
      "users_email_unique"
    );
  });

  it("defines all contest stage timestamps and parameters on editions", () => {
    const editionsConfig = getTableConfig(editions);
    const colNames = editionsConfig.columns.map((c) => c.name);

    expect(colNames).toEqual(
      expect.arrayContaining([
        "min_chars",
        "max_chars",
        "max_allowed_misses",
        "min_similarity_pct",
        "jury_brackets_json",
        "prompt_package_status",
        "registration_start_at",
        "registration_end_at",
        "writing_start_at",
        "writing_end_at",
        "submission_start_at",
        "submission_end_at",
        "admin_review_start_at",
        "admin_review_end_at",
        "voting_start_at",
        "voting_end_at",
        "jury_start_at",
        "jury_end_at",
        "jury_paused_missing_votes",
        "tie_breaker_active",
        "tie_breaker_completed",
        "winners_announced",
      ])
    );

    const parsedBrackets = JSON.parse(DEFAULT_JURY_BRACKETS_JSON) as Array<{
      min: number;
      max: number;
      k: number;
    }>;
    expect(parsedBrackets).toHaveLength(4);
    expect(parsedBrackets[0].k).toBe(5);
    expect(parsedBrackets[3].k).toBe(20);
  });

  it("enforces unique constraints on prompt bank votes, edition prompts, enrollments, and stories", () => {
    expect(
      getTableConfig(promptBank).columns.map((c) => c.name)
    ).toEqual(
      expect.arrayContaining(["title", "body", "media_type", "media_url", "status"])
    );

    expect(
      getTableConfig(promptBankVotes).indexes.map((i) => i.config.name)
    ).toContain("prompt_bank_votes_prompt_admin_unique");

    const editionPromptsConfig = getTableConfig(editionPrompts);
    expect(editionPromptsConfig.columns.map((c) => c.name)).toContain(
      "closes_processed"
    );
    expect(editionPromptsConfig.indexes.map((i) => i.config.name)).toContain(
      "edition_prompts_edition_number_unique"
    );

    const enrollmentsConfig = getTableConfig(enrollments);
    expect(enrollmentsConfig.indexes.map((i) => i.config.name)).toContain(
      "enrollments_edition_user_unique"
    );
    expect(DISQUALIFICATION_REASONS).toEqual([
      "MAX_MISSES",
      "NO_POSTULATION",
      "MODIFICATION_REJECTED",
      "NO_VOTE",
      "MANUAL_ADMIN",
    ]);

    const storiesConfig = getTableConfig(stories);
    expect(storiesConfig.columns.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "original_title",
        "original_body",
        "edited_title",
        "edited_body",
        "similarity_pct",
        "participant_points",
        "passed_to_jury",
        "jury_points",
        "total_points",
        "podium_place",
      ])
    );
    expect(storiesConfig.indexes.map((i) => i.config.name)).toContain(
      "stories_enrollment_prompt_unique"
    );
  });

  it("enforces unique constraints on modification alerts, votes, tie-breakers, and email idempotency", () => {
    expect(
      getTableConfig(storyModificationAlerts).indexes.map((i) => i.config.name)
    ).toContain("story_mod_alerts_story_round_unique");

    expect(
      getTableConfig(storyAlertVotes).indexes.map((i) => i.config.name)
    ).toContain("story_alert_votes_alert_admin_unique");

    expect(getTableConfig(votes).indexes.map((i) => i.config.name)).toContain(
      "votes_edition_voter_role_unique"
    );

    expect(
      getTableConfig(tieBreakerRounds).columns.map((c) => c.name)
    ).toContain("round_number");

    expect(
      getTableConfig(emailDispatchLogs).indexes.map((i) => i.config.name)
    ).toContain("email_dispatch_logs_idempotency_unique");

    expect(AUDIT_ACTION_TYPES).toContain("LATE_STORY_UPLOAD");
    expect(AUDIT_ACTION_TYPES).toContain("PUBLISH_WINNERS");
  });
});
