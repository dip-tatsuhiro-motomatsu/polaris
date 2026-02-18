/**
 * EvaluationCriteria Value Object
 * 評価基準をドメイン層で定義
 */

/**
 * 評価カテゴリの定義
 */
export interface EvaluationCategory {
  id: string;
  label: string;
  weight: number;
  description: string;
}

/**
 * カテゴリスコア
 */
export interface CategoryScore {
  categoryId: string;
  score: number;
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 品質評価カテゴリ定義
 * weightの合計は100
 */
export const QUALITY_CATEGORIES: EvaluationCategory[] = [
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
 * 整合性評価カテゴリ定義
 * weightの合計は100
 */
export const CONSISTENCY_CATEGORIES: EvaluationCategory[] = [
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
 * 品質評価基準ドメインサービス
 */
export class QualityCriteria {
  /**
   * IDでカテゴリを取得
   */
  static getById(id: string): EvaluationCategory | undefined {
    return QUALITY_CATEGORIES.find((c) => c.id === id);
  }

  /**
   * 全カテゴリを取得
   */
  static getAll(): EvaluationCategory[] {
    return [...QUALITY_CATEGORIES];
  }

  /**
   * カテゴリスコアのバリデーション
   */
  static validateCategoryScores(scores: CategoryScore[]): ValidationResult {
    const errors: string[] = [];

    for (const score of scores) {
      const category = this.getById(score.categoryId);

      if (!category) {
        errors.push(`不明なカテゴリID: ${score.categoryId}`);
        continue;
      }

      if (score.score < 0) {
        errors.push(`${score.categoryId}: スコアは0以上である必要があります`);
      }

      if (score.score > category.weight) {
        errors.push(`${score.categoryId}: スコア(${score.score})が最大値(${category.weight})を超えています`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * 整合性評価基準ドメインサービス
 */
export class ConsistencyCriteria {
  /**
   * IDでカテゴリを取得
   */
  static getById(id: string): EvaluationCategory | undefined {
    return CONSISTENCY_CATEGORIES.find((c) => c.id === id);
  }

  /**
   * 全カテゴリを取得
   */
  static getAll(): EvaluationCategory[] {
    return [...CONSISTENCY_CATEGORIES];
  }

  /**
   * カテゴリスコアのバリデーション
   */
  static validateCategoryScores(scores: CategoryScore[]): ValidationResult {
    const errors: string[] = [];

    for (const score of scores) {
      const category = this.getById(score.categoryId);

      if (!category) {
        errors.push(`不明なカテゴリID: ${score.categoryId}`);
        continue;
      }

      if (score.score < 0) {
        errors.push(`${score.categoryId}: スコアは0以上である必要があります`);
      }

      if (score.score > category.weight) {
        errors.push(`${score.categoryId}: スコア(${score.score})が最大値(${category.weight})を超えています`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
