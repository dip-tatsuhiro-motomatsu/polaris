/**
 * QualityEvaluator ドメインサービス
 * Issue記述品質をAIで評価し、ドメインロジックでスコア・グレードを計算
 */

import { generateObject } from "ai";
import { getModel, getAIConfig } from "@/lib/ai/provider";
import { QualityScore } from "../value-objects/QualityScore";
import { QualityGrade } from "../value-objects/QualityGrade";
import { QUALITY_CATEGORIES } from "../value-objects/EvaluationCriteria";
import { QualityEvaluationResponseSchema, type QualityEvaluationResponse } from "../schemas";

/**
 * 評価対象のIssue情報
 */
export interface IssueForEvaluation {
  number: number;
  title: string;
  body: string | null;
  assignee: string | null;
}

/**
 * カテゴリ別評価結果
 */
export interface CategoryEvaluationResult {
  categoryId: string;
  categoryName: string;
  score: number;
  maxScore: number;
  feedback: string;
}

/**
 * 品質評価結果
 */
export interface QualityEvaluationResult {
  totalScore: QualityScore;
  grade: QualityGrade;
  categories: CategoryEvaluationResult[];
  overallFeedback: string;
  improvementSuggestions: string[];
  evaluatedAt: string;
}

export class QualityEvaluator {
  /**
   * Issueの品質を評価
   */
  async evaluate(issue: IssueForEvaluation): Promise<QualityEvaluationResult> {
    const config = getAIConfig();
    const prompt = this.buildPrompt(issue);

    // AIからカテゴリ別スコアを取得
    const { object: aiResponse } = await generateObject({
      model: getModel(),
      schema: QualityEvaluationResponseSchema,
      prompt,
      temperature: config.temperature,
    });

    // ドメインロジックでスコア計算・グレード判定
    return this.calculateEvaluation(aiResponse);
  }

  /**
   * AIレスポンスから評価結果を計算（ドメインロジック）
   */
  private calculateEvaluation(aiResponse: QualityEvaluationResponse): QualityEvaluationResult {
    // カテゴリ別スコアを構築
    const categories: CategoryEvaluationResult[] = QUALITY_CATEGORIES.map((category) => {
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

    // グレードを判定（ドメインValue Objectを使用）
    const grade = totalScore.toGrade();

    return {
      totalScore,
      grade,
      categories,
      overallFeedback: aiResponse.overallFeedback,
      improvementSuggestions: aiResponse.improvementSuggestions,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * 評価プロンプトを生成
   */
  private buildPrompt(issue: IssueForEvaluation): string {
    const categoriesDescription = QUALITY_CATEGORIES.map(
      (item) => `- ${item.id} (${item.label}, ${item.weight}点満点): ${item.description}`
    ).join("\n");

    return `あなたはソフトウェア開発チームのIssue品質評価者です。
以下のGitHub Issueの記述品質を評価してください。

## 評価カテゴリと配点
${categoriesDescription}

## 評価対象Issue
- Issue番号: #${issue.number}
- タイトル: ${issue.title}
- 担当者: ${issue.assignee || "未設定"}
- 本文:
${issue.body || "(本文なし)"}

## 評価基準
各カテゴリについて、0〜満点の範囲でスコアを付けてください。

### Context & Goal（背景と目的）25点満点
- 背景 (Background): 現状の課題や、このIssueが発生した経緯が書かれているか
- 目的 (Objective): この変更によって、ユーザーやシステムにどのような価値があるか
- 優先度: なぜ「今」やる必要があるかの根拠があるか

### Implementation Details（実装詳細・要件）25点満点
- 要件定義: 必要な機能変更が箇条書きなどでリスト化されているか
- 技術的な制約: 影響範囲の検討や、使用すべきライブラリ、避けるべき手法などが明記されているか
- 参考リンク: 関連するコードへのリンク、ドキュメント、FigmaのURLなどがあるか

### Acceptance Criteria（受け入れ条件）30点満点 ※最重要
- チェックリスト形式: [ ] 形式で、完了条件が具体的に書かれているか
- テスト要件: 正常系だけでなく、異常系やエッジケースの挙動が定義されているか
- 計測可能性: 「早くなる」ではなく「レスポンスが200ms以内になる」といった具体的な基準があるか

### Structure & Clarity（構造と読みやすさ）20点満点
- Markdownの活用: 見出し、太字、コードブロックが適切に使われているか
- 図解・画像: 必要に応じてスクリーンショットやシーケンス図があるか
- 簡潔さ: 冗長すぎず、必要な情報が凝縮されているか

重要:
- 厳しめに評価してください。完璧なIssueでない限り満点は付けないでください。
- improvementSuggestionsは最も改善効果が高い順に最大3つ挙げてください。
- フィードバックは具体的で実行可能な内容にしてください。`;
  }
}
