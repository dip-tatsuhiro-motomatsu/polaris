import { describe, it, expect, vi } from "vitest";
import type {
  AIProvider,
  IssueEvaluationRequest,
  IssueEvaluationResponse,
} from "@/lib/ai/interface";

/**
 * AI抽象化インターフェースのテスト
 * T037: AI抽象化インターフェースのユニットテスト
 */

// モックプロバイダーの実装
function createMockProvider(
  response: IssueEvaluationResponse
): AIProvider {
  return {
    evaluateIssue: vi.fn().mockResolvedValue(response),
  };
}

describe("AIProvider Interface", () => {
  describe("evaluateIssue", () => {
    it("正常なリクエストに対してスコアとフィードバックを返す", async () => {
      const mockResponse: IssueEvaluationResponse = {
        scores: {
          "user-story": 25,
          implementation: 20,
          concerns: 15,
          assignee: 20,
        },
        totalScore: 80,
        feedback: {
          "user-story": "ユーザーストーリーが明確に記述されています",
          implementation: "実装方針が具体的です",
          concerns: "懸念点の記載が不足しています",
          assignee: "担当者が設定されています",
        },
        overallFeedback:
          "概ね良好な記述です。懸念点の追記を検討してください。",
      };

      const provider = createMockProvider(mockResponse);

      const request: IssueEvaluationRequest = {
        issueTitle: "ユーザー認証機能を実装する",
        issueBody: `
## ユーザーストーリー
開発者として、ユーザー認証機能を実装したい。
なぜなら、セキュアなアクセス制御が必要だから。

## 実装方針
Firebase Authenticationを使用して実装する。
`,
        hasAssignee: true,
        checkItems: [
          { id: "user-story", label: "ユーザーストーリーの有無と質", weight: 30 },
          { id: "implementation", label: "実装方針の記載", weight: 25 },
          { id: "concerns", label: "懸念点の記載", weight: 25 },
          { id: "assignee", label: "assigneeの設定", weight: 20 },
        ],
      };

      const result = await provider.evaluateIssue(request);

      expect(result.totalScore).toBe(80);
      expect(result.scores).toHaveProperty("user-story");
      expect(result.feedback).toHaveProperty("implementation");
      expect(result.overallFeedback).toBeTruthy();
    });

    it("各項目のスコアは0〜weight範囲内であるべき", async () => {
      const mockResponse: IssueEvaluationResponse = {
        scores: {
          "user-story": 30, // max 30
          implementation: 25, // max 25
          concerns: 0, // min 0
          assignee: 20, // max 20
        },
        totalScore: 75,
        feedback: {
          "user-story": "完璧",
          implementation: "完璧",
          concerns: "記載なし",
          assignee: "設定済み",
        },
        overallFeedback: "良好",
      };

      const provider = createMockProvider(mockResponse);

      const request: IssueEvaluationRequest = {
        issueTitle: "テスト",
        issueBody: "テスト本文",
        hasAssignee: true,
        checkItems: [
          { id: "user-story", label: "ユーザーストーリーの有無と質", weight: 30 },
          { id: "implementation", label: "実装方針の記載", weight: 25 },
          { id: "concerns", label: "懸念点の記載", weight: 25 },
          { id: "assignee", label: "assigneeの設定", weight: 20 },
        ],
      };

      const result = await provider.evaluateIssue(request);

      expect(result.scores["user-story"]).toBeLessThanOrEqual(30);
      expect(result.scores["user-story"]).toBeGreaterThanOrEqual(0);
      expect(result.scores["implementation"]).toBeLessThanOrEqual(25);
      expect(result.scores["concerns"]).toBeGreaterThanOrEqual(0);
    });

    it("空のIssueボディに対しても評価を返す", async () => {
      const mockResponse: IssueEvaluationResponse = {
        scores: {
          "user-story": 0,
          implementation: 0,
          concerns: 0,
          assignee: 0,
        },
        totalScore: 0,
        feedback: {
          "user-story": "ユーザーストーリーが記載されていません",
          implementation: "実装方針が記載されていません",
          concerns: "懸念点が記載されていません",
          assignee: "担当者が設定されていません",
        },
        overallFeedback:
          "Issue内容が空です。適切な情報を記載してください。",
      };

      const provider = createMockProvider(mockResponse);

      const request: IssueEvaluationRequest = {
        issueTitle: "タイトルのみ",
        issueBody: "",
        hasAssignee: false,
        checkItems: [
          { id: "user-story", label: "ユーザーストーリーの有無と質", weight: 30 },
          { id: "implementation", label: "実装方針の記載", weight: 25 },
          { id: "concerns", label: "懸念点の記載", weight: 25 },
          { id: "assignee", label: "assigneeの設定", weight: 20 },
        ],
      };

      const result = await provider.evaluateIssue(request);

      expect(result.totalScore).toBe(0);
      expect(result.overallFeedback).toContain("Issue内容が空です");
    });
  });
});

describe("IssueEvaluationRequest", () => {
  it("必須フィールドが正しく定義されている", () => {
    const request: IssueEvaluationRequest = {
      issueTitle: "テスト",
      issueBody: "本文",
      hasAssignee: true,
      checkItems: [
        { id: "test", label: "テスト項目", weight: 100 },
      ],
    };

    expect(request.issueTitle).toBeDefined();
    expect(request.issueBody).toBeDefined();
    expect(request.hasAssignee).toBeDefined();
    expect(request.checkItems).toBeDefined();
    expect(request.checkItems.length).toBeGreaterThan(0);
  });
});

describe("IssueEvaluationResponse", () => {
  it("必須フィールドが正しく定義されている", () => {
    const response: IssueEvaluationResponse = {
      scores: { test: 50 },
      totalScore: 50,
      feedback: { test: "テストフィードバック" },
      overallFeedback: "全体フィードバック",
    };

    expect(response.scores).toBeDefined();
    expect(response.totalScore).toBeDefined();
    expect(response.feedback).toBeDefined();
    expect(response.overallFeedback).toBeDefined();
  });
});
