import { pgTable, bigserial, bigint, timestamp, unique } from "drizzle-orm/pg-core";
import { repositories } from "./repositories";
import { collaborators } from "./collaborators";

/**
 * 追跡対象コラボレーターテーブル
 * リポジトリごとに追跡対象とするコラボレーターを管理。
 */
export const trackedCollaborators = pgTable(
  "tracked_collaborators",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    repositoryId: bigint("repository_id", { mode: "number" })
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    collaboratorId: bigint("collaborator_id", { mode: "number" })
      .notNull()
      .references(() => collaborators.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("tracked_collaborators_repo_collaborator_unique").on(
      table.repositoryId,
      table.collaboratorId
    ),
  ]
);

export type TrackedCollaborator = typeof trackedCollaborators.$inferSelect;
export type NewTrackedCollaborator = typeof trackedCollaborators.$inferInsert;
