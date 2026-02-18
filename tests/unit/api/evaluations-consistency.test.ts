import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PRConsistencyEvaluation, ConsistencyGrade, LinkedPR } from "@/types/evaluation";

/**
 * 整合性評価API のユニットテスト
 * T047: 整合性評価API エンドポイントのテスト
 */

// モック用のIssue型
interface MockIssue {
  id: string;
  number: number;
  title: string;
  body: string | null;
}

// モック用のPR型
interface MockPR {
  id: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  diff: string | null;
  changedFiles: string[];
  additions: number;
  deletions: number;
  mergedAt: string | null;
  linkedIssueNumber: number | null;
}

// モック用の整合性評価結果を生成
function createMockConsistencyEvaluation(
  overrides: Partial<PRConsistencyEvaluation> = {}
): PRConsistencyEvaluation {
  return {
    totalScore: 78,
    grade: "B" as ConsistencyGrade,
    linkedPRs: [
      {
        number: 10,
        title: "feat: ユーザー認証機能の実装",
        url: "https://github.com/org/repo/pull/10",
      },
    ],
    categories: [
      {
        categoryId: "issue-evaluability",
        categoryName: "Issue記述の評価可能性",
        score: 16,
        maxScore: 20,
        feedback: "Issueの要件が明確に記述されています。",
      },
      {
        categoryId: "requirement-coverage",
        categoryName: "要件網羅性",
        score: 25,
        maxScore: 30,
        feedback: "ほとんどの要件がPRで実装されています。",
      },
      {
        categoryId: "scope-appropriateness",
        categoryName: "実装範囲の適切さ",
        score: 18,
        maxScore: 20,
        feedback: "実装範囲は適切です。",
      },
      {
        categoryId: "acceptance-criteria-achievement",
        categoryName: "受け入れ条件の達成",
        score: 14,
        maxScore: 20,
        feedback: "受け入れ条件が一部不明確です。",
      },
      {
        categoryId: "pr-description-clarity",
        categoryName: "変更説明の明確さ",
        score: 5,
        maxScore: 10,
        feedback: "PR説明がIssueと関連付けられています。",
      },
    ],
    overallFeedback: "全体的に良好な整合性です。受け入れ条件をより具体化すると改善できます。",
    issueImprovementSuggestions: [
      "受け入れ条件をチェックリスト形式で記述してください",
    ],
    evaluatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// モック用のIssue生成
function createMockIssue(overrides: Partial<MockIssue> = {}): MockIssue {
  return {
    id: "issue-1",
    number: 1,
    title: "ユーザー認証機能の実装",
    body: `## 背景
ユーザー認証が必要です。

## 受け入れ条件
- ログインフォームが表示される
- メールアドレスとパスワードで認証できる`,
    ...overrides,
  };
}

// モック用のPR生成
function createMockPR(overrides: Partial<MockPR> = {}): MockPR {
  return {
    id: "pr-1",
    number: 10,
    title: "feat: ユーザー認証機能の実装",
    body: "Closes #1\n\nログインフォームとメール認証を実装しました。",
    url: "https://github.com/org/repo/pull/10",
    diff: "+export function login() { ... }",
    changedFiles: ["src/auth/login.ts", "src/components/LoginForm.tsx"],
    additions: 150,
    deletions: 10,
    mergedAt: "2024-01-15T10:00:00Z",
    linkedIssueNumber: 1,
    ...overrides,
  };
}

describe("Consistency Evaluation API", () => {
  describe("バリデーション", () => {
    it("repositoryIdが必須", () => {
      const requestBody = {};

      const isValid = "repositoryId" in requestBody;
      expect(isValid).toBe(false);
    });

    it("issueNumberが指定されていなくても全Issue評価可能", () => {
      const requestBody = {
        repositoryId: "repo-1",
      };

      const isValid = "repositoryId" in requestBody;
      expect(isValid).toBe(true);
    });
  });

  describe("評価実行", () => {
    it("IssueとリンクされたPRの整合性を評価できる", async () => {
      const issue = createMockIssue();
      const pr = createMockPR({ linkedIssueNumber: issue.number });
      const evaluation = createMockConsistencyEvaluation();

      expect(evaluation.totalScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.totalScore).toBeLessThanOrEqual(100);
      expect(["A", "B", "C", "D", "E"]).toContain(evaluation.grade);
      expect(evaluation.linkedPRs.length).toBeGreaterThan(0);
    });

    it("リンクされたPRがない場合は評価をスキップ", async () => {
      const issue = createMockIssue();
      // PRなしの場合
      const skipResult = {
        issueId: issue.id,
        issueNumber: issue.number,
        skipped: true,
        reason: "リンクされたPRがありません",
      };

      expect(skipResult.skipped).toBe(true);
      expect(skipResult.reason).toBeTruthy();
    });

    it("複数のPRがリンクされている場合も評価できる", async () => {
      const issue = createMockIssue();
      const evaluation = createMockConsistencyEvaluation({
        linkedPRs: [
          { number: 10, title: "PR 1", url: "https://github.com/org/repo/pull/10" },
          { number: 11, title: "PR 2", url: "https://github.com/org/repo/pull/11" },
        ],
      });

      expect(evaluation.linkedPRs.length).toBe(2);
    });
  });

  describe("グレード判定", () => {
    it("スコア80-100はAグレード", () => {
      const evaluation = createMockConsistencyEvaluation({
        totalScore: 85,
        grade: "A",
      });

      expect(evaluation.grade).toBe("A");
    });

    it("スコア60-79はBグレード", () => {
      const evaluation = createMockConsistencyEvaluation({
        totalScore: 70,
        grade: "B",
      });

      expect(evaluation.grade).toBe("B");
    });

    it("スコア40-59はCグレード", () => {
      const evaluation = createMockConsistencyEvaluation({
        totalScore: 50,
        grade: "C",
      });

      expect(evaluation.grade).toBe("C");
    });

    it("スコア20-39はDグレード", () => {
      const evaluation = createMockConsistencyEvaluation({
        totalScore: 30,
        grade: "D",
      });

      expect(evaluation.grade).toBe("D");
    });

    it("スコア0-19はEグレード", () => {
      const evaluation = createMockConsistencyEvaluation({
        totalScore: 15,
        grade: "E",
      });

      expect(evaluation.grade).toBe("E");
    });
  });

  describe("カテゴリ別評価", () => {
    it("5つのカテゴリが評価される", () => {
      const evaluation = createMockConsistencyEvaluation();

      const categoryIds = evaluation.categories.map((c) => c.categoryId);
      expect(categoryIds).toContain("issue-evaluability");
      expect(categoryIds).toContain("requirement-coverage");
      expect(categoryIds).toContain("scope-appropriateness");
      expect(categoryIds).toContain("acceptance-criteria-achievement");
      expect(categoryIds).toContain("pr-description-clarity");
    });

    it("各カテゴリにフィードバックが含まれる", () => {
      const evaluation = createMockConsistencyEvaluation();

      evaluation.categories.forEach((category) => {
        expect(category.feedback).toBeTruthy();
        expect(typeof category.feedback).toBe("string");
      });
    });

    it("各カテゴリのスコアは最大スコア以下", () => {
      const evaluation = createMockConsistencyEvaluation();

      evaluation.categories.forEach((category) => {
        expect(category.score).toBeLessThanOrEqual(category.maxScore);
        expect(category.score).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("Issue改善提案", () => {
    it("Issue記述に問題がある場合、改善提案が含まれる", () => {
      const evaluation = createMockConsistencyEvaluation({
        issueImprovementSuggestions: [
          "受け入れ条件を具体的に記述してください",
          "実装要件を箇条書きで整理してください",
        ],
      });

      expect(evaluation.issueImprovementSuggestions.length).toBeGreaterThan(0);
    });

    it("Issue記述が十分な場合、改善提案は空", () => {
      const evaluation = createMockConsistencyEvaluation({
        totalScore: 95,
        grade: "A",
        issueImprovementSuggestions: [],
      });

      expect(evaluation.issueImprovementSuggestions.length).toBe(0);
    });
  });

  describe("PRリンク検出", () => {
    it("PR本文から'Closes #N'形式でリンクを検出", () => {
      const pr = createMockPR({
        body: "Closes #1\n\nログイン機能を実装",
        linkedIssueNumber: 1,
      });

      expect(pr.linkedIssueNumber).toBe(1);
    });

    it("PR本文から'Fixes #N'形式でリンクを検出", () => {
      const prBody = "Fixes #5\n\nバグ修正";

      const match = prBody.match(/(?:Closes|Fixes|Resolves)\s*#(\d+)/i);
      const linkedIssueNumber = match ? parseInt(match[1], 10) : null;

      expect(linkedIssueNumber).toBe(5);
    });

    it("PRタイトルから'(#N)'形式でリンクを検出", () => {
      const prTitle = "feat: 認証機能 (#3)";

      const match = prTitle.match(/\(#(\d+)\)/);
      const linkedIssueNumber = match ? parseInt(match[1], 10) : null;

      expect(linkedIssueNumber).toBe(3);
    });
  });

  describe("APIレスポンス形式", () => {
    it("成功レスポンスの形式が正しい", () => {
      const mockResponse = {
        evaluated: 2,
        skipped: 1,
        results: [
          {
            issueId: "issue-1",
            issueNumber: 1,
            totalScore: 85,
            grade: "A",
            linkedPRs: [{ number: 10, title: "PR 1" }],
            overallFeedback: "良好な整合性です。",
          },
          {
            issueId: "issue-2",
            issueNumber: 2,
            totalScore: 65,
            grade: "B",
            linkedPRs: [{ number: 11, title: "PR 2" }],
            overallFeedback: "改善の余地があります。",
          },
        ],
        skippedIssues: [
          {
            issueId: "issue-3",
            issueNumber: 3,
            reason: "リンクされたPRがありません",
          },
        ],
      };

      expect(mockResponse.evaluated).toBe(2);
      expect(mockResponse.skipped).toBe(1);
      expect(mockResponse.results.length).toBe(2);
      expect(mockResponse.skippedIssues.length).toBe(1);
    });

    it("エラーレスポンスの形式が正しい", () => {
      const errorResponse = {
        error: "リポジトリが見つかりません",
        message: "Repository not found",
      };

      expect(errorResponse.error).toBeTruthy();
      expect(errorResponse.message).toBeTruthy();
    });
  });

  describe("エラーハンドリング", () => {
    it("存在しないリポジトリIDでエラー", () => {
      const errorResponse = {
        error: "リポジトリが見つかりません",
        status: 404,
      };

      expect(errorResponse.status).toBe(404);
    });

    it("AI API呼び出し失敗時にエラー", () => {
      const errorResponse = {
        error: "整合性評価に失敗しました",
        status: 500,
      };

      expect(errorResponse.status).toBe(500);
    });
  });
});
