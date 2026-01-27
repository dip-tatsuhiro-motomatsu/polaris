/**
 * Gemini API クライアント実装
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIClient, AIGenerateRequest, AIGenerateResponse, AIMessage } from "./types";

export class GeminiClient implements AIClient {
  private client: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "gemini-2.0-flash") {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  /**
   * Gemini用にメッセージを変換
   */
  private convertMessages(messages: AIMessage[]): { systemInstruction?: string; contents: { role: string; parts: { text: string }[] }[] } {
    const systemMessages = messages.filter((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    const systemInstruction = systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join("\n")
      : undefined;

    const contents = otherMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    return { systemInstruction, contents };
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const { systemInstruction, contents } = this.convertMessages(request.messages);

    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction,
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 2048,
      },
    });

    const result = await model.generateContent({ contents });
    const response = result.response;
    const text = response.text();

    return {
      content: text,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }

  async generateJSON<T>(request: AIGenerateRequest): Promise<T> {
    const { systemInstruction, contents } = this.convertMessages(request.messages);

    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction,
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 2048,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent({ contents });
    const response = result.response;
    const text = response.text();

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
