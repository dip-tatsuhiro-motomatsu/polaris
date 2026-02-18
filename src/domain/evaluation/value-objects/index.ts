/**
 * 評価ドメイン - 値オブジェクト
 */

// 基本スコア
export { Score, type Grade } from "./Score";

// リードタイム評価
export { LeadTimeScore } from "./LeadTimeScore";

// Issue品質評価（既存パターン）
export {
  IssueQualityScore,
  type IssueQualityItemScores,
  type IssueQualityItemFeedback,
} from "./IssueQualityScore";

// 整合性評価（既存パターン）
export {
  ConsistencyScore,
  type ConsistencyDeduction,
} from "./ConsistencyScore";

// 品質評価（新パターン - カテゴリベース）
export { QualityScore } from "./QualityScore";
export { QualityGrade, type QualityGradeValue } from "./QualityGrade";

// 整合性評価（新パターン - カテゴリベース）
export { ConsistencyGrade, type ConsistencyGradeValue } from "./ConsistencyGrade";

// 評価基準
export {
  QUALITY_CATEGORIES,
  CONSISTENCY_CATEGORIES,
  QualityCriteria,
  ConsistencyCriteria,
  type EvaluationCategory,
  type CategoryScore,
  type ValidationResult,
} from "./EvaluationCriteria";
