/**
 * AIクライアントファクトリー
 * 環境変数に基づいて適切なAIクライアントを生成
 * Vercel AI SDK を使用し、Gemini / OpenAI を切り替え可能
 */

import type { AIClient, AIProvider } from "./types";
import { VercelAIClient } from "./vercel-ai-client";

/**
 * プロバイダーに応じたAPIキーの環境変数名
 */
const API_KEY_ENV_VARS: Record<string, string> = {
  gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
  openai: "OPENAI_API_KEY",
};

/**
 * AIプロバイダーのAPIキーが設定されているか確認
 */
export function isAIConfigured(): boolean {
  const provider = (process.env.AI_PROVIDER as AIProvider) ?? "gemini";
  const envVar = API_KEY_ENV_VARS[provider];
  return !!envVar && !!process.env[envVar];
}

/**
 * AIクライアントを生成
 */
export function createAIClient(provider?: AIProvider): AIClient {
  const selectedProvider = provider ?? (process.env.AI_PROVIDER as AIProvider) ?? "gemini";

  const envVar = API_KEY_ENV_VARS[selectedProvider];
  if (!envVar) {
    throw new Error(`Unknown AI provider: ${selectedProvider}`);
  }

  if (!process.env[envVar]) {
    throw new Error(`${envVar} is not set`);
  }

  return new VercelAIClient(selectedProvider);
}

/**
 * デフォルトのAIクライアントインスタンス
 * 遅延初期化でシングルトンパターン
 */
let defaultClient: AIClient | null = null;

export function getAIClient(): AIClient {
  if (!defaultClient) {
    defaultClient = createAIClient();
  }
  return defaultClient;
}
