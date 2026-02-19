import { pgTable, bigserial, bigint, text, timestamp, unique } from "drizzle-orm/pg-core";
import { repositories } from "./repositories";

/**
 * コラボレーターテーブル
 * リポジトリに紐づくGitHubメンバー。
 */
export const collaborators = pgTable(
  "collaborators",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    repositoryId: bigint("repository_id", { mode: "number" })
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    githubUserName: text("github_user_name").notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("collaborators_repo_github_user_unique").on(table.repositoryId, table.githubUserName),
  ]
);

export type Collaborator = typeof collaborators.$inferSelect;
export type NewCollaborator = typeof collaborators.$inferInsert;
