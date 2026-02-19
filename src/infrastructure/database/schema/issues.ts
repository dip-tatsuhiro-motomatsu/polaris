import { pgTable, bigserial, bigint, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { repositories } from "./repositories";
import { collaborators } from "./collaborators";

/**
 * Issueテーブル
 * GitHubから同期したIssueデータ。
 */
export const issues = pgTable(
  "issues",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    repositoryId: bigint("repository_id", { mode: "number" })
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    githubNumber: integer("github_number").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    state: text("state").notNull(),
    authorCollaboratorId: bigint("author_collaborator_id", { mode: "number" })
      .references(() => collaborators.id, { onDelete: "set null" }),
    assigneeCollaboratorId: bigint("assignee_collaborator_id", { mode: "number" })
      .references(() => collaborators.id, { onDelete: "set null" }),
    sprintNumber: integer("sprint_number"), // スプリント番号（Issue作成日から計算）
    githubCreatedAt: timestamp("github_created_at", { withTimezone: true }).notNull(),
    githubClosedAt: timestamp("github_closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("issues_repo_github_number_unique").on(table.repositoryId, table.githubNumber),
  ]
);

export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;
