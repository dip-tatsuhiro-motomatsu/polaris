/**
 * AI評価レスポンスのZodスキーマ
 * Vercel AI SDKのgenerateObjectで使用
 */

import { z } from "zod";

/**
 * 品質評価のAIレスポンススキーマ
 */
export const QualityEvaluationResponseSchema = z.object({
  categories: z.array(
    z.object({
      categoryId: z.string().describe("カテゴリID（例: context-goal, implementation-details）"),
      score: z.number().describe("このカテゴリのスコア（0〜最大スコア）"),
      feedback: z.string().describe("このカテゴリに対する具体的なフィードバック（日本語）"),
    })
  ),
  overallFeedback: z.string().describe("全体的な評価コメント（日本語、2-3文）"),
  improvementSuggestions: z
    .array(z.string())
    .max(3)
    .describe("最も改善すべき点（日本語、最大3つ、具体的なアクション）"),
});

export type QualityEvaluationResponse = z.infer<typeof QualityEvaluationResponseSchema>;

/**
 * 整合性評価のAIレスポンススキーマ
 */
export const ConsistencyEvaluationResponseSchema = z.object({
  categories: z.array(
    z.object({
      categoryId: z.string().describe("カテゴリID（例: issue-evaluability, requirement-coverage）"),
      score: z.number().describe("このカテゴリのスコア（0〜最大スコア）"),
      feedback: z.string().describe("このカテゴリに対する具体的なフィードバック（日本語）"),
    })
  ),
  overallFeedback: z.string().describe("全体的な評価コメント（日本語、2-3文）"),
  issueImprovementSuggestions: z
    .array(z.string())
    .max(3)
    .describe("Issue記述の改善点（日本語、Issue記述が不十分な場合のみ）"),
});

export type ConsistencyEvaluationResponse = z.infer<typeof ConsistencyEvaluationResponseSchema>;
