/**
 * AIプロバイダー抽象化レイヤー
 * Vercel AI SDKを使用して複数のLLMプロバイダーを統一的に扱う
 */

import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export type AIProviderType = "google" | "openai" | "anthropic";

/**
 * 環境変数からAIプロバイダーを取得
 */
export function getAIProvider(): AIProviderType {
  const provider = process.env.AI_PROVIDER as AIProviderType | undefined;
  return provider ?? "google";
}

/**
 * AIモデルを取得
 * 環境変数AI_PROVIDERに基づいて適切なモデルを返す
 */
export function getModel(): LanguageModel {
  const provider = getAIProvider();

  switch (provider) {
    case "google": {
      const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
      return google(modelName);
    }

    case "openai": {
      // 将来的にOpenAI実装を追加
      // const modelName = process.env.OPENAI_MODEL ?? "gpt-4o";
      // return openai(modelName);
      throw new Error("OpenAI provider is not yet implemented. Install @ai-sdk/openai first.");
    }

    case "anthropic": {
      // 将来的にAnthropic実装を追加
      // const modelName = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022";
      // return anthropic(modelName);
      throw new Error("Anthropic provider is not yet implemented. Install @ai-sdk/anthropic first.");
    }

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * AIプロバイダーの設定を取得
 */
export function getAIConfig() {
  return {
    provider: getAIProvider(),
    temperature: Number(process.env.AI_TEMPERATURE ?? 0.3),
    maxTokens: Number(process.env.AI_MAX_TOKENS ?? 2048),
  };
}
