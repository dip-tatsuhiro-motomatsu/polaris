CREATE TABLE "collaborators" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"repository_id" bigint NOT NULL,
	"github_user_name" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collaborators_repo_github_user_unique" UNIQUE("repository_id","github_user_name")
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"issue_id" bigint NOT NULL,
	"lead_time_score" integer,
	"lead_time_calculated_at" timestamp with time zone,
	"quality_score" integer,
	"quality_details" jsonb,
	"quality_calculated_at" timestamp with time zone,
	"consistency_score" integer,
	"consistency_details" jsonb,
	"consistency_calculated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluations_issue_id_unique" UNIQUE("issue_id")
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"repository_id" bigint NOT NULL,
	"github_number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"state" text NOT NULL,
	"author_collaborator_id" bigint,
	"assignee_collaborator_id" bigint,
	"github_created_at" timestamp with time zone NOT NULL,
	"github_closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issues_repo_github_number_unique" UNIQUE("repository_id","github_number")
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"repository_id" bigint NOT NULL,
	"issue_id" bigint,
	"github_number" integer NOT NULL,
	"title" text NOT NULL,
	"state" text NOT NULL,
	"author_collaborator_id" bigint,
	"github_created_at" timestamp with time zone NOT NULL,
	"github_merged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pull_requests_repo_github_number_unique" UNIQUE("repository_id","github_number")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_name" text NOT NULL,
	"repo_name" text NOT NULL,
	"pat_encrypted" text NOT NULL,
	"tracking_start_date" date NOT NULL,
	"sprint_duration_weeks" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repositories_owner_repo_unique" UNIQUE("owner_name","repo_name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"role" text DEFAULT 'VIEWER' NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_author_collaborator_id_collaborators_id_fk" FOREIGN KEY ("author_collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_collaborator_id_collaborators_id_fk" FOREIGN KEY ("assignee_collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_author_collaborator_id_collaborators_id_fk" FOREIGN KEY ("author_collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;