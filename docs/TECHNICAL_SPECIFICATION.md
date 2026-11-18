# Olimpíadas Literarias de SiTeLoCuento — Technical Specification & Architecture Document

**Document Status:** Approved Technical Baseline  
**Companion Document:** `FUNCTIONAL_SPECIFICATION_AGENT.md`  
**Organizer / Writing Club:** SiTeLoCuento  
**Production Domain:** `https://olimpiadas.sitelocuento.com`  
**Staging/Dev Domain:** `https://dev-olimpiadas.sitelocuento.com`  
**Official System Timezone:** `America/Caracas` (UTC-4)

---

## 1. Architecture & Technology Stack Overview

The platform is designed as a **100% Serverless, Zero-Cold-Pause Cloud-Native Architecture** hosted entirely on the **Cloudflare Developer Platform**, ensuring **$0/month operating cost** on free tiers, no database pausing during off-season months, and automatic Git-driven deployments across two isolated environments (`prod` and `dev`).

| Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Full-Stack Framework** | **Next.js (App Router) + TypeScript** (via `@opennextjs/cloudflare`) | Unified frontend and backend API/Server Actions in a single repository with React Server Components. |
| **Styling & UI** | **Tailwind CSS + shadcn/ui + Lucide Icons** | 100% responsive (mobile/tablet/desktop), accessible modals, drag-and-drop / click-to-assign voting UI. |
| **Hosting & Compute** | **Cloudflare Workers / Pages** | Edge execution, native integration with GitHub for automatic deployments (`main` $\rightarrow$ `prod`, `dev` $\rightarrow$ `dev`). |
| **Database** | **Cloudflare D1 (Serverless SQLite)** | Never pauses due to inactivity (unlike Supabase Free). Instant reads/writes, native Cloudflare dashboard table viewer. |
| **ORM & Migrations** | **Drizzle ORM + Drizzle Kit** | Lightweight, type-safe SQL ORM built specifically for Cloudflare D1 and edge runtimes; includes Drizzle Studio for visual DB management. |
| **Authentication** | **Better Auth** (with Drizzle D1 Adapter via `src/lib/auth.ts` and `/api/auth/[...all]`) | Handles Email/Password (with verification `E01` & password reset `E02`), **Google OAuth**, and **Microsoft Entra ID OAuth (`tenant: "common"`)** directly in D1 without per-MAU fees. |
| **Object Storage (Media)** | **Cloudflare R2** | Stores participant profile photos (`avatars/`) and prompt images (`prompts/`). 10 GB/month free with zero egress fees. |
| **Scheduled Tasks (Cron)** | **Cloudflare Cron Triggers** (`*/5 * * * *`) | Runs every 5 minutes inside Cloudflare Workers to evaluate stage transitions, prompt deadlines, missed-prompt disqualifications, and 1-hour reminder emails. |
| **Transactional Email** | **Brevo API** (HTTP REST API via `src/lib/email.ts`) | 300 free emails/day (9,000/month), allowing burst notifications to all participants from `olimpiadas@sitelocuento.com`, with automatic dry-run support while DNS verification is pending. |
| **Text Similarity & Diff** | **`diff` (Myers Diff) + Levenshtein Ratio** | Computes real-time similarity percentage in Stage 3 and renders side-by-side / inline red-green diff views for Administrators in Stage 4. |

---

## 2. Environments, CI/CD & Domain Strategy

### 2.1 GitHub Branching & Automatic Deployment
The GitHub repository is connected directly to Cloudflare:

| Environment | Git Branch | Domain | D1 Database (Name & UUID) | R2 Bucket (Name & Region) | Cron Triggers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Production (`prod`)** | `main` | `olimpiadas.sitelocuento.com` | `olimpiadas-db-prod` (`62d0469d-8c03-42a9-ac45-98b320f85b02`) | `olimpiadas-media-prod` (`WEUR`, Created `2026-11-18`) | Enabled (`*/5 * * * *`) |
| **Development (`dev`)** | `dev` | `dev-olimpiadas.sitelocuento.com` | `olimpiadas-db-dev` (`b03d7071-ddc3-4111-96e1-12c18da7245a`) | `olimpiadas-media-dev` (`WEUR`, Created `2026-11-18`) | Enabled (`*/15 * * * *`) |

- Pushing or merging a commit to `dev` automatically runs database migrations (`drizzle-kit migrate`) against `olimpiadas-db-dev` and deploys the staging build.
- Merging `dev` into `main` automatically runs migrations against `olimpiadas-db-prod` and deploys to production.

### 2.2 Required Environment Variables (`wrangler.jsonc` / Cloudflare Secrets)
- `BETTER_AUTH_SECRET`: Secret key for session signing.
- `BETTER_AUTH_URL`: Base URL (`https://olimpiadas.sitelocuento.com` in prod).
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Google OAuth credentials.
- `MICROSOFT_CLIENT_ID` & `MICROSOFT_CLIENT_SECRET`: Microsoft OAuth credentials.
- `BREVO_API_KEY`: API key for sending transactional emails via Brevo.
- `EMAIL_FROM_ADDRESS`: `olimpiadas@sitelocuento.com`
- `EMAIL_FROM_NAME`: `Olimpíadas Literarias de SiTeLoCuento`
- `SUPERADMIN_INITIAL_EMAIL`: Pre-configured email automatically granted `SUPERADMIN` role on initial seed.

---

## 3. Complete Database Schema (Cloudflare D1 / SQLite via Drizzle ORM)

Implemented in `src/db/schema.ts` (22 SQLite tables in total: 4 authentication tables + 18 contest domain tables). All timestamps are stored in ISO-8601 UTC format (`TEXT` or integer epoch milliseconds) and converted to/from **`America/Caracas` (UTC-4)** via `src/lib/timezone.ts` in business logic and UI presentation.

### 3.1 Users & Authentication Tables (`users`, `sessions`, `accounts`, `verifications`)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- UUID / NanoID
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0, -- Boolean (0 or 1)
  first_name TEXT,
  last_name TEXT,
  country TEXT,
  phone TEXT,
  avatar_url TEXT,
  profile_completed INTEGER NOT NULL DEFAULT 0, -- 1 when first_name, last_name, country, phone are all filled
  role TEXT NOT NULL DEFAULT 'PARTICIPANT', -- 'PARTICIPANT' | 'JURY' | 'ADMIN' | 'SUPERADMIN'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```
*(Standard `sessions`, `accounts`, and `verifications` tables managed by Better Auth link via `user_id -> users.id`).*

---

### 3.2 Static Public Content Table (`site_pages`)
Stores editable content for *Bases del Concurso* and *¿Quiénes somos?*:

```sql
CREATE TABLE site_pages (
  slug TEXT PRIMARY KEY, -- 'bases-del-concurso' | 'quienes-somos'
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  updated_by_id TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL
);
```

---

### 3.3 Contest Editions Table (`editions`)
Stores annual contest configuration, parameters, and official stage timestamps:

```sql
CREATE TABLE editions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL, -- e.g., 'Olimpíadas Literarias de SiTeLoCuento 2026'
  slug TEXT NOT NULL UNIQUE, -- e.g., '2026'
  is_active INTEGER NOT NULL DEFAULT 0, -- Only 1 edition active at a time
  
  -- Writing & Editing Parameters
  min_chars INTEGER NOT NULL DEFAULT 100,
  max_chars INTEGER NOT NULL DEFAULT 3000,
  max_allowed_misses INTEGER NOT NULL DEFAULT 2,
  min_similarity_pct INTEGER NOT NULL DEFAULT 70, -- e.g., 70% minimum similarity in Stage 3
  
  -- Jury Multiplier Brackets (JSON array of { minParticipants, maxParticipants, multiplier })
  jury_brackets_json TEXT NOT NULL, -- Default: [{"min":0,"max":29,"k":5},{"min":30,"max":60,"k":10},{"min":61,"max":100,"k":15},{"min":101,"max":99999,"k":20}]
  
  -- Prompt Package Validation Status
  prompt_package_status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT' | 'PENDING_VALIDATION' | 'ACCEPTED'
  
  -- Stage Schedule (ISO-8601 UTC corresponding to America/Caracas inputs)
  registration_start_at TEXT NOT NULL,
  registration_end_at TEXT NOT NULL,
  writing_start_at TEXT NOT NULL,
  writing_end_at TEXT NOT NULL, -- Matches last prompt's closes_at
  submission_start_at TEXT NOT NULL, -- Must be >= writing_end_at + 48h
  submission_end_at TEXT NOT NULL,
  admin_review_start_at TEXT NOT NULL, -- Must be >= submission_end_at
  admin_review_end_at TEXT NOT NULL,
  voting_start_at TEXT NOT NULL, -- Must be >= admin_review_end_at + 48h
  voting_end_at TEXT NOT NULL,
  jury_start_at TEXT NOT NULL, -- Must be >= voting_end_at
  jury_end_at TEXT NOT NULL,
  
  -- Runtime Stage Flags
  jury_paused_missing_votes INTEGER NOT NULL DEFAULT 0,
  tie_breaker_active INTEGER NOT NULL DEFAULT 0,
  tie_breaker_completed INTEGER NOT NULL DEFAULT 0,
  winners_announced INTEGER NOT NULL DEFAULT 0,
  winners_announced_at TEXT,
  
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

### 3.4 Collaborative Prompt Bank & Edition Prompts (`prompt_bank`, `prompt_bank_votes`, `prompt_bank_comments`, `edition_prompts`, `edition_package_votes`)

```sql
-- Collaborative Bank of Future Prompts
CREATE TABLE prompt_bank (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  media_type TEXT, -- NULL | 'IMAGE' | 'VIDEO'
  media_url TEXT, -- R2 image URL or YouTube/Vimeo embed URL
  status TEXT NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE' | 'ASSIGNED_TO_EDITION' | 'USED'
  assigned_edition_id TEXT REFERENCES editions(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Anonymous Upvote/Downvote on Prompt Bank Items (Reset when prompt is edited)
CREATE TABLE prompt_bank_votes (
  id TEXT PRIMARY KEY,
  prompt_bank_id TEXT NOT NULL REFERENCES prompt_bank(id) ON DELETE CASCADE,
  admin_id TEXT NOT NULL REFERENCES users(id), -- Stored only to enforce 1 vote per admin & reset on edit; NEVER exposed in API/UI
  vote_value INTEGER NOT NULL, -- +1 (Like) or -1 (Dislike)
  UNIQUE(prompt_bank_id, admin_id)
);

-- Visible Comments on Prompt Bank Items
CREATE TABLE prompt_bank_comments (
  id TEXT PRIMARY KEY,
  prompt_bank_id TEXT NOT NULL REFERENCES prompt_bank(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  comment_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Scheduled Official Prompts for a Contest Edition
CREATE TABLE edition_prompts (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  source_prompt_bank_id TEXT REFERENCES prompt_bank(id),
  prompt_number INTEGER NOT NULL, -- 1, 2, 3...
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  media_type TEXT, -- NULL | 'IMAGE' | 'VIDEO'
  media_url TEXT,
  published_at TEXT NOT NULL,
  closes_at TEXT NOT NULL,
  closes_processed INTEGER NOT NULL DEFAULT 0, -- 1 once Cron has evaluated missed submissions for this prompt
  UNIQUE(edition_id, prompt_number)
);

-- Admin Validation Votes on the Superadmin's Edition Prompt Package
CREATE TABLE edition_package_votes (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  admin_id TEXT NOT NULL REFERENCES users(id),
  approved INTEGER NOT NULL, -- 1 (Approve) or 0 (Reject)
  voted_at TEXT NOT NULL,
  UNIQUE(edition_id, admin_id)
);
```

---

### 3.5 Edition Enrollments & Participant Status (`enrollments`)

```sql
CREATE TABLE enrollments (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_rules INTEGER NOT NULL DEFAULT 1,
  
  -- Lifecycle Status
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'DISQUALIFIED'
  disqualification_reason TEXT, -- NULL | 'MAX_MISSES' | 'NO_POSTULATION' | 'MODIFICATION_REJECTED' | 'NO_VOTE' | 'MANUAL_ADMIN'
  disqualified_at TEXT,
  
  -- Progress Counters & References
  misses_count INTEGER NOT NULL DEFAULT 0,
  selected_story_id TEXT, -- Story irreversibly chosen in Stage 3
  postulated_at TEXT, -- Timestamp when user clicked 'Postular definitivamente'
  
  -- 24-Hour Exception Window (Stage 4 Rejection)
  in_correction_window INTEGER NOT NULL DEFAULT 0,
  correction_deadline_at TEXT, -- admin_review_end_at + 24h
  correction_submitted_at TEXT,
  
  has_voted INTEGER NOT NULL DEFAULT 0,
  voted_at TEXT,
  
  enrolled_at TEXT NOT NULL,
  UNIQUE(edition_id, user_id)
);
```

---

### 3.6 Stories & Modification Alerts (`stories`, `story_modification_alerts`, `story_alert_votes`)

```sql
CREATE TABLE stories (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL REFERENCES edition_prompts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  
  -- Stage 2 Original Submission (Preserved untouched once Stage 2 closes)
  original_title TEXT NOT NULL,
  original_body TEXT NOT NULL,
  original_char_count INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  
  -- Stage 3 Selection & Editing
  is_selected_for_postulation INTEGER NOT NULL DEFAULT 0,
  is_postulated INTEGER NOT NULL DEFAULT 0,
  edited_title TEXT,
  edited_body TEXT,
  edited_char_count INTEGER,
  similarity_pct REAL, -- 0.0 to 100.0 compared to original_body
  postulated_at TEXT,
  
  -- Final Scoring & Podium Outcome (Hidden from participants/public)
  participant_points INTEGER NOT NULL DEFAULT 0,
  passed_to_jury INTEGER NOT NULL DEFAULT 0, -- 1 if in Top 10 + ties
  jury_points INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  tie_breaker_rank INTEGER, -- Used if resolved via Stage 6b
  podium_place INTEGER, -- NULL | 1 | 2 | 3
  
  updated_at TEXT NOT NULL,
  UNIQUE(enrollment_id, prompt_id)
);

-- Excessive Modification Alerts (Stage 4)
CREATE TABLE story_modification_alerts (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1, -- 1 = Initial Admin Review, 2 = Post-24h Correction Review
  triggered_by_admin_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE(story_id, round)
);

CREATE TABLE story_alert_votes (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES story_modification_alerts(id) ON DELETE CASCADE,
  admin_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL, -- 'VALIDATE' | 'REJECT'
  voted_at TEXT NOT NULL,
  UNIQUE(alert_id, admin_id)
);
```

---

### 3.7 Reading Progress, Pre-selection & Voting (`story_reads_preselections`, `votes`, `tie_breaker_configs`, `tie_breaker_votes`)

```sql
-- Tracks 'Leído' and 'Preseleccionado' per voter (Participant or Juror)
CREATE TABLE story_reads_preselections (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_preselected INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(voter_id, story_id)
);

-- Definitive Top 3 Votes (Stage 5 Participants & Stage 6 Jury)
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL REFERENCES users(id),
  voter_role TEXT NOT NULL, -- 'PARTICIPANT' | 'JURY'
  first_place_story_id TEXT NOT NULL REFERENCES stories(id),
  second_place_story_id TEXT NOT NULL REFERENCES stories(id),
  third_place_story_id TEXT NOT NULL REFERENCES stories(id),
  first_place_points INTEGER NOT NULL, -- 3 for participant; 3*K for jury
  second_place_points INTEGER NOT NULL, -- 2 for participant; 2*K for jury
  third_place_points INTEGER NOT NULL, -- 1 for participant; 1*K for jury
  created_at TEXT NOT NULL,
  UNIQUE(edition_id, voter_id, voter_role)
);

-- Conditional Stage 6b: Jury Tie-Breaker
CREATE TABLE tie_breaker_rounds (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1, -- Increments if a 3+ way tie requires a follow-up binary tie-breaker
  tied_positions TEXT NOT NULL, -- e.g., '1_2', '2_3', '3_ONLY', '1_2_3'
  tied_story_ids_json TEXT NOT NULL, -- JSON array of story IDs in the tie
  is_resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE tie_breaker_votes (
  id TEXT PRIMARY KEY,
  tie_breaker_round_id TEXT NOT NULL REFERENCES tie_breaker_rounds(id) ON DELETE CASCADE,
  juror_id TEXT NOT NULL REFERENCES users(id),
  first_choice_story_id TEXT NOT NULL REFERENCES stories(id),
  second_choice_story_id TEXT REFERENCES stories(id), -- Used only when >= 3 stories tied
  voted_at TEXT NOT NULL,
  UNIQUE(tie_breaker_round_id, juror_id)
);
```

---

### 3.8 Audit Log & Automated Email System (`audit_logs`, `email_templates`, `email_dispatch_logs`)

```sql
-- Immutable Administrative Action Log
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  edition_id TEXT REFERENCES editions(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL, -- 'DISQUALIFY_USER' | 'REINSTATE_USER' | 'LATE_STORY_UPLOAD' | 'LATE_STORY_EDIT' | 'TRIGGER_MOD_ALERT' | 'VOTE_MOD_ALERT' | 'PROMPT_OVERRIDE' | 'PUBLISH_WINNERS' | 'ROLE_CHANGE'
  target_user_id TEXT REFERENCES users(id),
  target_story_id TEXT REFERENCES stories(id),
  justification TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

-- Editable Email Templates (Managed by Superadmin)
CREATE TABLE email_templates (
  code TEXT PRIMARY KEY, -- 'E01' through 'E26'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_html_template TEXT NOT NULL,
  available_tags_json TEXT NOT NULL, -- JSON array of supported {{TAGS}}
  updated_at TEXT NOT NULL
);

-- Idempotency Log to prevent duplicate scheduled emails
CREATE TABLE email_dispatch_logs (
  id TEXT PRIMARY KEY,
  edition_id TEXT REFERENCES editions(id),
  template_code TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  context_key TEXT NOT NULL, -- e.g., 'prompt_3_1h_reminder' or 'stage_3_start_24h'
  sent_at TEXT NOT NULL,
  UNIQUE(template_code, recipient_user_id, context_key)
);
```

---

## 4. Key Algorithms & Core Business Logic

### 4.1 Text Similarity Calculation (Stage 3 & 4 Anti-Replacement Engine)
To verify that a participant is editing their selected story rather than replacing it with a different story:
1. Normalize both `original_body` and `edited_body` (trim whitespace, collapse multiple spaces/newlines into single spaces).
2. Compute word-level and character-level **Myers Diff** (via the lightweight `diff` npm package).
3. Calculate the **Sørensen–Dice / Levenshtein Similarity Ratio**:
   $$\text{Similarity \%} = \left( \frac{2 \times C_{\text{unchanged}}}{L_{\text{original}} + L_{\text{edited}}} \right) \times 100$$
   where $C_{\text{unchanged}}$ is the number of unchanged characters in the common subsequence, and $L_{\text{original}}, L_{\text{edited}}$ are the character lengths.
4. **Live Client + Server Enforcement:**
   - Computed in real time in the browser as the user types (debounced at 200ms) to show the live similarity badge.
   - Re-verified on the server before saving or postulating; rejected if `similarity_pct < edition.min_similarity_pct`.

### 4.2 Deterministic Per-User Story Randomization (Stage 5 & 6)
To guarantee every voter sees a randomized story order that stays identical across sessions:
- Compute a deterministic hash for each story item: `hash = fnv1a32(voter_id + ":" + story_id)`.
- Sort the story list ascending by `hash`.

### 4.3 Top 10 + Ties Cutoff Algorithm for Jury Selection
Executed automatically when Stage 5 (`voting_end_at`) closes:
1. First, disqualify any `ACTIVE` participant who failed to cast a vote (`has_voted == 0`), setting `status = 'DISQUALIFIED'`, `disqualification_reason = 'NO_VOTE'`, and sending email `E17`.
2. Query all postulated stories belonging to participants whose enrollment `status == 'ACTIVE'`.
3. Group stories by distinct `participant_points` in descending order: $T_1 > T_2 > \dots > T_m$.
4. Initialize `selected_stories = []`.
5. For each score tier $T_i$:
   - Append all stories with `participant_points == T_i` to `selected_stories`.
   - If `selected_stories.length >= 10`, **break**.
6. Mark `passed_to_jury = 1` for all stories in `selected_stories`.

### 4.4 Cron Scheduler Engine (`*/5 * * * *`)
Every 5 minutes, the Cloudflare Worker `scheduled()` handler executes an idempotent state-reconciliation pipeline using `email_dispatch_logs` (`UNIQUE(template_code, recipient_user_id, context_key)`) so no email or transition is ever executed twice:
1. **24h Stage Pre-Reminders:** Checks if `now` is within 24h of `writing_start_at` (`E04`) or `submission_start_at` (`E08`).
2. **Prompt Opening & Closing (Stage 2):**
   - When a prompt reaches `published_at`, marks its linked `prompt_bank` item as `status = 'USED'` and sends `E05` to active participants.
   - Sends `E06` when `closes_at - now <= 60 min` to active participants without a submission for that prompt.
   - When `now >= closes_at` and `closes_processed == 0`, runs a single atomic transaction: evaluates all active enrollments without a story for that prompt, increments `misses_count` (sending warning `E07` if `misses_count == max_allowed_misses`, or marking `DISQUALIFIED` with reason `'MAX_MISSES'` and sending `E17` if `misses_count > max_allowed_misses`), and sets `closes_processed = 1`.
3. **Stage 3 Closing:**
   - Sends `E09` when `submission_end_at - now <= 60 min` to active participants who haven't postulated.
   - At `now >= submission_end_at`, disqualifies active participants with `is_postulated == 0` (`NO_POSTULATION`) and sends `E17`.
4. **Stage 4 Closing & 24h Correction Window:**
   - At `now >= admin_review_end_at`, checks all round-1 `story_modification_alerts` still in `PENDING` (fewer than 2 `VALIDATE` votes): marks alert `REJECTED`, activates `in_correction_window = 1` with `correction_deadline_at = admin_review_end_at + 24h`, and sends `E12` to the participant.
   - At `now >= admin_review_end_at + 24h`, disqualifies any participant in correction window who did not re-submit (`MODIFICATION_REJECTED`, `E17`).
   - At `now >= voting_start_at`, disqualifies any round-2 alert story that did not achieve 2 admin `VALIDATE` votes (`MODIFICATION_REJECTED`, `E17`).
5. **Stage 5 Opening & Closing:**
   - Sends `E14` at `voting_start_at`.
   - Sends `E15` at `voting_end_at - 60 min` to active participants who haven't voted.
   - At `now >= voting_end_at`, disqualifies non-voters (`NO_VOTE`, `E17`) and computes the Jury Top 10+Ties list.
6. **Stage 6 Jury Evaluation:**
   - Sends `E20` at `jury_start_at` to all `JURY` users.
   - Sends `E21` at `jury_end_at - 60 min` to jurors who haven't voted.
   - At `now >= jury_end_at`, if any juror has not voted, sets `jury_paused_missing_votes = 1` and sends `E23` to all Admins/Superadmin.

---

## 5. Implementation Roadmap (Development Phases)

To build and verify the application systematically, development will proceed in **6 modular phases**:

- **Phase 1 — Foundation, Database & Authentication:**
  - Initialize Next.js + OpenNext Cloudflare project, Tailwind CSS, Drizzle ORM, and D1 schema migrations.
  - Configure Better Auth (Email/Password + Verification + Reset + Google OAuth + Microsoft OAuth), auth screens (`/login`, `/registro`, `/recuperar-clave`, `/verificar-correo`), and the mandatory *"Complete Your Profile"* gate (`/completar-perfil` + `/api/profile/complete`).
  - Build Public Pages (*Landing*, *Bases del Concurso*, *¿Quiénes somos?*) and Profile Management (`/perfil`, `/api/profile`, `/api/upload/avatar`, `/api/media/[...key]` for R2 avatar upload & email re-verification).
- **Phase 2 — Superadmin Core & Collaborative Prompt Bank:**
  - Build Role Management, Edition Creator & Stage Date Validator (enforcing sequential order and 48h buffers in `America/Caracas`).
  - Build the Collaborative Prompt Bank (propose with image/video, anonymous 👍/👎 voting, comments, vote reset on edit) and Edition Prompt Package validation workflow.
  - Build the Email Template Editor (`E01`–`E26` with clickable `{{TAG}}` insertion) and Brevo dispatch service.
- **Phase 3 — Stage 1 (Registration) & Stage 2 (Prompt Writing Marathon):**
  - Build Participant Dashboard with the visual stage timeline and dynamic status badge.
  - Build Stage 1 enrollment flow and Stage 2 Prompt Reader + Story Editor (live character counter, min/max validation, local auto-save, <1h countdown, and missed-prompt counter).
- **Phase 4 — Stage 3 (Selection & Editing) & Stage 4 (Admin Review & 24h Window):**
  - Build Stage 3 story list, reader with Previous/Next navigation and prompt modal, irreversible selection, live similarity calculator, and final postulation.
  - Build Stage 4 Admin Story Reader, side-by-side/inline visual Diff Viewer, Excessive Modification Alert queue, 2-admin validation voting, and the 24h participant correction window.
- **Phase 5 — Stage 5 (Participant Voting) & Stage 6 (Jury & Tie-Breaker):**
  - Build deterministic randomized story list, *"Leído"* and *"Preseleccionar"* toggles, and the interactive click/drag Top 3 voting screen.
  - Implement Top 10 + Ties cutoff algorithm, automatic Jury point multiplier brackets, pause-on-missing-juror logic, and conditional Jury Tie-Breaker round.
- **Phase 6 — Stage 7 (Winners Announcement), Admin Interventions, Statistics & Cron Engine:**
  - Build manual Winners Announcement trigger, Public Winners Page, and Chronological Edition Stories / Past Editions Archive.
  - Build Admin Real-Time Statistics Dashboard, Participant Intervention tools (manual disqualify/reinstate, late story upload with auto-reactivation), Audit Log viewer, and Cloudflare Cron Trigger integration.
