ALTER TABLE "repositories" ALTER COLUMN "tracking_start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "sprint_start_day_of_week" integer;