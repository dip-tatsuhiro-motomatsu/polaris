/**
 * Vercel AI SDKを使用したAIサービス実装
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { IAIService, AIServiceOptions, AIServiceConfig } from "./types";

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: Required<Omit<AIServiceConfig, "model">> & Pick<AIServiceConfig, "model"> = {
  provider: "google",
  model: undefined,
  defaultTemperature: 0.3,
  defaultMaxTokens: 2048,
};

/**
 * Vercel AI SDKを使用したAIサービス実装
 */
export class VercelAIService implements IAIService {
  private config: Required<Omit<AIServiceConfig, "model">> & Pick<AIServiceConfig, "model">;

  constructor(config?: Partial<AIServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 構造化出力を生成
   */
  async generateStructuredOutput<T>(options: AIServiceOptions<T>): Promise<T> {
    const { schema, prompt, temperature, maxTokens } = options;

    const model = this.getModel();
    const { object } = await generateObject({
      model,
      schema,
      prompt,
      temperature: temperature ?? this.config.defaultTemperature,
      maxTokens: maxTokens ?? this.config.defaultMaxTokens,
    });

    return object;
  }

  /**
   * プロバイダーに応じたモデルを取得
   */
  private getModel(): LanguageModel {
    switch (this.config.provider) {
      case "google": {
        const modelName = this.config.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
        return google(modelName);
      }

      case "openai":
        throw new Error("OpenAI provider is not yet implemented. Install @ai-sdk/openai first.");

      case "anthropic":
        throw new Error("Anthropic provider is not yet implemented. Install @ai-sdk/anthropic first.");

      default:
        throw new Error(`Unknown AI provider: ${this.config.provider}`);
    }
  }
}

/**
 * AIサービスのシングルトンインスタンス
 */
let aiServiceInstance: IAIService | null = null;

/**
 * AIサービスを取得（シングルトン）
 */
export function getAIService(): IAIService {
  if (!aiServiceInstance) {
    const provider = (process.env.AI_PROVIDER as AIServiceConfig["provider"]) ?? "google";
    aiServiceInstance = new VercelAIService({ provider });
  }
  return aiServiceInstance;
}

/**
 * AIサービスを設定（テスト用）
 */
export function setAIService(service: IAIService): void {
  aiServiceInstance = service;
}

/**
 * AIサービスをリセット（テスト用）
 */
export function resetAIService(): void {
  aiServiceInstance = null;
}
