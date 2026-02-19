CREATE TABLE "sync_metadata" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"repository_id" bigint NOT NULL,
	"last_sync_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_metadata_repository_id_unique" UNIQUE("repository_id")
);
--> statement-breakpoint
CREATE TABLE "tracked_collaborators" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"repository_id" bigint NOT NULL,
	"collaborator_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_collaborators_repo_collaborator_unique" UNIQUE("repository_id","collaborator_id")
);
--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "lead_time_grade" text;--> statement-breakpoint
ALTER TABLE "sync_metadata" ADD CONSTRAINT "sync_metadata_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_collaborators" ADD CONSTRAINT "tracked_collaborators_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_collaborators" ADD CONSTRAINT "tracked_collaborators_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;