// 速度評価用グレード
export type Grade = "S" | "A" | "B" | "C";

// 品質評価用グレード
export type QualityGrade = "A" | "B" | "C" | "D" | "E";

export interface EvaluationResult {
  score: number;
  grade: Grade;
  message: string;
  details?: Record<string, unknown>;
  evaluatedAt: Date;
}

/**
 * 品質評価のカテゴリ別スコア
 */
export interface QualityCategoryScore {
  categoryId: string;
  categoryName: string;
  score: number;
  maxScore: number;
  feedback: string;
}

/**
 * Issue記述品質の評価結果
 */
export interface IssueQualityEvaluation {
  totalScore: number;
  grade: QualityGrade;
  categories: QualityCategoryScore[];
  overallFeedback: string;
  improvementSuggestions: string[];
  evaluatedAt: string;
}

export interface SpeedCriterion {
  maxHours: number;
  score: number;
  grade: Grade;
  message: string;
}

export interface QualityCheckItem {
  id: string;
  label: string;
  weight: number;
  description: string;
}

export interface QualityEvaluationDetail {
  itemId: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface ConsistencyEvaluationDetail {
  issueNumber: number;
  consistencyScore: number;
  feedback: string;
}

export interface GradeDistribution {
  S: number;
  A: number;
  B: number;
  C: number;
}

export interface TeamSummary {
  repositoryId: string;
  period: {
    start: Date | null;
    end: Date | null;
    isFullPeriod: boolean;
  };
  totalIssues: number;
  closedIssues: number;
  totalPRs: number;
  averageScores: {
    speed: number | null;
    quality: number | null;
    consistency: number | null;
  };
  gradeDistribution: {
    speed: GradeDistribution;
    quality: GradeDistribution;
    consistency: GradeDistribution;
  };
  memberStats: MemberStats[];
}

export interface MemberStats {
  assignee: string;
  issueCount: number;
  averageSpeed: number | null;
  averageQuality: number | null;
}
