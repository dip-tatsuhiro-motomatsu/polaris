import { pgTable, bigserial, text, date, integer, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * リポジトリテーブル
 * 監視対象のGitHubリポジトリ設定。
 */
export const repositories = pgTable(
  "repositories",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerName: text("owner_name").notNull(),
    repoName: text("repo_name").notNull(),
    patEncrypted: text("pat_encrypted"), // NULL許容（デフォルトは.envのGITHUB_PERSONAL_ACCESS_TOKENを使用）
    trackingStartDate: date("tracking_start_date"),
    sprintStartDayOfWeek: integer("sprint_start_day_of_week"), // 0=日曜, 1=月曜, ..., 6=土曜
    sprintDurationWeeks: integer("sprint_duration_weeks").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("repositories_owner_repo_unique").on(table.ownerName, table.repoName),
  ]
);

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
