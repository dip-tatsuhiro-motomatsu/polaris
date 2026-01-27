/**
 * OpenAI AIプロバイダー実装
 * T040: OpenAI実装を作成
 */

import OpenAI from "openai";
import type {
  AIProvider,
  IssueEvaluationRequest,
  IssueEvaluationResponse,
  ConsistencyEvaluationRequest,
  ConsistencyEvaluationResponse,
  AIProviderConfig,
} from "./interface";

/**
 * OpenAI AIプロバイダー
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(config?: Partial<AIProviderConfig>) {
    const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OpenAI APIキーが設定されていません");
    }

    this.client = new OpenAI({
      apiKey,
      timeout: config?.timeout || 30000,
    });

    this.model = config?.model || "gpt-4o-mini";
  }

  /**
   * Issue記述品質を評価
   */
  async evaluateIssue(
    request: IssueEvaluationRequest
  ): Promise<IssueEvaluationResponse> {
    const systemPrompt = this.buildIssueEvaluationSystemPrompt(request);
    const userPrompt = this.buildIssueEvaluationUserPrompt(request);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("AIからの応答がありません");
    }

    return this.parseIssueEvaluationResponse(content, request);
  }

  /**
   * Issue-PR整合性を評価
   */
  async evaluateConsistency(
    request: ConsistencyEvaluationRequest
  ): Promise<ConsistencyEvaluationResponse> {
    const systemPrompt = this.buildConsistencyEvaluationSystemPrompt();
    const userPrompt = this.buildConsistencyEvaluationUserPrompt(request);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("AIからの応答がありません");
    }

    return this.parseConsistencyEvaluationResponse(content);
  }

  /**
   * Issue評価用のシステムプロンプトを構築
   */
  private buildIssueEvaluationSystemPrompt(
    request: IssueEvaluationRequest
  ): string {
    const checkItemsDescription = request.checkItems
      .map(
        (item) =>
          `- ${item.id}: ${item.label}（最大${item.weight}点）`
      )
      .join("\n");

    return `あなたはGitHub Issueの記述品質を評価するアシスタントです。

以下の評価項目に基づいて、Issueの記述品質を評価してください：

${checkItemsDescription}

評価基準：
- ユーザーストーリーの有無と質: 「〇〇として、△△したい。なぜなら□□だから」形式で明確に記述されているか
- 実装方針の記載: どのように実装するかの方針が具体的に記載されているか（技術的アプローチ、影響範囲など）
- 懸念点の記載: 実装にあたっての懸念点やリスク、検討事項が記載されているか
- assigneeの設定: 担当者が設定されているかどうか（これは入力で与えられます）

必ずJSON形式で回答してください。フォーマット：
{
  "scores": {
    "項目ID": スコア（0〜最大点）,
    ...
  },
  "feedback": {
    "項目ID": "フィードバックコメント",
    ...
  },
  "overallFeedback": "全体的なフィードバック"
}`;
  }

  /**
   * Issue評価用のユーザープロンプトを構築
   */
  private buildIssueEvaluationUserPrompt(
    request: IssueEvaluationRequest
  ): string {
    const assigneeInfo = request.hasAssignee
      ? "担当者: 設定されています"
      : "担当者: 設定されていません";

    return `以下のIssueを評価してください：

## タイトル
${request.issueTitle}

## 本文
${request.issueBody || "（本文なし）"}

## 担当者情報
${assigneeInfo}

JSON形式で評価結果を返してください。`;
  }

  /**
   * Issue評価レスポンスをパース
   */
  private parseIssueEvaluationResponse(
    content: string,
    request: IssueEvaluationRequest
  ): IssueEvaluationResponse {
    try {
      const parsed = JSON.parse(content);

      // assignee項目を自動計算（AIではなくシステムで判定）
      const assigneeItem = request.checkItems.find(
        (item) => item.id === "assignee"
      );
      if (assigneeItem) {
        parsed.scores["assignee"] = request.hasAssignee
          ? assigneeItem.weight
          : 0;
        parsed.feedback["assignee"] = request.hasAssignee
          ? "担当者が設定されています"
          : "担当者が設定されていません。Issueに担当者を設定してください。";
      }

      // スコアを各項目の最大値でクランプ
      for (const item of request.checkItems) {
        if (parsed.scores[item.id] !== undefined) {
          parsed.scores[item.id] = Math.max(
            0,
            Math.min(item.weight, parsed.scores[item.id])
          );
        } else {
          parsed.scores[item.id] = 0;
          parsed.feedback[item.id] = "評価できませんでした";
        }
      }

      // 合計スコアを計算
      const totalScore = Object.values(parsed.scores as Record<string, number>).reduce(
        (sum: number, score: number) => sum + score,
        0
      );

      return {
        scores: parsed.scores,
        totalScore,
        feedback: parsed.feedback,
        overallFeedback: parsed.overallFeedback || "評価完了",
      };
    } catch (error) {
      console.error("Failed to parse AI response:", content, error);
      throw new Error("AIの応答をパースできませんでした");
    }
  }

  /**
   * 整合性評価用のシステムプロンプトを構築
   */
  private buildConsistencyEvaluationSystemPrompt(): string {
    return `あなたはGitHub IssueとPull Requestの整合性を評価するアシスタントです。

IssueとPRの内容を比較し、以下の観点で整合性を評価してください：

1. PRがIssueの要件を満たしているか
2. PRの変更内容がIssueの範囲内か
3. 実装がIssueの目的に沿っているか

必ずJSON形式で回答してください。フォーマット：
{
  "consistencyScore": 0-100のスコア,
  "suggestions": ["改善提案1", "改善提案2", ...],
  "overallFeedback": "全体的なフィードバック"
}`;
  }

  /**
   * 整合性評価用のユーザープロンプトを構築
   */
  private buildConsistencyEvaluationUserPrompt(
    request: ConsistencyEvaluationRequest
  ): string {
    const changedFilesInfo = request.changedFiles
      ? `\n## 変更ファイル\n${request.changedFiles.join("\n")}`
      : "";

    return `以下のIssueとPRの整合性を評価してください：

## Issue
### タイトル
${request.issueTitle}

### 本文
${request.issueBody || "（本文なし）"}

## Pull Request
### タイトル
${request.prTitle}

### 本文
${request.prBody || "（本文なし）"}
${changedFilesInfo}

JSON形式で評価結果を返してください。`;
  }

  /**
   * 整合性評価レスポンスをパース
   */
  private parseConsistencyEvaluationResponse(
    content: string
  ): ConsistencyEvaluationResponse {
    try {
      const parsed = JSON.parse(content);

      return {
        consistencyScore: Math.max(
          0,
          Math.min(100, parsed.consistencyScore || 0)
        ),
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
        overallFeedback: parsed.overallFeedback || "評価完了",
      };
    } catch (error) {
      console.error("Failed to parse AI response:", content, error);
      throw new Error("AIの応答をパースできませんでした");
    }
  }
}
