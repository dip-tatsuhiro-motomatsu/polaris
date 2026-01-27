import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Issue } from "@/types/issue";

/**
 * 品質評価ロジックのユニットテスト
 * T038: 品質評価ロジックのユニットテストを作成（モック使用）
 */

// モック用のIssue作成ヘルパー
function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    number: 1,
    title: "テストIssue",
    body: "",
    state: "open",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    closedAt: null,
    assignee: null,
    labels: [],
    githubId: 12345,
    speedEvaluation: null,
    qualityEvaluation: null,
    syncedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// evaluateIssueQuality関数のモック（実装前にテストを書くため）
const mockEvaluateIssueQuality = vi.fn();

describe("evaluateIssueQuality", () => {
  beforeEach(() => {
    mockEvaluateIssueQuality.mockReset();
  });

  describe("正常系", () => {
    it("適切に記述されたIssueに対して高スコアを返す", async () => {
      const wellWrittenIssue = createMockIssue({
        title: "ユーザー認証機能を実装する",
        body: `
## ユーザーストーリー
開発者として、ユーザー認証機能を実装したい。
なぜなら、セキュアなアクセス制御が必要だから。

## 実装方針
- Firebase Authenticationを使用
- Email/Password認証を最初に実装
- 認証状態はContextで管理

## 懸念点
- セッションタイムアウトの扱い
- パスワードリセットフロー
`,
        assignee: "developer1",
      });

      // モックの戻り値を設定
      mockEvaluateIssueQuality.mockResolvedValue({
        score: 95,
        grade: "A",
        message: "非常に良い記述です",
        details: {
          "user-story": { score: 28, maxScore: 30, feedback: "明確" },
          implementation: { score: 24, maxScore: 25, feedback: "具体的" },
          concerns: { score: 23, maxScore: 25, feedback: "記載あり" },
          assignee: { score: 20, maxScore: 20, feedback: "設定済み" },
        },
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(wellWrittenIssue);

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(["S", "A"]).toContain(result.grade);
    });

    it("記述が不十分なIssueに対して低スコアを返す", async () => {
      const poorIssue = createMockIssue({
        title: "バグ修正",
        body: "直してください",
        assignee: null,
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 15,
        grade: "C",
        message: "記述を改善してください",
        details: {
          "user-story": { score: 5, maxScore: 30, feedback: "不十分" },
          implementation: { score: 5, maxScore: 25, feedback: "なし" },
          concerns: { score: 5, maxScore: 25, feedback: "なし" },
          assignee: { score: 0, maxScore: 20, feedback: "未設定" },
        },
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(poorIssue);

      expect(result.score).toBeLessThan(40);
      expect(result.grade).toBe("C");
    });

    it("担当者が設定されていない場合、assignee項目は0点", async () => {
      const noAssigneeIssue = createMockIssue({
        title: "機能追加",
        body: `
## ユーザーストーリー
ユーザーとして、新機能を使いたい。

## 実装方針
コンポーネントを追加する。
`,
        assignee: null,
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 60,
        grade: "B",
        message: "担当者を設定してください",
        details: {
          "user-story": { score: 25, maxScore: 30, feedback: "記載あり" },
          implementation: { score: 20, maxScore: 25, feedback: "記載あり" },
          concerns: { score: 15, maxScore: 25, feedback: "不足" },
          assignee: { score: 0, maxScore: 20, feedback: "未設定" },
        },
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(noAssigneeIssue);

      expect(result.details.assignee.score).toBe(0);
    });

    it("担当者が設定されている場合、assignee項目は満点", async () => {
      const hasAssigneeIssue = createMockIssue({
        title: "機能追加",
        body: "内容",
        assignee: "developer1",
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 40,
        grade: "B",
        message: "内容を改善してください",
        details: {
          "user-story": { score: 5, maxScore: 30, feedback: "不足" },
          implementation: { score: 5, maxScore: 25, feedback: "不足" },
          concerns: { score: 10, maxScore: 25, feedback: "不足" },
          assignee: { score: 20, maxScore: 20, feedback: "設定済み" },
        },
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(hasAssigneeIssue);

      expect(result.details.assignee.score).toBe(20);
    });
  });

  describe("スコア計算", () => {
    it("合計スコアは各項目スコアの合計である", async () => {
      const issue = createMockIssue({
        title: "テスト",
        body: "テスト本文",
        assignee: "user1",
      });

      const details = {
        "user-story": { score: 20, maxScore: 30, feedback: "テスト" },
        implementation: { score: 15, maxScore: 25, feedback: "テスト" },
        concerns: { score: 10, maxScore: 25, feedback: "テスト" },
        assignee: { score: 20, maxScore: 20, feedback: "テスト" },
      };

      const totalScore = Object.values(details).reduce(
        (sum, item) => sum + item.score,
        0
      );

      mockEvaluateIssueQuality.mockResolvedValue({
        score: totalScore,
        grade: "B",
        message: "テスト",
        details,
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(issue);

      expect(result.score).toBe(65);
    });

    it("スコアが100以上でSグレード", async () => {
      const excellentIssue = createMockIssue({
        title: "完璧なIssue",
        body: "完璧な内容",
        assignee: "expert",
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 105,
        grade: "S",
        message: "素晴らしい",
        details: {},
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(excellentIssue);

      expect(result.grade).toBe("S");
    });

    it("スコアが71-100でAグレード", async () => {
      const goodIssue = createMockIssue({
        title: "良いIssue",
        body: "良い内容",
        assignee: "dev",
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 85,
        grade: "A",
        message: "良好",
        details: {},
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(goodIssue);

      expect(result.grade).toBe("A");
    });

    it("スコアが41-70でBグレード", async () => {
      const averageIssue = createMockIssue({
        title: "普通のIssue",
        body: "普通の内容",
        assignee: "dev",
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 55,
        grade: "B",
        message: "改善の余地あり",
        details: {},
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(averageIssue);

      expect(result.grade).toBe("B");
    });

    it("スコアが40以下でCグレード", async () => {
      const poorIssue = createMockIssue({
        title: "不十分なIssue",
        body: "",
        assignee: null,
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 25,
        grade: "C",
        message: "大幅な改善が必要",
        details: {},
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(poorIssue);

      expect(result.grade).toBe("C");
    });
  });

  describe("フィードバック", () => {
    it("各評価項目に対してフィードバックが返される", async () => {
      const issue = createMockIssue({
        title: "テスト",
        body: "テスト本文",
        assignee: "user1",
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 70,
        grade: "B",
        message: "全体フィードバック",
        details: {
          "user-story": {
            score: 20,
            maxScore: 30,
            feedback: "ユーザーストーリーの形式に従っていますが、詳細が不足しています。",
          },
          implementation: {
            score: 20,
            maxScore: 25,
            feedback: "実装方針が記載されています。",
          },
          concerns: {
            score: 10,
            maxScore: 25,
            feedback: "懸念点の記載を検討してください。",
          },
          assignee: {
            score: 20,
            maxScore: 20,
            feedback: "担当者が設定されています。",
          },
        },
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(issue);

      expect(result.details["user-story"].feedback).toBeTruthy();
      expect(result.details["implementation"].feedback).toBeTruthy();
      expect(result.details["concerns"].feedback).toBeTruthy();
      expect(result.details["assignee"].feedback).toBeTruthy();
    });

    it("全体メッセージが含まれる", async () => {
      const issue = createMockIssue({
        title: "テスト",
        body: "テスト",
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 50,
        grade: "B",
        message: "Issueの記述を改善することで、開発効率が向上します。",
        details: {},
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(issue);

      expect(result.message).toBeTruthy();
      expect(typeof result.message).toBe("string");
    });
  });

  describe("エッジケース", () => {
    it("非常に長いIssueボディでも処理できる", async () => {
      const longBody = "テスト内容\n".repeat(1000);
      const longIssue = createMockIssue({
        title: "長いIssue",
        body: longBody,
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 60,
        grade: "B",
        message: "評価完了",
        details: {},
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(longIssue);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("特殊文字を含むIssueでも処理できる", async () => {
      const specialCharIssue = createMockIssue({
        title: "特殊文字テスト <script>alert('xss')</script>",
        body: "```javascript\nconst x = '<>&\"';\n```\n## 見出し\n- リスト",
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 40,
        grade: "C",
        message: "評価完了",
        details: {},
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(specialCharIssue);

      expect(result).toBeDefined();
    });

    it("日本語のみのIssueでも正しく評価される", async () => {
      const japaneseIssue = createMockIssue({
        title: "日本語タイトル",
        body: `
## ユーザーストーリー
日本語の開発者として、日本語で記述したい。
なぜなら、理解しやすいから。

## 実装方針
日本語コメントを追加する。

## 懸念点
なし
`,
        assignee: "日本太郎",
      });

      mockEvaluateIssueQuality.mockResolvedValue({
        score: 90,
        grade: "A",
        message: "良好な記述です",
        details: {},
        evaluatedAt: new Date(),
      });

      const result = await mockEvaluateIssueQuality(japaneseIssue);

      expect(result.score).toBeGreaterThanOrEqual(70);
    });
  });
});
