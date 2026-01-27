/**
 * AIクライアントファクトリー
 * 環境変数に基づいて適切なAIクライアントを生成
 */

import type { AIClient, AIProvider } from "./types";
import { GeminiClient } from "./gemini-client";

/**
 * AIクライアントを生成
 * 将来的にOpenAI、Anthropic等を追加する場合はここに実装を追加
 */
export function createAIClient(provider?: AIProvider): AIClient {
  const selectedProvider = provider ?? (process.env.AI_PROVIDER as AIProvider) ?? "gemini";

  switch (selectedProvider) {
    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
      }
      return new GeminiClient(apiKey);
    }

    case "openai": {
      // 将来的にOpenAI実装を追加
      // const apiKey = process.env.OPENAI_API_KEY;
      // if (!apiKey) {
      //   throw new Error("OPENAI_API_KEY is not set");
      // }
      // return new OpenAIClient(apiKey);
      throw new Error("OpenAI provider is not yet implemented");
    }

    case "anthropic": {
      // 将来的にAnthropic実装を追加
      // const apiKey = process.env.ANTHROPIC_API_KEY;
      // if (!apiKey) {
      //   throw new Error("ANTHROPIC_API_KEY is not set");
      // }
      // return new AnthropicClient(apiKey);
      throw new Error("Anthropic provider is not yet implemented");
    }

    default:
      throw new Error(`Unknown AI provider: ${selectedProvider}`);
  }
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
