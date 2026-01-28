import { SpeedCriterion, QualityCheckItem, Grade, QualityGrade, ConsistencyGrade, ConsistencyCheckItem } from "@/types/evaluation";

/**
 * 完了速度評価基準
 * - S (120点): 24時間以内 - 小さな単位で開発できています！
 * - A (100点): 72時間以内 - 非常に健全な開発スピードです
 * - B (70点): 120時間以内 - 少しタスクが肥大化しているかも？
 * - C (40点): 120時間超 - 何か詰まっているはず
 */
export const SPEED_CRITERIA: SpeedCriterion[] = [
  {
    maxHours: 24,
    score: 120,
    grade: "S",
    message: "小さな単位で開発できています！素晴らしい。",
  },
  {
    maxHours: 72,
    score: 100,
    grade: "A",
    message: "非常に健全な開発スピードです。",
  },
  {
    maxHours: 120,
    score: 70,
    grade: "B",
    message: "少しタスクが肥大化しているかも？分担を検討。",
  },
  {
    maxHours: Infinity,
    score: 40,
    grade: "C",
    message: "何か詰まっているはず。メンターに相談しよう。",
  },
];

/**
 * Issue記述品質の評価項目（新基準）
 * 各項目の重み（weight）の合計は100になる
 */
export const QUALITY_CHECK_ITEMS: QualityCheckItem[] = [
  {
    id: "context-goal",
    label: "Context & Goal（背景と目的）",
    weight: 25,
    description:
      "「なぜこれをやるのか」が明確か。背景(Background)、目的(Objective)、優先度の根拠が記載されているか。",
  },
  {
    id: "implementation-details",
    label: "Implementation Details（実装詳細・要件）",
    weight: 25,
    description:
      "「具体的に何をすればいいか」が明確か。要件定義、技術的な制約、参考リンクが記載されているか。",
  },
  {
    id: "acceptance-criteria",
    label: "Acceptance Criteria（受け入れ条件）",
    weight: 30,
    description:
      "「どうなれば完了か」が定量的に示されているか。チェックリスト形式、テスト要件、計測可能な基準があるか。",
  },
  {
    id: "structure-clarity",
    label: "Structure & Clarity（構造と読みやすさ）",
    weight: 20,
    description:
      "他人が読んだ時に一瞬で理解できるか。Markdownの活用、図解・画像、簡潔さが適切か。",
  },
];

/**
 * 品質評価のグレード定義
 */
export interface QualityGradeCriterion {
  grade: QualityGrade;
  minScore: number;
  maxScore: number;
  label: string;
  description: string;
}

export const QUALITY_GRADE_CRITERIA: QualityGradeCriterion[] = [
  {
    grade: "A",
    minScore: 81,
    maxScore: 100,
    label: "AI Ready",
    description: "実装担当者が一度も質問せずにPRまで出せる。エッジケースや影響範囲も網羅されている。",
  },
  {
    grade: "B",
    minScore: 61,
    maxScore: 80,
    label: "Actionable",
    description: "人間であれば迷わず作業に入れる。標準的な要件とACが揃っている。",
  },
  {
    grade: "C",
    minScore: 41,
    maxScore: 60,
    label: "Developing",
    description: "目的はわかるが、実装方法や詳細な仕様で「確認」が発生する。",
  },
  {
    grade: "D",
    minScore: 21,
    maxScore: 40,
    label: "Needs Refinement",
    description: "タイトルと一行程度の説明のみ。実装者が「何をすべきか」を調査するところから始まる。",
  },
  {
    grade: "E",
    minScore: 0,
    maxScore: 20,
    label: "Incomplete",
    description: "必須項目の欠落、または内容が支離滅裂。",
  },
];

/**
 * グレードから点数範囲を取得
 */
export function getScoreRange(grade: Grade): { min: number; max: number } {
  switch (grade) {
    case "S":
      return { min: 101, max: 120 };
    case "A":
      return { min: 71, max: 100 };
    case "B":
      return { min: 41, max: 70 };
    case "C":
      return { min: 0, max: 40 };
  }
}

/**
 * 点数からグレードを判定（速度評価用）
 */
export function scoreToGrade(score: number): Grade {
  if (score >= 101) return "S";
  if (score >= 71) return "A";
  if (score >= 41) return "B";
  return "C";
}

/**
 * 点数から品質グレードを判定
 */
export function scoreToQualityGrade(score: number): QualityGrade {
  if (score >= 81) return "A";
  if (score >= 61) return "B";
  if (score >= 41) return "C";
  if (score >= 21) return "D";
  return "E";
}

/**
 * 品質グレードの詳細情報を取得
 */
export function getQualityGradeInfo(grade: QualityGrade): QualityGradeCriterion | undefined {
  return QUALITY_GRADE_CRITERIA.find((c) => c.grade === grade);
}

/**
 * Issue-PR整合性の評価項目
 * 各項目の重み（weight）の合計は100になる
 */
export const CONSISTENCY_CHECK_ITEMS: ConsistencyCheckItem[] = [
  {
    id: "issue-evaluability",
    label: "Issue記述の評価可能性",
    weight: 20,
    description:
      "Issueの要件が明確でPR評価が可能か。曖昧な記述の場合は減点し、改善点を指摘する。",
  },
  {
    id: "requirement-coverage",
    label: "要件網羅性",
    weight: 30,
    description:
      "Issueに記載された要件がPRで実装されているか。未実装の要件がないか確認する。",
  },
  {
    id: "scope-appropriateness",
    label: "実装範囲の適切さ",
    weight: 20,
    description:
      "過不足なく実装されているか。スコープクリープ（要件外の実装）がないか確認する。",
  },
  {
    id: "acceptance-criteria-achievement",
    label: "受け入れ条件の達成",
    weight: 20,
    description:
      "Issueの受け入れ条件（AC）をPRが満たしているか。ACが明確な場合のみ評価可能。",
  },
  {
    id: "pr-description-clarity",
    label: "変更説明の明確さ",
    weight: 10,
    description:
      "PR説明がIssueとの関連を明確にしているか。変更内容が適切に説明されているか。",
  },
];

/**
 * PR整合性評価のグレード定義
 */
export interface ConsistencyGradeCriterion {
  grade: ConsistencyGrade;
  minScore: number;
  maxScore: number;
  label: string;
  description: string;
}

export const CONSISTENCY_GRADE_CRITERIA: ConsistencyGradeCriterion[] = [
  {
    grade: "A",
    minScore: 81,
    maxScore: 100,
    label: "完全一致",
    description: "Issueの要件が全て実装され、スコープも適切。模範的なPR。",
  },
  {
    grade: "B",
    minScore: 61,
    maxScore: 80,
    label: "概ね一致",
    description: "主要な要件は実装されているが、一部改善の余地あり。",
  },
  {
    grade: "C",
    minScore: 41,
    maxScore: 60,
    label: "部分的に一致",
    description: "要件の一部が未実装、またはスコープに問題あり。",
  },
  {
    grade: "D",
    minScore: 21,
    maxScore: 40,
    label: "乖離あり",
    description: "Issueの要件とPRの実装に明確な乖離がある。",
  },
  {
    grade: "E",
    minScore: 0,
    maxScore: 20,
    label: "大幅な乖離",
    description: "IssueとPRの関連性が不明、または大幅に異なる実装。",
  },
];

/**
 * 点数からPR整合性グレードを判定
 */
export function scoreToConsistencyGrade(score: number): ConsistencyGrade {
  if (score >= 81) return "A";
  if (score >= 61) return "B";
  if (score >= 41) return "C";
  if (score >= 21) return "D";
  return "E";
}

/**
 * PR整合性グレードの詳細情報を取得
 */
export function getConsistencyGradeInfo(grade: ConsistencyGrade): ConsistencyGradeCriterion | undefined {
  return CONSISTENCY_GRADE_CRITERIA.find((c) => c.grade === grade);
}

/**
 * 評価基準のバリデーション
 * - 速度基準が正しくソートされているか
 * - 品質チェック項目の重みの合計が100か
 * - 整合性チェック項目の重みの合計が100か
 */
export function validateCriteria(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 速度基準のバリデーション
  for (let i = 1; i < SPEED_CRITERIA.length; i++) {
    if (SPEED_CRITERIA[i].maxHours <= SPEED_CRITERIA[i - 1].maxHours) {
      errors.push(
        `速度基準のmaxHoursが正しくソートされていません: index ${i}`
      );
    }
  }

  // 品質チェック項目の重みの合計
  const qualityTotalWeight = QUALITY_CHECK_ITEMS.reduce(
    (sum, item) => sum + item.weight,
    0
  );
  if (qualityTotalWeight !== 100) {
    errors.push(
      `品質チェック項目の重みの合計が100ではありません: ${qualityTotalWeight}`
    );
  }

  // 整合性チェック項目の重みの合計
  const consistencyTotalWeight = CONSISTENCY_CHECK_ITEMS.reduce(
    (sum, item) => sum + item.weight,
    0
  );
  if (consistencyTotalWeight !== 100) {
    errors.push(
      `整合性チェック項目の重みの合計が100ではありません: ${consistencyTotalWeight}`
    );
  }

  return { valid: errors.length === 0, errors };
}
