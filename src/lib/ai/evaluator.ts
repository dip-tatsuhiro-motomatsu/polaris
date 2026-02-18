/**
 * Issue評価ロジック
 * T041: Issue評価ロジックを実装（プロンプト設計含む）
 */

import type { Issue } from "@/types/issue";
import type { EvaluationResult, QualityEvaluationDetail } from "@/types/evaluation";
import { QUALITY_CHECK_ITEMS, scoreToGrade } from "@/config/evaluation-criteria";
import type {
  AIProvider,
  IssueEvaluationRequest,
  AIProviderConfig,
} from "./interface";
import { OpenAIProvider } from "./openai";

/**
 * 品質評価結果（詳細付き）
 */
export interface QualityEvaluationResult extends EvaluationResult {
  details: Record<string, QualityEvaluationDetail>;
}

/**
 * AIプロバイダーを取得
 */
function getAIProvider(config?: Partial<AIProviderConfig>): AIProvider {
  const provider = config?.provider || process.env.AI_PROVIDER || "openai";

  switch (provider) {
    case "openai":
      return new OpenAIProvider(config);
    // 将来的にAnthropicなど他のプロバイダーを追加
    default:
      return new OpenAIProvider(config);
  }
}

/**
 * Issue記述品質を評価
 * @param issue 評価対象のIssue
 * @param aiConfig AIプロバイダー設定（オプション）
 * @returns 評価結果
 */
export async function evaluateIssueQuality(
  issue: Issue,
  aiConfig?: Partial<AIProviderConfig>
): Promise<QualityEvaluationResult> {
  const provider = getAIProvider(aiConfig);

  const request: IssueEvaluationRequest = {
    issueTitle: issue.title,
    issueBody: issue.body || "",
    hasAssignee: !!issue.assignee,
    checkItems: QUALITY_CHECK_ITEMS.map((item) => ({
      id: item.id,
      label: item.label,
      weight: item.weight,
    })),
  };

  try {
    const response = await provider.evaluateIssue(request);

    // 詳細を構築
    const details: Record<string, QualityEvaluationDetail> = {};
    for (const item of QUALITY_CHECK_ITEMS) {
      details[item.id] = {
        itemId: item.id,
        score: response.scores[item.id] || 0,
        maxScore: item.weight,
        feedback: response.feedback[item.id] || "評価できませんでした",
      };
    }

    const score = response.totalScore;
    const grade = scoreToGrade(score);

    // グレードに応じたメッセージを生成
    const message = generateQualityMessage(grade, score);

    return {
      score,
      grade,
      message,
      details,
      evaluatedAt: new Date(),
    };
  } catch (error) {
    console.error("AI evaluation failed:", error);

    // フォールバック: 基本的なルールベース評価
    return fallbackEvaluation(issue);
  }
}

/**
 * グレードに応じたメッセージを生成
 */
function generateQualityMessage(
  grade: "A" | "B" | "C" | "D" | "E",
  score: number
): string {
  switch (grade) {
    case "A":
      return `素晴らしい記述です！（${score}点）継続してください。`;
    case "B":
      return `良好な記述です（${score}点）。細部の改善でさらに良くなります。`;
    case "C":
      return `改善の余地があります（${score}点）。フィードバックを参考にしてください。`;
    case "D":
      return `大幅な改善が必要です（${score}点）。記述ガイドラインを確認してください。`;
    case "E":
      return `必須項目が不足しています（${score}点）。記述テンプレートを使用してください。`;
  }
}

/**
 * フォールバック評価（AIが利用できない場合）
 */
function fallbackEvaluation(issue: Issue): QualityEvaluationResult {
  const details: Record<string, QualityEvaluationDetail> = {};
  let totalScore = 0;

  for (const item of QUALITY_CHECK_ITEMS) {
    let score = 0;
    let feedback = "";

    switch (item.id) {
      case "user-story":
        // ユーザーストーリーパターンを検出
        if (issue.body) {
          const hasUserStory =
            /として.*したい|なぜなら|背景|目的/i.test(issue.body);
          score = hasUserStory ? Math.floor(item.weight * 0.6) : 0;
          feedback = hasUserStory
            ? "ユーザーストーリーらしき記述があります"
            : "ユーザーストーリーが見つかりません";
        } else {
          feedback = "本文がありません";
        }
        break;

      case "implementation":
        // 実装方針の記述を検出
        if (issue.body) {
          const hasImplementation =
            /実装|方針|アプローチ|設計|対応|修正|追加/i.test(issue.body);
          score = hasImplementation ? Math.floor(item.weight * 0.5) : 0;
          feedback = hasImplementation
            ? "実装に関する記述があります"
            : "実装方針が見つかりません";
        } else {
          feedback = "本文がありません";
        }
        break;

      case "concerns":
        // 懸念点の記述を検出
        if (issue.body) {
          const hasConcerns =
            /懸念|リスク|注意|課題|問題|検討/i.test(issue.body);
          score = hasConcerns ? Math.floor(item.weight * 0.5) : 0;
          feedback = hasConcerns
            ? "懸念点に関する記述があります"
            : "懸念点の記載がありません";
        } else {
          feedback = "本文がありません";
        }
        break;

      case "assignee":
        // 担当者の設定
        score = issue.assignee ? item.weight : 0;
        feedback = issue.assignee
          ? "担当者が設定されています"
          : "担当者が設定されていません";
        break;

      default:
        feedback = "評価項目が不明です";
    }

    details[item.id] = {
      itemId: item.id,
      score,
      maxScore: item.weight,
      feedback,
    };

    totalScore += score;
  }

  const grade = scoreToGrade(totalScore);

  return {
    score: totalScore,
    grade,
    message: `フォールバック評価（${totalScore}点）: AI評価が利用できないため、ルールベースで評価しました。`,
    details,
    evaluatedAt: new Date(),
  };
}

/**
 * 複数のIssueを一括評価
 * @param issues 評価対象のIssue配列
 * @param aiConfig AIプロバイダー設定（オプション）
 * @returns 評価結果の配列
 */
export async function evaluateIssuesQuality(
  issues: Issue[],
  aiConfig?: Partial<AIProviderConfig>
): Promise<Array<{ issue: Issue; evaluation: QualityEvaluationResult }>> {
  const results: Array<{ issue: Issue; evaluation: QualityEvaluationResult }> =
    [];

  // 並列実行だとレート制限に引っかかる可能性があるため、順次実行
  for (const issue of issues) {
    try {
      const evaluation = await evaluateIssueQuality(issue, aiConfig);
      results.push({ issue, evaluation });
    } catch (error) {
      console.error(`Failed to evaluate issue ${issue.number}:`, error);
      // エラーが発生した場合はフォールバック評価を使用
      const evaluation = fallbackEvaluation(issue);
      results.push({ issue, evaluation });
    }

    // レート制限対策: 各評価間に少し待機
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}
