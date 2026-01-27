/**
 * Issue記述品質評価サービス
 * AIを使用してIssueの記述品質を評価
 */

import { getAIClient } from "@/lib/ai";
import { QUALITY_CHECK_ITEMS, scoreToQualityGrade, getQualityGradeInfo } from "@/config/evaluation-criteria";
import type { IssueQualityEvaluation, QualityCategoryScore, QualityGrade } from "@/types/evaluation";

/**
 * AI評価レスポンスの型
 */
interface AIEvaluationResponse {
  categories: {
    categoryId: string;
    score: number;
    feedback: string;
  }[];
  overallFeedback: string;
  improvementSuggestions: string[];
}

/**
 * Issue情報の型
 */
interface IssueForEvaluation {
  number: number;
  title: string;
  body: string | null;
  assignee: string | null;
}

/**
 * 評価プロンプトを生成
 */
function buildEvaluationPrompt(issue: IssueForEvaluation): string {
  const categoriesDescription = QUALITY_CHECK_ITEMS.map((item) =>
    `- ${item.id} (${item.label}, ${item.weight}点満点): ${item.description}`
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

## 出力形式
以下のJSON形式で出力してください:
{
  "categories": [
    {
      "categoryId": "context-goal",
      "score": 0-25の整数,
      "feedback": "このカテゴリに対する具体的なフィードバック（日本語）"
    },
    {
      "categoryId": "implementation-details",
      "score": 0-25の整数,
      "feedback": "このカテゴリに対する具体的なフィードバック（日本語）"
    },
    {
      "categoryId": "acceptance-criteria",
      "score": 0-30の整数,
      "feedback": "このカテゴリに対する具体的なフィードバック（日本語）"
    },
    {
      "categoryId": "structure-clarity",
      "score": 0-20の整数,
      "feedback": "このカテゴリに対する具体的なフィードバック（日本語）"
    }
  ],
  "overallFeedback": "全体的な評価コメント（日本語、2-3文）",
  "improvementSuggestions": [
    "最も改善すべき点1（日本語、具体的なアクション）",
    "最も改善すべき点2（日本語、具体的なアクション）",
    "最も改善すべき点3（日本語、具体的なアクション）"
  ]
}

重要:
- 厳しめに評価してください。完璧なIssueでない限り満点は付けないでください。
- improvementSuggestionsは最も改善効果が高い順に最大3つ挙げてください。
- フィードバックは具体的で実行可能な内容にしてください。`;
}

/**
 * Issue記述品質を評価
 */
export async function evaluateIssueQuality(issue: IssueForEvaluation): Promise<IssueQualityEvaluation> {
  const aiClient = getAIClient();
  const prompt = buildEvaluationPrompt(issue);

  const response = await aiClient.generateJSON<AIEvaluationResponse>({
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
    maxTokens: 2048,
  });

  // カテゴリ別スコアを構築
  const categories: QualityCategoryScore[] = QUALITY_CHECK_ITEMS.map((item) => {
    const aiCategory = response.categories.find((c) => c.categoryId === item.id);
    return {
      categoryId: item.id,
      categoryName: item.label,
      score: aiCategory?.score ?? 0,
      maxScore: item.weight,
      feedback: aiCategory?.feedback ?? "評価できませんでした",
    };
  });

  // 合計スコアを計算
  const totalScore = categories.reduce((sum, cat) => sum + cat.score, 0);
  const grade = scoreToQualityGrade(totalScore);
  const gradeInfo = getQualityGradeInfo(grade);

  return {
    totalScore,
    grade,
    categories,
    overallFeedback: response.overallFeedback || gradeInfo?.description || "",
    improvementSuggestions: response.improvementSuggestions || [],
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * 品質グレードの色を取得
 */
export function getQualityGradeColor(grade: QualityGrade): string {
  switch (grade) {
    case "A":
      return "#22c55e"; // green
    case "B":
      return "#3b82f6"; // blue
    case "C":
      return "#eab308"; // yellow
    case "D":
      return "#f97316"; // orange
    case "E":
      return "#ef4444"; // red
  }
}
