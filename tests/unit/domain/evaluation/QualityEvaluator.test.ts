/**
 * QualityEvaluator ドメインサービスのテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { QualityEvaluator, IssueForEvaluation } from "@/domain/evaluation/services/QualityEvaluator";
import type { QualityEvaluationResponse } from "@/domain/evaluation/schemas";

// AIモジュールをモック
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@/lib/ai/provider", () => ({
  getModel: vi.fn(),
  getAIConfig: vi.fn().mockReturnValue({
    provider: "google",
    temperature: 0.3,
    maxTokens: 2048,
  }),
}));

import { generateObject } from "ai";

describe("QualityEvaluator", () => {
  let evaluator: QualityEvaluator;

  const mockIssue: IssueForEvaluation = {
    number: 1,
    title: "ユーザー認証機能の実装",
    body: `## 背景
ユーザー認証が必要です。

## 受け入れ条件
- [ ] ログインフォームが表示される
- [ ] メールアドレスとパスワードで認証できる`,
    assignee: "developer1",
  };

  const mockAIResponse: QualityEvaluationResponse = {
    categories: [
      { categoryId: "context-goal", score: 20, feedback: "背景が明確です" },
      { categoryId: "implementation-details", score: 18, feedback: "詳細が概ね記載されています" },
      { categoryId: "acceptance-criteria", score: 25, feedback: "ACがチェックリスト形式です" },
      { categoryId: "structure-clarity", score: 15, feedback: "構造は明確です" },
    ],
    overallFeedback: "全体的に良好な記述です。",
    improvementSuggestions: ["エッジケースの記載を追加してください"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    evaluator = new QualityEvaluator();

    // モックのセットアップ
    (generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: mockAIResponse,
    });
  });

  describe("evaluate", () => {
    it("Issueを評価してスコアとグレードを返す", async () => {
      const result = await evaluator.evaluate(mockIssue);

      expect(result.totalScore.value).toBe(78); // 20 + 18 + 25 + 15
      expect(result.grade.value).toBe("B"); // 61-80 = B
      expect(result.categories).toHaveLength(4);
      expect(result.overallFeedback).toBe("全体的に良好な記述です。");
      expect(result.improvementSuggestions).toHaveLength(1);
    });

    it("各カテゴリにフィードバックが含まれる", async () => {
      const result = await evaluator.evaluate(mockIssue);

      const contextGoal = result.categories.find((c) => c.categoryId === "context-goal");
      expect(contextGoal).toBeDefined();
      expect(contextGoal?.score).toBe(20);
      expect(contextGoal?.maxScore).toBe(25);
      expect(contextGoal?.feedback).toBe("背景が明確です");
    });

    it("evaluatedAtが現在時刻に設定される", async () => {
      const before = new Date();
      const result = await evaluator.evaluate(mockIssue);
      const after = new Date();

      const evaluatedAt = new Date(result.evaluatedAt);
      expect(evaluatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(evaluatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("スコア計算", () => {
    it("AIのカテゴリスコアを合計する", async () => {
      const result = await evaluator.evaluate(mockIssue);

      // 20 + 18 + 25 + 15 = 78
      expect(result.totalScore.value).toBe(78);
    });

    it("合計が100を超えた場合は100に丸める", async () => {
      (generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
        object: {
          categories: [
            { categoryId: "context-goal", score: 30, feedback: "完璧" },
            { categoryId: "implementation-details", score: 30, feedback: "完璧" },
            { categoryId: "acceptance-criteria", score: 35, feedback: "完璧" },
            { categoryId: "structure-clarity", score: 25, feedback: "完璧" },
          ],
          overallFeedback: "素晴らしい",
          improvementSuggestions: [],
        },
      });

      const result = await evaluator.evaluate(mockIssue);
      expect(result.totalScore.value).toBe(100);
    });
  });

  describe("グレード判定", () => {
    it("81-100点はAグレード", async () => {
      (generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
        object: {
          categories: [
            { categoryId: "context-goal", score: 23, feedback: "" },
            { categoryId: "implementation-details", score: 22, feedback: "" },
            { categoryId: "acceptance-criteria", score: 27, feedback: "" },
            { categoryId: "structure-clarity", score: 18, feedback: "" },
          ],
          overallFeedback: "",
          improvementSuggestions: [],
        },
      });

      const result = await evaluator.evaluate(mockIssue);
      expect(result.grade.value).toBe("A"); // 90点
    });

    it("0-20点はEグレード", async () => {
      (generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
        object: {
          categories: [
            { categoryId: "context-goal", score: 5, feedback: "" },
            { categoryId: "implementation-details", score: 5, feedback: "" },
            { categoryId: "acceptance-criteria", score: 5, feedback: "" },
            { categoryId: "structure-clarity", score: 3, feedback: "" },
          ],
          overallFeedback: "",
          improvementSuggestions: [],
        },
      });

      const result = await evaluator.evaluate(mockIssue);
      expect(result.grade.value).toBe("E"); // 18点
    });
  });

  describe("プロンプト生成", () => {
    it("AIにカテゴリ情報を渡す", async () => {
      await evaluator.evaluate(mockIssue);

      expect(generateObject).toHaveBeenCalledTimes(1);
      const callArgs = (generateObject as ReturnType<typeof vi.fn>).mock.calls[0][0];

      // プロンプトにカテゴリ情報が含まれることを確認
      expect(callArgs.prompt).toContain("context-goal");
      expect(callArgs.prompt).toContain("acceptance-criteria");
      expect(callArgs.prompt).toContain("25点満点");
      expect(callArgs.prompt).toContain("30点満点");
    });

    it("AIにIssue情報を渡す", async () => {
      await evaluator.evaluate(mockIssue);

      const callArgs = (generateObject as ReturnType<typeof vi.fn>).mock.calls[0][0];

      expect(callArgs.prompt).toContain("ユーザー認証機能の実装");
      expect(callArgs.prompt).toContain("developer1");
    });
  });
});
