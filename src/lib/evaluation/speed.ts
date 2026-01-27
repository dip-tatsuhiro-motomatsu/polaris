import { SPEED_CRITERIA } from "@/config/evaluation-criteria";
import type { Issue } from "@/types/issue";
import type { EvaluationResult } from "@/types/evaluation";

/**
 * 完了までの時間を時間単位で計算
 */
export function calculateCompletionHours(
  createdAt: Date,
  closedAt: Date
): number {
  const created = new Date(createdAt).getTime();
  const closed = new Date(closedAt).getTime();
  return (closed - created) / (1000 * 60 * 60);
}

/**
 * 完了時間から評価を生成
 */
export function evaluateByHours(hours: number): EvaluationResult {
  for (const criterion of SPEED_CRITERIA) {
    if (hours <= criterion.maxHours) {
      return {
        score: criterion.score,
        grade: criterion.grade,
        message: criterion.message,
        details: { completionHours: Math.round(hours * 10) / 10 },
        evaluatedAt: new Date(),
      };
    }
  }

  // フォールバック（最後の基準）
  const lastCriterion = SPEED_CRITERIA[SPEED_CRITERIA.length - 1];
  return {
    score: lastCriterion.score,
    grade: lastCriterion.grade,
    message: lastCriterion.message,
    details: { completionHours: Math.round(hours * 10) / 10 },
    evaluatedAt: new Date(),
  };
}

/**
 * Issueの完了速度を評価
 * - オープンなIssueはnullを返す
 * - closedAtがない場合もnullを返す
 */
export function evaluateIssueSpeed(issue: Issue): EvaluationResult | null {
  // オープンなIssueまたはclosedAtがない場合は評価不可
  if (issue.state === "open" || !issue.closedAt) {
    return null;
  }

  const hours = calculateCompletionHours(issue.createdAt, issue.closedAt);
  return evaluateByHours(hours);
}

/**
 * 複数のIssueを一括評価
 */
export function evaluateIssuesSpeed(
  issues: Issue[]
): Array<{ issueId: string; evaluation: EvaluationResult | null }> {
  return issues.map((issue) => ({
    issueId: issue.id,
    evaluation: evaluateIssueSpeed(issue),
  }));
}

/**
 * クローズされたIssueのみをフィルタして評価
 */
export function evaluateClosedIssues(
  issues: Issue[]
): Array<{ issueId: string; evaluation: EvaluationResult }> {
  return issues
    .filter((issue) => issue.state === "closed" && issue.closedAt)
    .map((issue) => ({
      issueId: issue.id,
      evaluation: evaluateIssueSpeed(issue)!,
    }));
}
