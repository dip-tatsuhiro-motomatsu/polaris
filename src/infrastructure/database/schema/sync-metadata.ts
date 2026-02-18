import { pgTable, bigserial, bigint, timestamp } from "drizzle-orm/pg-core";
import { repositories } from "./repositories";

/**
 * 同期メタデータテーブル
 * リポジトリごとの最終同期日時を管理。
 */
export const syncMetadata = pgTable("sync_metadata", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  repositoryId: bigint("repository_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => repositories.id, { onDelete: "cascade" }),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SyncMetadata = typeof syncMetadata.$inferSelect;
export type NewSyncMetadata = typeof syncMetadata.$inferInsert;
