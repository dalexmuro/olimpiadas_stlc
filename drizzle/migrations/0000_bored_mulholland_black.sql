CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` text,
	`refresh_token_expires_at` text,
	`scope` text,
	`password` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_account_unique` ON `accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text,
	`actor_id` text NOT NULL,
	`action_type` text NOT NULL,
	`target_user_id` text,
	`target_story_id` text,
	`justification` text NOT NULL,
	`metadata_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `edition_package_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`admin_id` text NOT NULL,
	`approved` integer NOT NULL,
	`voted_at` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edition_package_votes_edition_admin_unique` ON `edition_package_votes` (`edition_id`,`admin_id`);--> statement-breakpoint
CREATE TABLE `edition_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`source_prompt_bank_id` text,
	`prompt_number` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`media_type` text,
	`media_url` text,
	`published_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`closes_processed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_prompt_bank_id`) REFERENCES `prompt_bank`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edition_prompts_edition_number_unique` ON `edition_prompts` (`edition_id`,`prompt_number`);--> statement-breakpoint
CREATE TABLE `editions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`min_chars` integer DEFAULT 100 NOT NULL,
	`max_chars` integer DEFAULT 3000 NOT NULL,
	`max_allowed_misses` integer DEFAULT 2 NOT NULL,
	`min_similarity_pct` integer DEFAULT 70 NOT NULL,
	`jury_brackets_json` text DEFAULT '[{"min":0,"max":29,"k":5},{"min":30,"max":60,"k":10},{"min":61,"max":100,"k":15},{"min":101,"max":99999,"k":20}]' NOT NULL,
	`prompt_package_status` text DEFAULT 'DRAFT' NOT NULL,
	`registration_start_at` text NOT NULL,
	`registration_end_at` text NOT NULL,
	`writing_start_at` text NOT NULL,
	`writing_end_at` text NOT NULL,
	`submission_start_at` text NOT NULL,
	`submission_end_at` text NOT NULL,
	`admin_review_start_at` text NOT NULL,
	`admin_review_end_at` text NOT NULL,
	`voting_start_at` text NOT NULL,
	`voting_end_at` text NOT NULL,
	`jury_start_at` text NOT NULL,
	`jury_end_at` text NOT NULL,
	`jury_paused_missing_votes` integer DEFAULT false NOT NULL,
	`tie_breaker_active` integer DEFAULT false NOT NULL,
	`tie_breaker_completed` integer DEFAULT false NOT NULL,
	`winners_announced` integer DEFAULT false NOT NULL,
	`winners_announced_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editions_slug_unique` ON `editions` (`slug`);--> statement-breakpoint
CREATE TABLE `email_dispatch_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text,
	`template_code` text NOT NULL,
	`recipient_user_id` text NOT NULL,
	`context_key` text NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_dispatch_logs_idempotency_unique` ON `email_dispatch_logs` (`template_code`,`recipient_user_id`,`context_key`);--> statement-breakpoint
CREATE TABLE `email_templates` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`subject_template` text NOT NULL,
	`body_html_template` text NOT NULL,
	`available_tags_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`user_id` text NOT NULL,
	`accepted_rules` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`disqualification_reason` text,
	`disqualified_at` text,
	`misses_count` integer DEFAULT 0 NOT NULL,
	`selected_story_id` text,
	`postulated_at` text,
	`in_correction_window` integer DEFAULT false NOT NULL,
	`correction_deadline_at` text,
	`correction_submitted_at` text,
	`has_voted` integer DEFAULT false NOT NULL,
	`voted_at` text,
	`enrolled_at` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_edition_user_unique` ON `enrollments` (`edition_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `prompt_bank` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`media_type` text,
	`media_url` text,
	`status` text DEFAULT 'AVAILABLE' NOT NULL,
	`assigned_edition_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prompt_bank_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_bank_id` text NOT NULL,
	`author_id` text NOT NULL,
	`comment_text` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`prompt_bank_id`) REFERENCES `prompt_bank`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prompt_bank_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_bank_id` text NOT NULL,
	`admin_id` text NOT NULL,
	`vote_value` integer NOT NULL,
	FOREIGN KEY (`prompt_bank_id`) REFERENCES `prompt_bank`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_bank_votes_prompt_admin_unique` ON `prompt_bank_votes` (`prompt_bank_id`,`admin_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `site_pages` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content_html` text NOT NULL,
	`updated_by_id` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`enrollment_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`author_id` text NOT NULL,
	`original_title` text NOT NULL,
	`original_body` text NOT NULL,
	`original_char_count` integer NOT NULL,
	`submitted_at` text NOT NULL,
	`is_selected_for_postulation` integer DEFAULT false NOT NULL,
	`is_postulated` integer DEFAULT false NOT NULL,
	`edited_title` text,
	`edited_body` text,
	`edited_char_count` integer,
	`similarity_pct` real,
	`postulated_at` text,
	`participant_points` integer DEFAULT 0 NOT NULL,
	`passed_to_jury` integer DEFAULT false NOT NULL,
	`jury_points` integer DEFAULT 0 NOT NULL,
	`total_points` integer DEFAULT 0 NOT NULL,
	`tie_breaker_rank` integer,
	`podium_place` integer,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prompt_id`) REFERENCES `edition_prompts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stories_enrollment_prompt_unique` ON `stories` (`enrollment_id`,`prompt_id`);--> statement-breakpoint
CREATE TABLE `story_alert_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`alert_id` text NOT NULL,
	`admin_id` text NOT NULL,
	`decision` text NOT NULL,
	`voted_at` text NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `story_modification_alerts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `story_alert_votes_alert_admin_unique` ON `story_alert_votes` (`alert_id`,`admin_id`);--> statement-breakpoint
CREATE TABLE `story_modification_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`triggered_by_admin_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`triggered_by_admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `story_mod_alerts_story_round_unique` ON `story_modification_alerts` (`story_id`,`round`);--> statement-breakpoint
CREATE TABLE `story_reads_preselections` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`story_id` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`is_preselected` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`voter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `story_reads_preselections_voter_story_unique` ON `story_reads_preselections` (`voter_id`,`story_id`);--> statement-breakpoint
CREATE TABLE `tie_breaker_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`round_number` integer DEFAULT 1 NOT NULL,
	`tied_positions` text NOT NULL,
	`tied_story_ids_json` text NOT NULL,
	`is_resolved` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tie_breaker_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`tie_breaker_round_id` text NOT NULL,
	`juror_id` text NOT NULL,
	`first_choice_story_id` text NOT NULL,
	`second_choice_story_id` text,
	`voted_at` text NOT NULL,
	FOREIGN KEY (`tie_breaker_round_id`) REFERENCES `tie_breaker_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`juror_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`first_choice_story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`second_choice_story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tie_breaker_votes_round_juror_unique` ON `tie_breaker_votes` (`tie_breaker_round_id`,`juror_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`first_name` text,
	`last_name` text,
	`country` text,
	`phone` text,
	`avatar_url` text,
	`profile_completed` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'PARTICIPANT' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`voter_role` text NOT NULL,
	`first_place_story_id` text NOT NULL,
	`second_place_story_id` text NOT NULL,
	`third_place_story_id` text NOT NULL,
	`first_place_points` integer NOT NULL,
	`second_place_points` integer NOT NULL,
	`third_place_points` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`voter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`first_place_story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`second_place_story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`third_place_story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `votes_edition_voter_role_unique` ON `votes` (`edition_id`,`voter_id`,`voter_role`);