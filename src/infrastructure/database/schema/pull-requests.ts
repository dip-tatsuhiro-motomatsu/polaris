import { pgTable, bigserial, bigint, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { repositories } from "./repositories";
import { issues } from "./issues";
import { collaborators } from "./collaborators";

/**
 * プルリクエストテーブル
 * GitHubから同期したPRデータ。Issueと1:N関係。
 */
export const pullRequests = pgTable(
  "pull_requests",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    repositoryId: bigint("repository_id", { mode: "number" })
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    issueId: bigint("issue_id", { mode: "number" })
      .references(() => issues.id, { onDelete: "set null" }),
    githubNumber: integer("github_number").notNull(),
    title: text("title").notNull(),
    state: text("state").notNull(),
    authorCollaboratorId: bigint("author_collaborator_id", { mode: "number" })
      .references(() => collaborators.id, { onDelete: "set null" }),
    githubCreatedAt: timestamp("github_created_at", { withTimezone: true }).notNull(),
    githubMergedAt: timestamp("github_merged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("pull_requests_repo_github_number_unique").on(table.repositoryId, table.githubNumber),
  ]
);

export type PullRequest = typeof pullRequests.$inferSelect;
export type NewPullRequest = typeof pullRequests.$inferInsert;
