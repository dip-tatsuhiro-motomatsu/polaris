/**
 * AIサービス抽象レイヤーのテスト
 * 外部AI APIとの接点を抽象化
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { IAIService, AIServiceOptions } from "@/infrastructure/external/ai/types";

// テスト用のスキーマ
const TestResponseSchema = z.object({
  score: z.number(),
  feedback: z.string(),
});
type TestResponse = z.infer<typeof TestResponseSchema>;

// モック実装
function createMockAIService(response: TestResponse): IAIService {
  return {
    generateStructuredOutput: vi.fn().mockResolvedValue(response),
  };
}

describe("IAIService Interface", () => {
  describe("generateStructuredOutput", () => {
    it("スキーマに従った構造化出力を返す", async () => {
      const mockResponse: TestResponse = {
        score: 85,
        feedback: "良好な品質です",
      };

      const service = createMockAIService(mockResponse);

      const result = await service.generateStructuredOutput({
        schema: TestResponseSchema,
        prompt: "テストプロンプト",
      });

      expect(result.score).toBe(85);
      expect(result.feedback).toBe("良好な品質です");
    });

    it("temperatureオプションを渡せる", async () => {
      const mockResponse: TestResponse = { score: 50, feedback: "OK" };
      const service = createMockAIService(mockResponse);

      await service.generateStructuredOutput({
        schema: TestResponseSchema,
        prompt: "テストプロンプト",
        temperature: 0.5,
      });

      expect(service.generateStructuredOutput).toHaveBeenCalledWith({
        schema: TestResponseSchema,
        prompt: "テストプロンプト",
        temperature: 0.5,
      });
    });

    it("maxTokensオプションを渡せる", async () => {
      const mockResponse: TestResponse = { score: 50, feedback: "OK" };
      const service = createMockAIService(mockResponse);

      await service.generateStructuredOutput({
        schema: TestResponseSchema,
        prompt: "テストプロンプト",
        maxTokens: 1024,
      });

      expect(service.generateStructuredOutput).toHaveBeenCalledWith({
        schema: TestResponseSchema,
        prompt: "テストプロンプト",
        maxTokens: 1024,
      });
    });
  });
});

describe("AIServiceOptions", () => {
  it("必須フィールドが正しく定義されている", () => {
    const options: AIServiceOptions<TestResponse> = {
      schema: TestResponseSchema,
      prompt: "テスト",
    };

    expect(options.schema).toBeDefined();
    expect(options.prompt).toBeDefined();
  });

  it("オプションフィールドが定義できる", () => {
    const options: AIServiceOptions<TestResponse> = {
      schema: TestResponseSchema,
      prompt: "テスト",
      temperature: 0.3,
      maxTokens: 2048,
    };

    expect(options.temperature).toBe(0.3);
    expect(options.maxTokens).toBe(2048);
  });
});
