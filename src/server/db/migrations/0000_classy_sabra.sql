CREATE TYPE "public"."activity_source" AS ENUM('github', 'render');--> statement-breakpoint
CREATE TYPE "public"."agent_tier" AS ENUM('jarvis', 'ceo', 'director');--> statement-breakpoint
CREATE TYPE "public"."fetch_status" AS ENUM('success', 'stale', 'failed', 'rate_limited');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."message_scope" AS ENUM('project', 'global');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('queued', 'in_progress', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_feed_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source" "activity_source" NOT NULL,
	"event_type" text NOT NULL,
	"external_id" text NOT NULL,
	"summary" text NOT NULL,
	"url" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"name" text NOT NULL,
	"tier" "agent_tier" DEFAULT 'director' NOT NULL,
	"model_override" text,
	"persona" text NOT NULL,
	"raw_content" text NOT NULL,
	"source_path" text NOT NULL,
	"content_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "agent_definitions_filename_unique" UNIQUE("filename")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "briefing_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"briefing_date" date NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger_reason" text NOT NULL,
	"content" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkpoint_saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"git_sha" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "message_scope" NOT NULL,
	"project_id" uuid,
	"agent_id" text NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"task_id" uuid,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "msg_scope_matches_project" CHECK (
    ("conversation_messages"."scope" = 'global' AND "conversation_messages"."project_id" IS NULL) OR
    ("conversation_messages"."scope" = 'project' AND "conversation_messages"."project_id" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daemon_heartbeats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"daemon_id" text NOT NULL,
	"host_name" text,
	"daemon_version" text,
	"active_task_id" uuid,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interview_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "interview_states_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"local_path" text NOT NULL,
	"repo_url" text,
	"github_owner" text,
	"github_repo" text,
	"render_service_id" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"websearch_enabled" boolean DEFAULT true NOT NULL,
	"github_reachable" boolean DEFAULT true NOT NULL,
	"last_github_sync_at" timestamp with time zone,
	"last_github_status" "fetch_status",
	"last_render_sync_at" timestamp with time zone,
	"last_render_status" "fetch_status",
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checkin_at" timestamp with time zone,
	"interview_dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"device_label" text,
	"user_agent" text,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"status" "task_status" DEFAULT 'queued' NOT NULL,
	"daemon_session_id" text,
	"exit_code" integer,
	"error_message" text,
	"output_summary" text,
	"transcript" text,
	"truncated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_feed_items" ADD CONSTRAINT "activity_feed_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checkpoint_saves" ADD CONSTRAINT "checkpoint_saves_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daemon_heartbeats" ADD CONSTRAINT "daemon_heartbeats_active_task_id_tasks_id_fk" FOREIGN KEY ("active_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "interview_states" ADD CONSTRAINT "interview_states_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_activity_unique" ON "activity_feed_items" USING btree ("project_id","source","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_project_occurred" ON "activity_feed_items" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_source" ON "activity_feed_items" USING btree ("project_id","source","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_defs_tier" ON "agent_definitions" USING btree ("tier") WHERE "agent_definitions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_briefings_one_per_day" ON "briefing_generations" USING btree ("briefing_date") WHERE "briefing_generations"."trigger_reason" = 'session_entry_gap';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_checkpoints_project_created" ON "checkpoint_saves" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_msgs_project_created" ON "conversation_messages" USING btree ("project_id","created_at") WHERE "conversation_messages"."scope" = 'project';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_msgs_global_created" ON "conversation_messages" USING btree ("created_at") WHERE "conversation_messages"."scope" = 'global';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_msgs_task" ON "conversation_messages" USING btree ("task_id") WHERE "conversation_messages"."task_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_heartbeats_recent" ON "daemon_heartbeats" USING btree ("daemon_id","reported_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_status_active" ON "projects" USING btree ("status") WHERE "projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_last_active" ON "projects" USING btree ("last_active_at") WHERE "projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_active" ON "sessions" USING btree ("expires_at") WHERE "sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_project_status" ON "tasks" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_project_created" ON "tasks" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_active" ON "tasks" USING btree ("status") WHERE "tasks"."status" IN ('queued', 'in_progress');