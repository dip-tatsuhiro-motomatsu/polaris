/**
 * Issue-PR整合性評価サービス
 * AIを使用してIssueとPRの整合性を評価
 */

import { getAIClient } from "@/lib/ai";
import { CONSISTENCY_CHECK_ITEMS, scoreToConsistencyGrade, getConsistencyGradeInfo } from "@/config/evaluation-criteria";
import type { PRConsistencyEvaluation, ConsistencyCategoryScore, ConsistencyGrade, LinkedPR } from "@/types/evaluation";

/**
 * AI評価レスポンスの型
 */
interface AIConsistencyResponse {
  categories: {
    categoryId: string;
    score: number;
    feedback: string;
  }[];
  overallFeedback: string;
  issueImprovementSuggestions: string[];
}

/**
 * 評価対象のIssue情報
 */
interface IssueForConsistencyEvaluation {
  number: number;
  title: string;
  body: string | null;
}

/**
 * 評価プロンプトを生成
 */
function buildConsistencyEvaluationPrompt(
  issue: IssueForConsistencyEvaluation,
  linkedPRs: LinkedPR[]
): string {
  const categoriesDescription = CONSISTENCY_CHECK_ITEMS.map((item) =>
    `- ${item.id} (${item.label}, ${item.weight}点満点): ${item.description}`
  ).join("\n");

  const prsDescription = linkedPRs.map((pr) => `
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
`).join("\n---\n");

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

## 出力形式
以下のJSON形式で出力してください:
{
  "categories": [
    {
      "categoryId": "issue-evaluability",
      "score": 0-20の整数,
      "feedback": "このカテゴリに対する具体的なフィードバック（日本語）"
    },
    {
      "categoryId": "requirement-coverage",
      "score": 0-30の整数,
      "feedback": "このカテゴリに対する具体的なフィードバック（日本語）"
    },
    {
      "categoryId": "scope-appropriateness",
      "score": 0-20の整数,
      "feedback": "このカテゴリに対する具体的なフィードバック（日本語）"
    },
    {
      "categoryId": "acceptance-criteria-achievement",
      "score": 0-20の整数,
      "feedback": "このカテゴリに対する具体的なフィードバック（日本語）"
    },
    {
      "categoryId": "pr-description-clarity",
      "score": 0-10の整数,
      "feedback": "このカテゴリに対する具体的なフィードバック（日本語）"
    }
  ],
  "overallFeedback": "全体的な評価コメント（日本語、2-3文）",
  "issueImprovementSuggestions": [
    "Issue記述の改善点1（日本語、Issue記述が不十分な場合のみ）",
    "Issue記述の改善点2（日本語、必要な場合のみ）"
  ]
}

重要:
- Issue記述が曖昧な場合は、その点を明確に指摘し、issueImprovementSuggestionsに改善提案を記載してください。
- 厳しめに評価してください。完璧な整合性でない限り満点は付けないでください。
- PRの変更内容（diff）をよく確認し、Issueの要件と照らし合わせてください。
- issueImprovementSuggestionsはIssue記述に問題がある場合のみ記載してください。問題がなければ空配列[]にしてください。`;
}

/**
 * Issue-PR整合性を評価
 */
export async function evaluateConsistency(
  issue: IssueForConsistencyEvaluation,
  linkedPRs: LinkedPR[]
): Promise<PRConsistencyEvaluation> {
  const aiClient = getAIClient();
  const prompt = buildConsistencyEvaluationPrompt(issue, linkedPRs);

  const response = await aiClient.generateJSON<AIConsistencyResponse>({
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
  const categories: ConsistencyCategoryScore[] = CONSISTENCY_CHECK_ITEMS.map((item) => {
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
  const grade = scoreToConsistencyGrade(totalScore);
  const gradeInfo = getConsistencyGradeInfo(grade);

  return {
    totalScore,
    grade,
    linkedPRs: linkedPRs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.url,
    })),
    categories,
    overallFeedback: response.overallFeedback || gradeInfo?.description || "",
    issueImprovementSuggestions: response.issueImprovementSuggestions || [],
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * PR整合性グレードの色を取得
 */
export function getConsistencyGradeColor(grade: ConsistencyGrade): string {
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
