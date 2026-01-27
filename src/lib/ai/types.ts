/**
 * AI API抽象化レイヤーの型定義
 * GPT、Gemini等への切り替えを容易にするためのインターフェース
 */

/**
 * AIへのメッセージ
 */
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * AI生成リクエスト
 */
export interface AIGenerateRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
}

/**
 * AI生成レスポンス
 */
export interface AIGenerateResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * AIクライアントインターフェース
 * 各AIプロバイダーはこのインターフェースを実装する
 */
export interface AIClient {
  /**
   * テキスト生成
   */
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;

  /**
   * JSON形式でのレスポンスを期待するテキスト生成
   */
  generateJSON<T>(request: AIGenerateRequest): Promise<T>;
}

/**
 * AIプロバイダーの種類
 */
export type AIProvider = "gemini" | "openai" | "anthropic";
