/**
 * VercelAIService実装のテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { VercelAIService, getAIService, setAIService, resetAIService } from "@/infrastructure/external/ai";
import type { IAIService } from "@/infrastructure/external/ai";

// ai モジュールをモック
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

// @ai-sdk/google モジュールをモック
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => ({ type: "google-model" })),
}));

const TestSchema = z.object({
  message: z.string(),
  score: z.number(),
});

describe("VercelAIService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAIService();
  });

  afterEach(() => {
    resetAIService();
  });

  describe("generateStructuredOutput", () => {
    it("Vercel AI SDKのgenerateObjectを呼び出す", async () => {
      const { generateObject } = await import("ai");
      const mockGenerateObject = vi.mocked(generateObject);
      mockGenerateObject.mockResolvedValue({
        object: { message: "テスト", score: 85 },
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      } as Awaited<ReturnType<typeof generateObject>>);

      const service = new VercelAIService();
      const result = await service.generateStructuredOutput({
        schema: TestSchema,
        prompt: "テストプロンプト",
      });

      expect(result.message).toBe("テスト");
      expect(result.score).toBe(85);
      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "テストプロンプト",
          temperature: 0.3, // デフォルト値
        })
      );
    });

    it("カスタムtemperatureを渡せる", async () => {
      const { generateObject } = await import("ai");
      const mockGenerateObject = vi.mocked(generateObject);
      mockGenerateObject.mockResolvedValue({
        object: { message: "テスト", score: 50 },
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      } as Awaited<ReturnType<typeof generateObject>>);

      const service = new VercelAIService();
      await service.generateStructuredOutput({
        schema: TestSchema,
        prompt: "テスト",
        temperature: 0.7,
      });

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        })
      );
    });

    it("カスタムmaxTokensを渡せる", async () => {
      const { generateObject } = await import("ai");
      const mockGenerateObject = vi.mocked(generateObject);
      mockGenerateObject.mockResolvedValue({
        object: { message: "テスト", score: 50 },
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      } as Awaited<ReturnType<typeof generateObject>>);

      const service = new VercelAIService();
      await service.generateStructuredOutput({
        schema: TestSchema,
        prompt: "テスト",
        maxTokens: 4096,
      });

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 4096,
        })
      );
    });
  });

  describe("コンストラクタ", () => {
    it("デフォルト設定で初期化できる", () => {
      const service = new VercelAIService();
      expect(service).toBeInstanceOf(VercelAIService);
    });

    it("カスタム設定で初期化できる", () => {
      const service = new VercelAIService({
        provider: "google",
        defaultTemperature: 0.5,
        defaultMaxTokens: 4096,
      });
      expect(service).toBeInstanceOf(VercelAIService);
    });
  });
});

describe("getAIService / setAIService", () => {
  afterEach(() => {
    resetAIService();
  });

  it("シングルトンインスタンスを返す", () => {
    const service1 = getAIService();
    const service2 = getAIService();
    expect(service1).toBe(service2);
  });

  it("setAIServiceでカスタムサービスを設定できる", () => {
    const mockService: IAIService = {
      generateStructuredOutput: vi.fn(),
    };

    setAIService(mockService);
    const service = getAIService();

    expect(service).toBe(mockService);
  });

  it("resetAIServiceでインスタンスをリセットできる", () => {
    const service1 = getAIService();
    resetAIService();
    const service2 = getAIService();

    expect(service1).not.toBe(service2);
  });
});
