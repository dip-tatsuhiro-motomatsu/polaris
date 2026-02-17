import { pgTable, bigserial, bigint, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { issues } from "./issues";

/**
 * 評価結果テーブル
 * Issueに対する評価結果。未評価項目のみ部分更新。
 */
export const evaluations = pgTable("evaluations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  issueId: bigint("issue_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => issues.id, { onDelete: "cascade" }),

  // リードタイム評価
  leadTimeScore: integer("lead_time_score"),
  leadTimeCalculatedAt: timestamp("lead_time_calculated_at", { withTimezone: true }),

  // Issue品質評価
  qualityScore: integer("quality_score"),
  qualityDetails: jsonb("quality_details"),
  qualityCalculatedAt: timestamp("quality_calculated_at", { withTimezone: true }),

  // 整合性評価
  consistencyScore: integer("consistency_score"),
  consistencyDetails: jsonb("consistency_details"),
  consistencyCalculatedAt: timestamp("consistency_calculated_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 品質評価詳細の型定義
 */
export interface QualityDetails {
  userStoryScore: number;
  userStoryFeedback: string;
  implementationPlanScore: number;
  implementationPlanFeedback: string;
  concernsScore: number;
  concernsFeedback: string;
  assigneeScore: number;
  assigneeFeedback: string;
}

/**
 * 整合性評価詳細の型定義
 */
export interface ConsistencyDetails {
  summary: string;
  deductions: Array<{
    reason: string;
    points: number;
  }>;
}

export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;
