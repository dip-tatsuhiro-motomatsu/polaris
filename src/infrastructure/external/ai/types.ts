/**
 * AIサービス抽象レイヤーの型定義
 * 外部AI APIとの接点を抽象化し、依存性注入を可能にする
 */

import type { z } from "zod";

/**
 * AIサービスのオプション
 */
export interface AIServiceOptions<T> {
  /** Zodスキーマ（構造化出力の型定義） */
  schema: z.ZodSchema<T>;
  /** プロンプト */
  prompt: string;
  /** 温度パラメータ（0-1、デフォルト: 0.3） */
  temperature?: number;
  /** 最大トークン数 */
  maxTokens?: number;
}

/**
 * AIサービスインターフェース
 * LLMプロバイダーを抽象化し、依存性注入を可能にする
 */
export interface IAIService {
  /**
   * 構造化出力を生成
   * @param options - 生成オプション（スキーマ、プロンプト等）
   * @returns スキーマに従った構造化データ
   */
  generateStructuredOutput<T>(options: AIServiceOptions<T>): Promise<T>;
}

/**
 * AIサービスの設定
 */
export interface AIServiceConfig {
  /** プロバイダー種別 */
  provider: "google" | "openai" | "anthropic";
  /** モデル名 */
  model?: string;
  /** デフォルト温度 */
  defaultTemperature?: number;
  /** デフォルト最大トークン数 */
  defaultMaxTokens?: number;
}
