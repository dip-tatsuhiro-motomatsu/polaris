/**
 * Vercel AI SDK を使用した AIClient 実装
 * プロバイダー（Gemini / OpenAI）を抽象化し、環境変数で切り替え可能
 */

import { generateText, type LanguageModel } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { AIClient, AIGenerateRequest, AIGenerateResponse, AIProvider } from "./types";

/**
 * プロバイダーに応じたモデルを取得
 */
function getModel(provider: AIProvider): LanguageModel {
  switch (provider) {
    case "gemini":
      return google("gemini-2.0-flash");
    case "openai":
      return openai("gpt-4o-mini");
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * メッセージからシステムメッセージとユーザー/アシスタントメッセージを分離
 */
function separateMessages(messages: AIGenerateRequest["messages"]): {
  system?: string;
  userMessages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const systemMessages = messages.filter((m) => m.role === "system");
  const otherMessages = messages.filter((m) => m.role !== "system");

  return {
    system: systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join("\n")
      : undefined,
    userMessages: otherMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  };
}

export class VercelAIClient implements AIClient {
  private model: LanguageModel;

  constructor(provider: AIProvider) {
    this.model = getModel(provider);
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const { system, userMessages } = separateMessages(request.messages);

    const result = await generateText({
      model: this.model,
      system,
      messages: userMessages,
      temperature: request.temperature ?? 0.3,
      maxOutputTokens: request.maxTokens ?? 2048,
    });

    return {
      content: result.text,
      usage: result.usage
        ? {
            promptTokens: result.usage.inputTokens ?? 0,
            completionTokens: result.usage.outputTokens ?? 0,
            totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
          }
        : undefined,
    };
  }

  async generateJSON<T>(request: AIGenerateRequest): Promise<T> {
    const { system, userMessages } = separateMessages(request.messages);

    // プロンプトにJSON出力指示を追加してgenerateTextを使用
    const jsonSystem = system
      ? `${system}\n\nIMPORTANT: You must respond with valid JSON only. No markdown formatting, no code blocks, just raw JSON.`
      : "IMPORTANT: You must respond with valid JSON only. No markdown formatting, no code blocks, just raw JSON.";

    const result = await generateText({
      model: this.model,
      system: jsonSystem,
      messages: userMessages,
      temperature: request.temperature ?? 0.3,
      maxOutputTokens: request.maxTokens ?? 2048,
    });

    const text = result.text;

    try {
      return JSON.parse(text) as T;
    } catch {
      // JSONパースに失敗した場合、テキストからJSON部分を抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      throw new Error(`Failed to parse JSON response: ${text}`);
    }
  }
}
