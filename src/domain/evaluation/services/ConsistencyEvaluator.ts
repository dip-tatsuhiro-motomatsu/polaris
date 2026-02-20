/**
 * ConsistencyEvaluator ドメインサービス
 * Issue-PR整合性をAIで評価し、ドメインロジックでスコア・グレードを計算
 */

import { type IAIService, getAIService } from "@/infrastructure/external/ai";
import { QualityScore } from "../value-objects/QualityScore";
import { ConsistencyGrade } from "../value-objects/ConsistencyGrade";
import { CONSISTENCY_CATEGORIES } from "../value-objects/EvaluationCriteria";
import { ConsistencyEvaluationResponseSchema, type ConsistencyEvaluationResponse } from "../schemas";
import type { LinkedPR } from "@/types/evaluation";

/**
 * 評価対象のIssue情報
 */
export interface IssueForConsistencyEvaluation {
  number: number;
  title: string;
  body: string | null;
}

/**
 * カテゴリ別評価結果
 */
export interface ConsistencyCategoryResult {
  categoryId: string;
  categoryName: string;
  score: number;
  maxScore: number;
  feedback: string;
}

/**
 * 整合性評価結果
 */
export interface ConsistencyEvaluationResult {
  totalScore: QualityScore;
  grade: ConsistencyGrade;
  linkedPRs: { number: number; title: string; url: string }[];
  categories: ConsistencyCategoryResult[];
  overallFeedback: string;
  issueImprovementSuggestions: string[];
  evaluatedAt: string;
}

export class ConsistencyEvaluator {
  private aiService: IAIService;

  constructor(aiService?: IAIService) {
    this.aiService = aiService ?? getAIService();
  }

  /**
   * Issue-PRの整合性を評価
   */
  async evaluate(
    issue: IssueForConsistencyEvaluation,
    linkedPRs: LinkedPR[]
  ): Promise<ConsistencyEvaluationResult> {
    const prompt = this.buildPrompt(issue, linkedPRs);

    // AIからカテゴリ別スコアを取得（抽象レイヤー経由）
    const aiResponse = await this.aiService.generateStructuredOutput({
      schema: ConsistencyEvaluationResponseSchema,
      prompt,
    });

    // ドメインロジックでスコア計算・グレード判定
    return this.calculateEvaluation(aiResponse, linkedPRs);
  }

  /**
   * AIレスポンスから評価結果を計算（ドメインロジック）
   */
  private calculateEvaluation(
    aiResponse: ConsistencyEvaluationResponse,
    linkedPRs: LinkedPR[]
  ): ConsistencyEvaluationResult {
    // カテゴリ別スコアを構築
    const categories: ConsistencyCategoryResult[] = CONSISTENCY_CATEGORIES.map((category) => {
      const aiCategory = aiResponse.categories.find((c) => c.categoryId === category.id);
      return {
        categoryId: category.id,
        categoryName: category.label,
        score: aiCategory?.score ?? 0,
        maxScore: category.weight,
        feedback: aiCategory?.feedback ?? "評価できませんでした",
      };
    });

    // 合計スコアを計算（ドメインValue Objectを使用）
    const totalScore = QualityScore.fromCategoryScores(
      categories.map((c) => ({ score: c.score, maxScore: c.maxScore }))
    );

    // グレードを判定
    const grade = ConsistencyGrade.fromScore(totalScore.value);

    return {
      totalScore,
      grade,
      linkedPRs: linkedPRs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        url: pr.url,
      })),
      categories,
      overallFeedback: aiResponse.overallFeedback,
      issueImprovementSuggestions: aiResponse.issueImprovementSuggestions,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * 評価プロンプトを生成
   */
  private buildPrompt(issue: IssueForConsistencyEvaluation, linkedPRs: LinkedPR[]): string {
    const categoriesDescription = CONSISTENCY_CATEGORIES.map(
      (item) => `- ${item.id} (${item.label}, ${item.weight}点満点): ${item.description}`
    ).join("\n");

    const prsDescription = linkedPRs
      .map(
        (pr) => `
### PR #${pr.number}: ${pr.title}
- URL: ${pr.url}
- 変更ファイル数: ${pr.changedFiles.length}
- 追加行数: ${pr.additions}, 削除行数: ${pr.deletions}
- マージ日時: ${pr.mergedAt}

#### PR説明
${pr.body || "(説明なし)"}

#### 変更内容（diff）
\`\`\`
${pr.diff || "(diffなし)"}
\`\`\`
`
      )
      .join("\n---\n");

    return `あなたはソフトウェア開発チームのコードレビュー担当者です。
以下のGitHub IssueとそれにリンクされたPRの整合性を評価してください。

## 評価カテゴリと配点
${categoriesDescription}

## 評価対象Issue
- Issue番号: #${issue.number}
- タイトル: ${issue.title}
- 本文:
${issue.body || "(本文なし)"}

## リンクされたPR（全${linkedPRs.length}件）
${prsDescription}

## 評価基準

### Issue記述の評価可能性（20点満点）
- Issueの要件が明確に記述されているか
- PRの実装が要件を満たしているか判断できる程度の情報があるか
- **曖昧な場合は減点し、issueImprovementSuggestionsに改善点を記載**

### 要件網羅性（30点満点）
- Issueに記載された全ての要件がPRで実装されているか
- 未実装の要件がある場合は具体的に指摘

### 実装範囲の適切さ（20点満点）
- 要件外の実装（スコープクリープ）がないか
- PRがIssueの範囲を超えていないか

### 受け入れ条件の達成（20点満点）
- Issueに受け入れ条件がある場合、それを満たしているか
- **受け入れ条件が不明確な場合はその旨を指摘し、issueImprovementSuggestionsに記載**

### 変更説明の明確さ（10点満点）
- PR説明がIssueとの関連を明確にしているか
- 変更内容が適切に説明されているか

重要:
- Issue記述が曖昧な場合は、その点を明確に指摘し、issueImprovementSuggestionsに改善提案を記載してください。
- 厳しめに評価してください。完璧な整合性でない限り満点は付けないでください。
- PRの変更内容（diff）をよく確認し、Issueの要件と照らし合わせてください。
- issueImprovementSuggestionsはIssue記述に問題がある場合のみ記載してください。問題がなければ空配列[]にしてください。`;
  }
}
