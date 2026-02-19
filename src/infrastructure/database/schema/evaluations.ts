import { pgTable, bigserial, bigint, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  leadTimeGrade: text("lead_time_grade"), // A, B, C, D, E
  leadTimeCalculatedAt: timestamp("lead_time_calculated_at", { withTimezone: true }),

  // Issue品質評価
  qualityScore: integer("quality_score"),
  qualityGrade: text("quality_grade"), // A, B, C, D, E
  qualityDetails: jsonb("quality_details").$type<QualityDetails>(),
  qualityCalculatedAt: timestamp("quality_calculated_at", { withTimezone: true }),

  // 整合性評価
  consistencyScore: integer("consistency_score"),
  consistencyGrade: text("consistency_grade"), // A, B, C, D, E
  consistencyDetails: jsonb("consistency_details").$type<ConsistencyDetails>(),
  consistencyCalculatedAt: timestamp("consistency_calculated_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * カテゴリ別評価結果
 */
export interface CategoryEvaluation {
  categoryId: string;
  categoryName: string;
  score: number;
  maxScore: number;
  feedback: string;
}

/**
 * 品質評価詳細の型定義
 */
export interface QualityDetails {
  categories: CategoryEvaluation[];
  overallFeedback: string;
  improvementSuggestions: string[];
}

/**
 * 整合性評価詳細の型定義
 */
export interface ConsistencyDetails {
  linkedPRs: Array<{
    number: number;
    title: string;
    url: string;
  }>;
  categories: CategoryEvaluation[];
  overallFeedback: string;
  issueImprovementSuggestions: string[];
}

export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;
