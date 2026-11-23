# Platform Functional Guide — Olimpíadas Literarias (SiTeLoCuento)

**English** | [Español](GUIA_FUNCIONAL_ORGANIZADORES.md)

**Audience:** Organizing Team, Jury Members, and Non-Technical Stakeholders — SiTeLoCuento Writing Club

---

## 1. Overview

**Olimpíadas Literarias** (`https://olimpiadas.sitelocuento.com`) is the annual short-story writing competition platform organized by the **SiTeLoCuento** writing club.

- **100% Spanish UI & Responsive:** Designed for desktop, tablet, and mobile devices.
- **Permanent Accounts Across Editions:** Writers create an account once and reuse it every year; each annual edition requires explicit enrollment during the *Registration* stage.
- **Official Timezone:** All schedules, deadlines, and automated notifications follow **`America/Caracas` (UTC-4)**.

---

## 2. User Roles

1. **Participants (`PARTICIPANT`):** Enroll in the active edition, submit short stories to prompts, choose and polish one story for final submission, read and vote anonymously on peers' stories (Top 3), and manage their personal profile.
2. **Jury (`JURY`):** Active exclusively during *Jury Evaluation* and *Jury Tie-Breaker* stages. Reads the Top 10+ finalist stories anonymously and casts weighted votes for 1st, 2nd, and 3rd place without seeing participant scores.
3. **Contest Administrators (`ADMIN`):** Propose, comment, and vote anonymously on future prompts in the collaborative Prompt Bank; validate the Superadmin's edition prompt package; monitor real-time statistics; read all stories with author names; review original-vs-edited diffs; trigger and vote on Excessive Modification Alerts; manage manual interventions (disqualify/reinstate, late story uploads with mandatory justification); inspect the immutable Audit Log; and trigger the *Winners Announcement*.
4. **Superadministrator (`SUPERADMIN`):** Holds all `ADMIN` capabilities plus exclusive configuration: creates and configures annual editions, stage schedules, edition parameters (character limits, allowed misses, similarity threshold, jury multiplier brackets), edition prompts, automated email templates (`E01`–`E26`), static public pages (*Bases del Concurso*, *¿Quiénes somos?*), and global user roles.

> **Fairness Rule:** Users holding `SUPERADMIN`, `ADMIN`, or `JURY` roles cannot enroll as competing writers while holding those roles.

---

## 3. Public Experience & Security

- **Public Pages:** Landing page (`/`), *Bases del Concurso*, *¿Quiénes somos?*, *Resultados* (latest completed edition podium), and *Ediciones* (public anthology of completed editions).
- **Registration & Profile:** Supports Email/Password (with duplicate-email pre-check, 8+ character / 3-of-4 strong password policy in an interactive info tooltip, password visibility toggle, and email verification `E01`) as well as one-click **Google** and **Microsoft** sign-in (auto-populating first name, last name, and avatar). Phone numbers use a unified split input with automatic country dial code and country-specific format placeholder.
- **Account & Session Controls:** From **My Profile** (`/perfil`), users can update personal info, upload an avatar to R2, change their password, **Sign Out**, or permanently **Delete Account** (with confirmation dialog and protection against deleting the last `SUPERADMIN`).
- **Automatic Inactivity Timeout:** Active users stay signed in automatically; open idle tabs show a 5-minute countdown warning modal at 25 minutes (`Seguir conectado` / `Cerrar sesión`) and sign out at 30 minutes; closed tabs expire automatically after 15 minutes.

---

## 4. Contest Lifecycle (Stages 1–7)

1. **Stage 1 — Registration:** Authenticated users accept the Contest Rules and enroll in the active edition.
2. **Stage 2 — Prompt Writing:** Scheduled prompts (text + optional image/video) open sequentially. Live character counter, auto-saved drafts, last-hour countdown, and automated missed-prompt tracking (warning email at max misses, automatic disqualification if exceeded). Mandatory **48-hour buffer** follows.
3. **Stage 3 — Story Selection & Editing:** Participants review all their Stage 2 stories, lock in **one** story to compete, and polish it while a real-time similarity check prevents replacing it with a different story. Final submission via **Postular** is required before deadline.
4. **Stage 4 — Administrator Review:** Administrators inspect original-vs-edited diffs and may raise Excessive Modification Alerts (resolved by $\ge 2$ admin validations; otherwise triggers a **24-hour** participant correction window followed by a **24-hour** admin re-validation window inside the second **48-hour buffer**).
5. **Stage 5 — Anonymous Participant Voting:** Randomized per-voter anonymous story list; participants mark stories as read, preselect at least 3 favorites, and cast a definitive Top 3 vote (3 / 2 / 1 points; cannot vote for their own story).
6. **Stage 6 — Independent Jury Evaluation & Tie-Breaker:** Jurors evaluate the Top 10+ finalists anonymously with a dynamic multiplier $K$ (scaled by active participant count). If a podium tie occurs, an automatic **Jury Tie-Breaker** round resolves only the tied positions.
7. **Stage 7 — Winners Announcement & Public Anthology:** Publishes the official podium (1st, 2nd, 3rd place with author photos, zero numeric scores exposed) and opens the chronological public anthology under `/ediciones`.
