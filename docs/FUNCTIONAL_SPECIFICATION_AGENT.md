# Olimpíadas Literarias de SiTeLoCuento — Comprehensive Functional Specification (Agent & Developer Reference)

**Document Status:** Approved Functional Baseline (Infrastructure-Agnostic)  
**Target Audience:** AI Agents, Software Architects, and Developers  
**Organizer / Writing Club:** SiTeLoCuento  
**Application Language:** Spanish (100% of UI, system messages, and emails)  
**Responsiveness:** 100% Responsive (Desktop, Tablet, Mobile)  
**Official System Timezone:** `America/Caracas` (UTC-4)

---

## 1. System Overview & Core Concepts

**Olimpíadas Literarias de SiTeLoCuento** is a multi-edition (annual) short-story writing competition web platform organized by the **SiTeLoCuento** writing club.
- **Permanent User Accounts:** Users register an account once on the platform and retain it across years.
- **Annual Editions:** Each year, the Superadministrator creates and configures a new **Contest Edition** (e.g., *Olimpíadas Literarias de SiTeLoCuento 2026*). Registering an account on the website does **not** automatically enroll a user in the current contest edition; users must explicitly enroll during the edition's *Registration Stage*.
- **Timezone Rule:** All contest stage transitions, prompt deadlines, and scheduled reminders are governed by the official timezone (`America/Caracas`, UTC-4).

---

## 2. User Roles & Permissions Matrix

Roles are assigned globally at the **User Profile** level by the Superadministrator and persist across editions until modified by the Superadministrator.

| Role | Can Participate in Contest? | Key Capabilities |
| :--- | :---: | :--- |
| **Participant** (`PARTICIPANT`) | **Yes** | Default role for registered users. Can enroll in the active edition, submit stories to prompts, select & edit 1 story for final submission, read and vote on peers' stories (Top 3), and manage their personal profile. |
| **Jury** (`JURY`) | **No** | Exclusively active during the *Jury Evaluation* and *Jury Tie-Breaker* stages. Reads the Top 10+ (including ties) finalist stories anonymously and votes for 1st, 2nd, and 3rd place. Cannot see participant vote counts. |
| **Contest Administrator** (`ADMIN`) | **No** | Proposes/votes/comments on prompts in the Prompt Bank, validates the Superadmin's edition prompt package, monitors real-time statistics, reads all submitted stories (with author names visible), compares original vs. edited stories, triggers and votes on Excessive Modification Alerts, intervenes on participant statuses (disqualify/reinstate with mandatory justification), submits/edits stories late on behalf of participants, views the Audit Log, and can manually trigger the *Winners Announcement* stage. |
| **Superadministrator** (`SUPERADMIN`) | **No** | Pre-configured root role. Has **all `ADMIN` capabilities** plus: creates/configures Contest Editions, sets stage dates/times, configures edition parameters (min/max characters, max allowed misses, similarity threshold, jury multiplier brackets), assembles and modifies edition prompts at any time, edits automated email templates, edits static public pages (*Contest Rules*, *About Us*), manages user roles (`ADMIN`, `JURY`, `SUPERADMIN`, `PARTICIPANT`), and has full access/export capabilities over database records. |

> **Exclusivity Rule:** Users holding `SUPERADMIN`, `ADMIN`, or `JURY` roles cannot enroll or participate as writers in any contest edition while holding those roles.

---

## 3. Authentication & User Profile Management

### 3.1 Authentication Methods
1. **Email & Password:**
   - Requires **Email Verification** (via verification link/token sent to the user's email) before activation.
   - Includes a **"Forgot Password"** recovery flow via email token.
2. **Social OAuth Providers:**
   - **Google Sign-In**
   - **Microsoft Sign-In**

### 3.2 Mandatory Profile Fields
Every user profile contains the following fields:
- `first_name` (Nombre) — **Mandatory**
- `last_name` (Apellido) — **Mandatory**
- `country` (País de residencia) — **Mandatory**
- `email` (Correo electrónico) — **Mandatory** (Editable by user; changing email requires re-verification)
- `phone` (Número de teléfono) — **Mandatory**
- `avatar_url` (Foto de perfil) — **Optional** (Displayed publicly on the Winners page if the participant wins 1st, 2nd, or 3rd place)
- `password` (Contraseña) — Editable by user

### 3.3 First-Login Profile Completion Gate
- When a user signs up via **Google** or **Microsoft** (which do not provide `country` or `phone`), the system must intercept navigation and redirect the user to a mandatory **"Complete Your Profile"** screen before allowing contest enrollment or dashboard access.

---

## 4. Public Website & Participant Dashboard

### 4.1 Public Navigation & Pages (Accessible Without Login)
- **Home / Landing Page:** Displays the active Contest Edition title, current stage status, call-to-action to Sign In / Create Account, and contest overview.
- **Contest Rules (*Bases del Concurso*):** Editable rich-text page managed by the Superadmin.
- **About Us (*¿Quiénes somos? / Historia del concurso y organizadores*):** Editable rich-text page managed by the Superadmin.
- **Winners Page (*Resultados [Nombre de Edición]*):** Published upon triggering the *Winners Announcement* stage for the latest completed edition.
- **Edition Stories & Past Editions (*Cuentos participantes / Ediciones anteriores*):** Public archive showing all finalist stories from the current completed edition and previous years' editions.

### 4.2 Logged-In Participant Header / Main View
Whenever an authenticated user logs in, they see:
1. **Contest Title:** e.g., *"Olimpíadas Literarias de SiTeLoCuento 2026"*.
2. **Visual Stage Timeline:** Displays all contest stages with their dates:
   - Past stages: Crossed out (strikethrough).
   - Current stage: Highlighted in **bold**.
   - Upcoming stages: Dimmed / muted color.
3. **Participant Status Badge:** Dynamic status indicator for the current user:
   - *No inscrito* (Not enrolled)
   - *Inscrito / Participando* (Enrolled / Participating)
   - *Editando cuento a postular* (Editing story for final submission)
   - *Cuento postulado* (Story submitted for voting)
   - *En revisión por los administradores* (Under admin review / 24h correction window)
   - *Esperando votaciones* (Awaiting voting stage)
   - *Votación enviada* (Vote cast)
   - *Descalificado* (Disqualified)
   - *Concurso finalizado* (Contest ended)
4. **Profile Link:** Direct access to edit personal data, email, password, and profile photo.
5. **Non-Enrolled User Restriction:** If a registered user logs in after the *Registration Stage* has closed and is **not** enrolled in the active edition, they can view/edit their profile, but all participant actions and contest stage interfaces are hidden/unavailable.

---

## 5. Contest Edition Lifecycle & Stage Sequence

### 5.1 Official Sequential Timeline & Validation Rules
When the Superadministrator configures the dates and times (`America/Caracas`) for a Contest Edition, the system must enforce strict sequential ordering with **no overlaps** and two mandatory **48-hour minimum buffers**:

1. **Stage 1: Inscripciones (Registration)**
   - `registration_start_at` < `registration_end_at`
2. **Stage 2: Envío de cuentos (Prompt Writing & Submission)**
   - `writing_start_at` $\ge$ `registration_end_at`
   - Contains $N$ scheduled prompts (`Prompt 1` ... `Prompt N`).
   - Every prompt has `published_at` and `closes_at` (calculated from open duration).
   - Prompts must not overlap: `Prompt[i].closes_at` $\le$ `Prompt[i+1].published_at`.
   - `writing_end_at` = `Prompt[N].closes_at`.
3. **Mandatory Buffer 1 ($\ge 48\text{ hours}$):**
   - `submission_start_at` $\ge$ `writing_end_at` + **48 hours**.
4. **Stage 3: Postulación y Edición (Story Selection, Editing & Final Submission)**
   - `submission_start_at` < `submission_end_at`
5. **Stage 4: Revisión por los administradores (Administrator Review)**
   - `admin_review_start_at` $\ge$ `submission_end_at`
   - `admin_review_start_at` < `admin_review_end_at`
6. **Mandatory Buffer 2 ($\ge 48\text{ hours}$ — Exception/Correction Window):**
   - `voting_start_at` $\ge$ `admin_review_end_at` + **48 hours**.
   - *(Note: The first 24h of this buffer are used for participant re-editing if an Excessive Modification Alert was not validated by admins; the remaining 24h are used for admins to validate the corrected story).*
7. **Stage 5: Votaciones (Participant Voting)**
   - `voting_start_at` < `voting_end_at`
8. **Stage 6: Evaluación del Jurado (Jury Evaluation)**
   - `jury_start_at` $\ge$ `voting_end_at`
   - `jury_start_at` < `jury_end_at` *(Pauses upon completion if any juror has not voted).*
9. **Stage 6b (Conditional): Desempate del Jurado (Jury Tie-Breaker)**
   - Triggered automatically after all jurors vote in Stage 6 if and only if a point tie exists among 1st, 2nd, or 3rd place. Closes automatically as soon as all jurors submit their tie-breaking vote.
10. **Stage 7: Anuncio de Ganadores (Winners Announcement)**
    - **Manual activation only** by an `ADMIN` or `SUPERADMIN` once Jury Evaluation (and any Tie-Breaker) is complete with zero unresolved ties.

> If the Superadmin inputs dates that violate sequential order or the 48-hour minimum buffers, the system must reject the configuration with a clear validation error.

---

## 6. Detailed Specification by Stage

### 6.1 Stage 1: Inscripciones (Registration)
- Authenticated users with complete profiles see an **"Inscribirme al concurso"** button.
- Clicking requires checking an explicit acceptance checkbox for the **Contest Rules (*Bases del Concurso*)**.
- Once enrolled:
  - Status becomes *Inscrito / Participando*.
  - Automated confirmation email is sent.
  - User can view and edit their profile at any time.

---

### 6.2 Stage 2: Envío de cuentos (Prompt Writing & Submission)

#### A. Prompt Structure
- Each prompt has:
  - Sequential number (`Consigna 1`, `Consigna 2`, ...).
  - Title (`titulo`).
  - Description/Body (`texto`).
  - Optional Media: Either an uploaded image OR an embedded video link (YouTube or Vimeo).
  - Open window: `published_at` to `closes_at`.

#### B. Participant Writing Interface
- While a prompt is open, active participants see the current prompt on their main screen with a **"Postular" / "Escribir"** button.
- Clicking opens the **Story Editor**:
  - **Title field:** Plain text (Mandatory, `1` to `150` characters after trimming whitespace).
  - **Story body field:** Plain text only (no rich text formatting).
  - **Real-time Character Counter:** Counts **all characters including spaces** in the story body (excludes the title).
  - **Character Limits Validation:** The Superadmin defines a global `min_chars` and `max_chars` for the edition.
    - If `length < min_chars` or `length > max_chars` (or if the title is empty or exceeds `150` characters), the **"Enviar / Guardar"** button is disabled and an inline error message explains the limit.
  - **Media Limits (Profile Photos & Prompt Media):** Uploaded images (avatars and prompt images) must be `JPG`, `PNG`, or `WEBP` up to `5 MB`. Prompt videos must be valid YouTube or Vimeo URLs, automatically parsed into responsive embedded players.
  - **Local Auto-Save:** The editor automatically saves a local/draft copy while typing so the user does not lose work if their browser closes or disconnects. However, only explicitly submitted/saved versions within the open time window count as official submissions.
  - **Countdown Timer (< 1 hour remaining):** When less than 1 hour remains before `closes_at`, a live countdown timer becomes visible inside the editor.

#### C. Editing & Version Rules During Stage 2
- Participants may submit **at most 1 story per prompt**.
- While the prompt window remains open (`now < closes_at`), the participant can re-enter, read, and edit their submitted story unlimited times.
- No version history is needed during Stage 2; only the **last saved version** before `closes_at` is kept.
- **Expiration while editing:**
  - If `closes_at` is reached and the participant never submitted a story for that prompt, the submission is rejected and counts as **1 miss (falla)**.
  - If the participant had already submitted a story and was editing it when time expired without saving the new edit, the **previously submitted version is preserved**.
- **Visibility restriction:** During Stage 2, participants **cannot** view stories they submitted to previous closed prompts.
- **Between Prompts / After Last Prompt:**
  - Once a prompt closes (or after the user submits and waits for the next), once the window ends:
    - If more prompts remain: Display *"Próxima consigna en:"* + live countdown to `Prompt[next].published_at`.
    - If the last prompt has closed: Display *"El período de recepción de cuentos ha terminado. Inicio de la etapa de selección en:"* + live countdown to `submission_start_at`.

#### D. Missed Prompts (*Fallas*) & Disqualification Rule
- The Superadmin configures `max_allowed_misses` (e.g., `2`).
- This number represents the **maximum number of missed prompts allowed while remaining active**:
  - If `misses_count < max_allowed_misses`: Participant remains active.
  - If `misses_count == max_allowed_misses`: Participant remains active, and receives an automated **Warning Email**: *"Atención, has fallado X veces, si fallas de nuevo serás descalificado"*.
  - If `misses_count > max_allowed_misses`: Participant is immediately **Disqualified (`DESCALIFICADO`)**:
    - Receives an automated Disqualification Email.
    - Sees a disqualification message on their dashboard.
    - Cannot submit to remaining prompts, cannot postulate, and cannot vote.

---

### 6.3 Stage 3: Postulación y Edición (Story Selection, Editing & Final Submission)

#### A. Reading & Navigating Previously Submitted Stories
- When Stage 3 opens, each active participant sees a **List of Their Submitted Stories** from Stage 2.
- The list view shows:
  - Prompt Number (e.g., *Consigna 1*)
  - Story Title
  - *(Story body text is NOT shown directly in the list).*
- Clicking a story opens the **Story Detail View**:
  - Displays: Prompt Number, Story Title, and full Story Body.
  - Includes a button/link **"Leer consigna completa"** (opens a modal/view showing the prompt's full text, image, or embedded YouTube/Vimeo video).
  - Includes **"Anterior" (Previous)** and **"Siguiente" (Next)** navigation buttons to move directly between the participant's stories without returning to the main list, plus a **"Volver a la lista"** button.

#### B. Irreversible Story Selection
- From their stories, the participant must select **one (1) story** to postulate for the contest.
- Selecting a story requires confirming a modal warning that **the selection is irreversible**.
- Once selected:
  - The participant's status changes to *Editando cuento a postular*.
  - A persistent banner reminds the user: *"Tu cuento ha sido seleccionado, pero esta etapa NO está completada hasta que hagas clic en 'Postular definitivamente'"*.

#### C. Editing the Selected Story & Similarity Verification
- Before final postulation, the participant may edit both the **Title** (`1`–`150` chars) and the **Story Body** of the selected story as many times as desired (saving drafts), or leave it 100% identical to the Stage 2 version.
- **Character Limit:** Must strictly respect the exact same `min_chars` and `max_chars` configured for the edition.
- **Dual Version Persistence:**
  - The system preserves `original_title` and `original_body` (from Stage 2) untouched.
  - Upon story selection, `edited_title` and `edited_body` are initialized with `original_title` and `original_body` (`similarity_pct = 100.0`). Subsequent edits update `edited_title` and `edited_body`.
- **Automated Similarity Check (Anti-Replacement Guard):**
  - The Superadmin configures a `min_similarity_percentage` (e.g., `70%`).
  - As the participant edits the body, the system computes a normalized text similarity score between `original_body` and `edited_body` (e.g., character/word-level Levenshtein / Myers diff similarity ratio).
  - The editor displays the similarity indicator. If similarity drops below `min_similarity_percentage`, saving/postulating is blocked with an error message stating that only edits are permitted, not replacing the story.

#### D. Final Postulation
- When ready, the participant clicks **"Postular definitivamente"** and confirms in a modal.
- **Irreversible:** Once postulated, the participant can no longer edit the story.
- Status updates to *Cuento postulado*, and an automated confirmation email is sent.
- **Disqualification on Non-Postulation:** If `submission_end_at` is reached and an active participant has **not** clicked *"Postular definitivamente"* (even if they selected a story and saved drafts), the participant is automatically **Disqualified** and notified via email.

---

### 6.4 Stage 4: Revisión por los administradores (Administrator Review & 48h Buffer)

#### A. Participant View During Stage 4
- Active participants see: *"Los cuentos postulados están siendo revisados por el equipo organizador. La etapa de Votaciones comenzará en [Cuenta regresiva]"*.

#### B. Administrator Review & Diff Comparison
- Administrators can read all postulated stories (with author names visible).
- Each story displays a badge indicating whether it was **Unmodified (`100% original`)** or **Edited (`X% similitud`)**.
- By default, admins view the postulated version (`edited_title`, `edited_body`), with a button **"Comparar con versión original"** that renders a visual diff highlighting additions and deletions against `original_title` and `original_body`.

#### C. Excessive Modification Alert Workflow
1. **Triggering an Alert:** If an Administrator believes an edited postulated story (`similarity_pct < 100%`) was altered excessively (beyond legitimate editing), they click **"Lanzar alerta por exceso de modificaciones"**.
   - The triggering Administrator's action automatically counts as a `REJECT` vote on Round 1, so the alert does not appear as pending in that Administrator's own queue.
2. **Notification & Alert Queue:**
   - All other Administrators receive an email notification (`E11`) that a story requires review.
   - At the top of the Administrators' story list, a dedicated **"Alertas pendientes de tu revisión"** section displays stories flagged with an alert that the logged-in administrator has not yet voted on.
3. **Administrator Voting on the Alert:**
   - Each administrator inspects the visual diff and clicks either **"Validar cambios"** (Approve) or **"Rechazar cambios"** (Reject). Once they vote, the story disappears from their personal pending alert queue.
   - **Immediate Approval Rule:** If **at least 2 Administrators** vote **"Validar cambios"**, the alert is resolved immediately (`status = 'APPROVED'`) and the postulated story is officially **Accepted**.
4. **End-of-Stage Rejection & 24-Hour Participant Correction Window:**
   - If `admin_review_end_at` is reached and a flagged story has **not** obtained at least 2 *"Validar cambios"* votes:
     - The Round 1 alert is marked `REJECTED`, and the story enters a **24-Hour Correction Window** (`in_correction_window = 1`, `correction_deadline_at = admin_review_end_at + 24 hours`, occupying the first 24 hours of the mandatory 48h buffer before *Participant Voting*).
     - The participant receives an urgent automated email (`E12`) stating that the administrators requested a revision of their story and that they have **24 hours** to submit a more faithful edit.
     - When that participant logs in during those 24 hours, their interface exceptionally re-enables the **Postulation Editor** so they can adjust their story and click **"Postular"** again.
5. **Second Administrator Review (Hours 24 to 48 of Buffer):**
   - If the participant fails to re-postulate within their 24-hour window (`now >= admin_review_end_at + 24h`) $\rightarrow$ the story/participant is automatically **Disqualified** (`E17`).
   - When the participant re-postulates within the 24-hour window:
     - The system automatically creates a **Round 2 Alert (`round = 2`, `status = 'PENDING'`)** visible in the **"Alertas pendientes de tu revisión"** queue of **all Administrators** (including the Admin who triggered Round 1).
     - All Administrators receive an email notification (`E13`) that the corrected story has been uploaded and must be validated.
     - During the remaining 24 hours (before `voting_start_at`), Administrators review the new version under the **exact same rule**: at least **2 Administrators** must click **"Validar cambios"**.
     - If `voting_start_at` is reached and the Round 2 alert has not received at least 2 validations $\rightarrow$ the story/participant is automatically **Disqualified** (`E17`).

---

### 6.5 Stage 5: Votaciones (Participant Voting)

#### A. Eligibility & Story List
- Only active participants who successfully postulated a story (and were not disqualified) can vote.
- When an active participant logs in, they see the **List of Postulated Stories**:
  - Displays: **Prompt Number** and **Story Title** only.
  - **Strict Anonymity:** Author names are completely hidden.
  - **Deterministic Per-User Random Order:** The list order is randomized using a deterministic seed per user (e.g., `hash(user_id + edition_id)`), ensuring every participant sees a unique random order that remains consistent every time that same participant logs in.
  - **Participant's Own Story:** Appears in the list so the author sees it is included, but the **"Preseleccionar"** action is disabled on their own story (self-voting is impossible).
  - **List Indicators:** Each story row clearly shows whether the user has marked it as **"Leído" (Read)** and/or **"Preseleccionado" (Pre-selected)**.

#### B. Reading & Pre-Selection Interface
- Clicking a story opens the reader view showing:
  - Prompt Number (with button/link to view the full prompt + image/video).
  - Story Title and Story Body.
  - **"Anterior" / "Siguiente"** buttons (following the user's personalized list order) and **"Volver a la lista"**.
  - **"Marcar como leído"** toggle button (allows participants to track their reading progress across sessions).
  - **"Preseleccionar"** toggle button (disabled for the user's own story). Participants may pre-select as many stories as they wish (minimum 3 required to unlock voting).

#### C. Interactive Top 3 Voting Screen
- Once the participant has pre-selected **at least 3 stories**, the **"Votar"** button on the main screen becomes enabled.
- Clicking **"Votar"** opens an interactive visual selection screen displaying only the user's pre-selected stories.
- **No typing allowed:** Using intuitive click-to-assign buttons or drag-and-drop cards, the user assigns:
  - **1er Lugar (1st Place)** $\rightarrow$ Awards **3 points**
  - **2do Lugar (2nd Place)** $\rightarrow$ Awards **2 points**
  - **3er Lugar (3rd Place)** $\rightarrow$ Awards **1 point**
- Once 1st, 2nd, and 3rd places are assigned, the user clicks **"Enviar voto"**, reviews a confirmation screen/modal warning that **votes are final and cannot be modified**, and confirms.
- After voting:
  - Status updates to *Votación enviada*.
  - Automated confirmation email is sent.
  - The participant can still log in to read stories and view their submitted Top 3 in read-only mode.

#### D. Disqualification for Failing to Vote
- If `voting_end_at` is reached and an active participant has **not** submitted their vote:
  - The participant is automatically **Disqualified** and receives a Disqualification Email.
  - Their own postulated story is **excluded from the competition** (cannot pass to the Jury or win), while the points they may have received or that other stories received remain unchanged.

---

### 6.6 Stage 6: Evaluación del Jurado (Jury Evaluation & Tie-Breaker)

#### A. Selecting the Finalist Stories for the Jury (Top 10 + Ties Cutoff Algorithm)
1. Only stories belonging to participants who remain **Active** after Stage 5 (i.e., not disqualified for failing to vote or manual intervention) are eligible.
2. Rank all eligible stories in descending order by total participant points.
3. Group stories by distinct score tiers from highest to lowest.
4. Iterate through score tiers from 1st place downward, adding all stories in each tier to the **Jury Finalist List**, and **stop as soon as the cumulative number of included stories is $\ge 10$** (or when all eligible stories are included if fewer than 10 exist).
   - *Example:* 1 story in 1st, 2 tied in 2nd, 1 in 3rd, 3 tied in 4th, 6 tied in 5th $\rightarrow$ Cumulative count after adding the 5th-place tier is $1 + 2 + 1 + 3 + 6 = 13 \ge 10$. The Jury sees all **13 stories**, and none from the 6th-place tier downward.

#### B. Jury Interface & Blind Evaluation
- The Superadmin must configure an **odd number of Jurors** (e.g., 3, 5, 7).
- If a Juror logs in before Stage 6 opens, they see a message indicating the Jury Evaluation stage has not started yet.
- When Stage 6 opens:
  - All Jurors receive an automated email notification.
  - Jurors use the exact same reading, *"Leído"* indicator, *"Preseleccionar"*, and interactive Top 3 voting interface as participants.
  - **Blindness Rule:** Jurors see **only** the finalist stories (anonymous, no author names) and **never** see participant vote counts or rankings.
  - Jurors also receive a 1-hour reminder email before `jury_end_at` if they haven't voted, and a confirmation email upon voting.

#### C. Automatic Jury Point Multiplier ($K$) by Active Participant Brackets
Each Juror's vote awards $3 \times K$ points to 1st place, $2 \times K$ points to 2nd place, and $1 \times K$ point to 3rd place, where $K$ is determined automatically based on the number of active participants who reached the Voting Stage (configurable bracket table by Superadmin):
- Default Brackets:
  - $< 30$ participants $\rightarrow K = 5$ (**15, 10, 5 pts**)
  - $30 - 60$ participants $\rightarrow K = 10$ (**30, 20, 10 pts**)
  - $61 - 100$ participants $\rightarrow K = 15$ (**45, 30, 15 pts**)
  - $> 100$ participants $\rightarrow K = 20$ (**60, 40, 20 pts**)
- **Total Final Score per Story:** $\text{Total Points} = \text{Participant Points} + \text{Jury Points}$.

#### D. Pause on Missing Juror Vote
- If `jury_end_at` is reached and one or more Jurors have **not** submitted their vote:
  - The stage **does not close**; it enters a **Paused / Awaiting Missing Juror** state.
  - All Administrators and the Superadmin receive an urgent notification indicating which Juror(s) have not voted yet.
  - Once the remaining Juror(s) cast their vote, the stage completes automatically.

#### E. Conditional Sub-Stage 6b: Desempate del Jurado (Jury Tie-Breaker)
- Immediately after all Jurors have voted in Stage 6, the system checks the top 3 podium positions (1st, 2nd, and 3rd place) by Total Points.
- If a tie exists that prevents uniquely determining 1st, 2nd, and 3rd place:
  - The system automatically opens the **Jury Tie-Breaker Stage** and emails all Jurors (`E24`).
  - Jurors see **only the tied stories** (anonymous, no scores displayed) and select their preferred order among them according to the tie scenario:
    - **Case 1 (2 stories tied for 1st & 2nd, or 2 stories tied for 2nd & 3rd, or $\ge 2$ stories tied for 3rd place only):** Each Juror selects their **1 preferred story**. Because the number of Jurors is odd, a strict majority resolves 2-way ties automatically.
    - **Case 2 (3 or more stories tied across 1st/2nd/3rd or 1st/2nd):** Each Juror votes for **1st choice (2 pts)** and **2nd choice (1 pt)** among the tied stories. If this multi-story tie-breaker produces a subsequent tie between two stories, the system automatically opens a binary follow-up tie-breaker round between those two stories (which is guaranteed to resolve due to the odd number of Jurors).
  - The Tie-Breaker stage closes automatically as soon as **all Jurors** have submitted their tie-breaking vote and 1st, 2nd, and 3rd places are uniquely determined.

---

### 6.7 Stage 7: Anuncio de Ganadores (Winners Announcement)

#### A. Manual Activation
- Once all Jurors have voted and no ties remain in 1st, 2nd, or 3rd place, a button **"Publicar y Anunciar Ganadores"** becomes enabled for `ADMIN` and `SUPERADMIN` users.

#### B. Actions Triggered Upon Activation
1. **Public Page 1 — Winners Page (*Resultados [Nombre de Edición]*):**
   - Added to the main public navigation menu.
   - Displays the **3 Winning Stories (1st, 2nd, and 3rd Place)**.
   - Each winner card shows:
     - Podium Badge (1er Lugar, 2do Lugar, 3er Lugar).
     - **Author's Profile Photo** (`avatar_url`), **Author's Full Name**, and **Story Title** (as a clickable link).
     - Clicking the Story Title opens the full story page showing: Prompt Number, button to view the full inspiring Prompt, Author's Full Name, Story Title, and full Story Body.
   - Includes a prominent link/button to the **"Cuentos participantes"** page of the edition.
2. **Public Page 2 — All Edition Stories & Past Editions Archive (*Cuentos participantes / Ediciones anteriores*):**
   - Added to the main public navigation menu.
   - Lists **all stories that reached the end of the edition** (excluding disqualified stories).
   - **Ordering:** Strictly ordered by **Prompt Number** (Consigna 1, Consigna 2, ...) and **chronological order of submission** within each prompt. Winning stories are **not** moved to the top; they appear in their chronological position with a **Winner Badge (1er, 2do, or 3er Lugar)** next to them.
   - **Author Names Visible:** Shows Prompt Number, Story Title, Author's Full Name, and Winner Badge (if applicable). Clicking opens the full story and prompt.
   - **Scores Hidden:** Point totals and non-podium rankings are **never** shown to the public, participants, or the Jury (point totals are visible **exclusively** to `ADMIN` and `SUPERADMIN`).
3. **Participant Dashboard Update:**
   - Every participant sees a closing message thanking them for participating, with a direct link to the public Winners Page (no personal score or rank is displayed).
4. **Global Broadcast Email:**
   - The system sends the Winners Announcement Email (containing the direct link to the public Winners Page) to **all enrolled participants of that edition (including disqualified participants), all Jurors, all Administrators, and the Superadministrator**.

---

## 7. Administrator & Superadministrator Capabilities

### 7.1 Collaborative Prompt Bank (*Banco de Consignas*)
Available at all times to `ADMIN` and `SUPERADMIN`:
- **Propose New Prompt:** Create a future prompt with Title, Full Text, and optional Image or YouTube/Vimeo Video. The creator's name is visible to other admins.
- **Anonymous Upvote / Downvote (👍 / 👎):** Admins can vote *Like* (👍) or *Dislike* (👎) on any proposed prompt. Votes are **100% anonymous**, and the aggregate count of 👍 and 👎 is displayed on each prompt.
- **Comments:** Admins can post comments on any proposed prompt (comment author name is visible).
- **Edit Proposed Prompt:** The author (or Superadmin) can edit a proposed prompt in the bank. **Rule:** Editing a prompt in the bank **resets its 👍 / 👎 vote counts to zero**.

### 7.2 Edition Prompt Package Proposal & Approval Workflow
1. **Assembling the Edition Prompts:** The `SUPERADMIN` selects prompts from the Prompt Bank to build the current edition's prompt schedule (and may edit a prompt before adding it).
   - While a prompt is assigned to an edition proposal (`status = 'ASSIGNED_TO_EDITION'`), it is removed from the available Prompt Bank (`status = 'AVAILABLE'`).
   - If removed from the edition proposal before it is published in Stage 2, its status reverts to `'AVAILABLE'` and it returns to the Prompt Bank.
   - Once a prompt reaches its `published_at` timestamp during Stage 2, its status in the Prompt Bank permanently becomes `'USED'` so it cannot be reused in future editions.
2. **Submitting Package for Admin Validation:** Once the `SUPERADMIN` finishes assembling the edition's prompts, they submit the package for validation:
   - All `ADMIN` users receive an email notification to review and vote (**Approve** or **Reject**) on the proposed prompt package.
   - Once a **majority of Administrators** validate the package, its status becomes **Accepted**.
3. **Superadmin Override:** Regardless of validation status or even after the contest has started, the `SUPERADMIN` retains full authority to modify any prompt or schedule at any time.

### 7.3 Real-Time Statistics Dashboard (`ADMIN` & `SUPERADMIN`)
Displays live metrics for the active edition:
- **Registration & Funnel Metrics:** Total registered platform users, total enrolled participants in the active edition, active vs. disqualified participants count and percentage, breakdown by country.
- **Disqualification Breakdown by Cause:** Count & percentage disqualified due to:
  - Exceeding max missed prompts (*Fallas*)
  - Failing to postulate a story in Stage 3
  - Rejected excessive modifications / failing to submit 24h correction in Stage 4
  - Failing to vote in Stage 5
  - Manual administrator disqualification
- **Prompt-by-Prompt Metrics (Stage 2):** Number and percentage of stories submitted per prompt, average character count, participants currently at 1 miss, 2 misses, etc.
- **Postulation & Review Metrics (Stages 3 & 4):** Stories selected vs. postulated, distribution of which prompt was most chosen for postulation, active modification alerts, average similarity percentage.
- **Voting & Jury Progress (Stages 5 & 6):** Percentage of active participants who have voted, pre-selection activity, Jury voting completion status (who has voted / who is pending).

### 7.4 Participant Interventions & Late Submissions (`ADMIN` & `SUPERADMIN`)
- **Manual Disqualification:** An Admin can disqualify an active participant.
  - Requires entering a mandatory **justification** (recorded in the Audit Log).
  - Sends an email to the participant stating they have been disqualified and that the organizing team will contact them to explain the reasons.
  - Sends an email alert to the Superadmin and all other Administrators with the details and justification.
- **Manual Reinstatement (Reactivation):** An Admin can reinstate a disqualified participant.
  - Requires entering a mandatory **justification** (recorded in the Audit Log).
  - Sends an automated reactivation email to the participant.
- **Late Story Submission / Edit on Behalf of Participant:**
  - An Admin can upload a story late or edit a story on behalf of a participant (e.g., justified medical emergency).
  - Enforces the edition's `min_chars` and `max_chars` limits.
  - Requires a mandatory **justification** (recorded in the Audit Log).
  - **Auto-Reactivation Rule:** If the participant had been automatically disqualified for missing that prompt (or failing to postulate), uploading the late story automatically recalculates their status and **reactivates the participant**, sending them the reactivation email.

### 7.5 Audit Log (*Log de Acciones*)
- Visible to all `ADMIN` and `SUPERADMIN` users.
- Immutable chronological log recording every administrative intervention:
  - `timestamp` (`America/Caracas`)
  - `actor_user` (Admin/Superadmin who performed the action)
  - `action_type` (Manual Disqualification, Reinstatement, Late Story Upload/Edit, Alert Triggered, Alert Vote, Prompt Override, Winners Published, Role Changed)
  - `target_user` / `target_story`
  - `justification` (Mandatory text entered by the administrator)

---

## 8. Automated Email Notification System & Template Manager

### 8.1 Template Editor (`SUPERADMIN` Only)
- The Superadmin has a dedicated interface to edit the **Subject (*Asunto*)** and **Rich-Text Body** of every automated system email.
- Includes **one-click insert buttons** for dynamic tags:
  - `{{NOMBRE}}` — Recipient's first name
  - `{{APELLIDO}}` — Recipient's last name
  - `{{EMAIL}}` — Recipient's email
  - `{{EDICION}}` — Contest edition title (e.g., *Olimpíadas Literarias de SiTeLoCuento 2026*)
  - `{{NUMERO_CONSIGNA}}` — Prompt number
  - `{{TITULO_CONSIGNA}}` — Prompt title
  - `{{TITULO_CUENTO}}` — Story title
  - `{{CANTIDAD_FALLAS}}` — Current number of missed prompts
  - `{{MAX_FALLAS}}` — Max allowed misses configured
  - `{{FECHA_HORA_CIERRE}}` — Deadline date/time in `America/Caracas`
  - `{{LINK_PLATAFORMA}}` — Direct URL to the platform/action screen
  - `{{LINK_RESULTADOS}}` — Direct URL to the public Winners Page

### 8.2 Complete Catalog of Automated Emails

| # | Trigger Event | Recipients | Notes |
| :- | :--- | :--- | :--- |
| **E01** | Account Created (Email Verification / Welcome) | New User | Includes email verification link if registered via email/password. |
| **E02** | Password Reset Requested | Requesting User | Secure password recovery link. |
| **E03** | Enrolled in Contest Edition | Enrolled Participant | Confirmation of enrollment in the current edition. |
| **E04** | 24h Before Stage 2 (Writing Stage) Starts | All Enrolled Participants | Reminder that the first prompt starts tomorrow. |
| **E05** | New Prompt Published (Stage 2) | Active Participants | Announces that `Consigna #X` is now open. |
| **E06** | 1h Before Prompt Closes (No Story Submitted Yet) | Active Participants who haven't submitted for current prompt | Urgent 1-hour reminder. |
| **E07** | Max Allowed Misses Reached Warning | Active Participant who just reached `max_allowed_misses` | *"Atención, has fallado X veces, si fallas de nuevo serás descalificado"*. |
| **E08** | 24h Before Stage 3 (Postulation/Editing) Starts | Active Participants | Reminder that story selection & editing starts tomorrow. |
| **E09** | 1h Before Stage 3 Closes (Not Postulated Yet) | Active Participants who haven't postulated yet | Urgent 1-hour reminder. |
| **E10** | Story Postulated Confirmation (Stage 3) | Participant who just postulated | Confirms `{{TITULO_CUENTO}}` was postulated. |
| **E11** | Excessive Modification Alert Triggered by Admin | All `ADMIN` & `SUPERADMIN` | Notifies admins to review & vote on the flagged story. |
| **E12** | 24h Story Correction Requested (End of Stage 4) | Affected Participant (story did not get 2 admin validations) | Notifies user they have 24h to adjust their edited story. |
| **E13** | Corrected Story Re-Uploaded by Participant | All `ADMIN` & `SUPERADMIN` | Notifies admins to validate the re-submitted story within the remaining 24h. |
| **E14** | Stage 5 (Participant Voting) Started | Active Participants | Announces voting is open. |
| **E15** | 1h Before Stage 5 Closes (Has Not Voted Yet) | Active Participants who haven't voted yet | Urgent 1-hour reminder (warns that not voting causes disqualification). |
| **E16** | Participant Vote Confirmed | Participant who just voted | Confirmation of vote receipt. |
| **E17** | Automatic Disqualification Notice | Disqualified Participant | Sent upon exceeding max misses, failing to postulate, failing 24h correction review, or failing to vote. |
| **E18** | Manual Disqualification by Administrator | 1) Disqualified Participant<br>2) All `ADMIN` & `SUPERADMIN` | Participant mail says team will contact them; Admin mail includes actor & justification. |
| **E19** | Participant Reinstated / Reactivated | Reinstated Participant | Sent upon manual reinstatement or auto-reactivation via late story upload. |
| **E20** | Stage 6 (Jury Evaluation) Started | All `JURY` Members | Separate template for Jury announcing evaluation is open. |
| **E21** | 1h Before Stage 6 Closes (Juror Has Not Voted) | `JURY` Members who haven't voted yet | Urgent 1-hour reminder for Jury. |
| **E22** | Jury Vote Confirmed | `JURY` Member who just voted | Confirmation of Jury vote receipt. |
| **E23** | Missing Juror Vote Alert (Stage 6 Paused at Deadline) | All `ADMIN` & `SUPERADMIN` | Alerts admins that Stage 6 is paused waiting for specific juror(s). |
| **E24** | Stage 6b (Jury Tie-Breaker) Activated | All `JURY` Members | Notifies Jury to break a tie among podium stories. |
| **E25** |Edition Prompt Package Submitted for Validation | All `ADMIN` Users | Sent when Superadmin submits the edition's prompt package for majority approval. |
| **E26** | Stage 7: Winners Announced (Manual Trigger) | **ALL** Edition Participants (active + disqualified), `JURY`, `ADMIN`, `SUPERADMIN` | Broadcast email with link to the public Winners Page. |
