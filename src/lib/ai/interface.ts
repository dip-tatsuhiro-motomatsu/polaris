/**
 * AI抽象化インターフェース
 * T039: AI抽象化インターフェースを定義
 *
 * 将来的なLLMプロバイダー変更に対応するための抽象化レイヤー（FR-008）
 */

/**
 * 評価チェック項目
 */
export interface CheckItem {
  id: string;
  label: string;
  weight: number;
}

/**
 * Issue評価リクエスト
 */
export interface IssueEvaluationRequest {
  /** Issueタイトル */
  issueTitle: string;
  /** Issue本文 */
  issueBody: string;
  /** 担当者が設定されているか */
  hasAssignee: boolean;
  /** 評価チェック項目 */
  checkItems: CheckItem[];
}

/**
 * Issue評価レスポンス
 */
export interface IssueEvaluationResponse {
  /** 各項目のスコア（0〜weight） */
  scores: Record<string, number>;
  /** 合計スコア */
  totalScore: number;
  /** 各項目のフィードバック */
  feedback: Record<string, string>;
  /** 全体フィードバック */
  overallFeedback: string;
}

/**
 * Issue-PR整合性評価リクエスト
 */
export interface ConsistencyEvaluationRequest {
  /** Issueタイトル */
  issueTitle: string;
  /** Issue本文 */
  issueBody: string;
  /** PRタイトル */
  prTitle: string;
  /** PR本文 */
  prBody: string;
  /** PRの変更ファイル一覧 */
  changedFiles?: string[];
}

/**
 * Issue-PR整合性評価レスポンス
 */
export interface ConsistencyEvaluationResponse {
  /** 整合性スコア（0-100） */
  consistencyScore: number;
  /** 改善提案 */
  suggestions: string[];
  /** 全体フィードバック */
  overallFeedback: string;
}

/**
 * AIプロバイダーインターフェース
 *
 * OpenAI, Claude, その他のLLMプロバイダーはこのインターフェースを実装する
 */
export interface AIProvider {
  /**
   * Issue記述品質を評価
   * @param request 評価リクエスト
   * @returns 評価レスポンス
   */
  evaluateIssue(request: IssueEvaluationRequest): Promise<IssueEvaluationResponse>;

  /**
   * Issue-PR整合性を評価（オプション）
   * @param request 評価リクエスト
   * @returns 評価レスポンス
   */
  evaluateConsistency?(
    request: ConsistencyEvaluationRequest
  ): Promise<ConsistencyEvaluationResponse>;
}

/**
 * AIプロバイダーの設定
 */
export interface AIProviderConfig {
  /** プロバイダー種別 */
  provider: "openai" | "anthropic" | "mock";
  /** APIキー */
  apiKey?: string;
  /** モデル名 */
  model?: string;
  /** タイムアウト（ミリ秒） */
  timeout?: number;
}

/**
 * デフォルトのAI設定
 */
export const DEFAULT_AI_CONFIG: AIProviderConfig = {
  provider: "openai",
  model: "gpt-4o-mini",
  timeout: 30000,
};
