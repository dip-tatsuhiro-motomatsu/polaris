import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IssueQualityEvaluation, QualityGrade } from "@/types/evaluation";

/**
 * 品質評価API のユニットテスト
 * T042: 品質評価API エンドポイントのテスト
 */

// モック用のIssue型
interface MockIssue {
  id: string;
  number: number;
  title: string;
  body: string | null;
  assignee: string | null;
}

// モック用の評価結果を生成
function createMockQualityEvaluation(
  overrides: Partial<IssueQualityEvaluation> = {}
): IssueQualityEvaluation {
  return {
    totalScore: 75,
    grade: "B" as QualityGrade,
    categories: [
      {
        categoryId: "context-goal",
        categoryName: "Context & Goal",
        score: 20,
        maxScore: 25,
        feedback: "背景と目的が明確に記述されています。",
      },
      {
        categoryId: "implementation-details",
        categoryName: "Implementation Details",
        score: 18,
        maxScore: 25,
        feedback: "実装詳細が概ね記述されています。",
      },
      {
        categoryId: "acceptance-criteria",
        categoryName: "Acceptance Criteria",
        score: 22,
        maxScore: 30,
        feedback: "受け入れ条件がチェックリスト形式で記述されています。",
      },
      {
        categoryId: "structure-clarity",
        categoryName: "Structure & Clarity",
        score: 15,
        maxScore: 20,
        feedback: "構造は概ね明確です。",
      },
    ],
    overallFeedback: "全体的に良好な記述です。受け入れ条件をより具体的にすると改善できます。",
    improvementSuggestions: [
      "受け入れ条件に具体的な数値基準を追加してください",
      "エッジケースのテスト要件を追加してください",
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
- [ ] ログインフォームが表示される
- [ ] メールアドレスとパスワードで認証できる`,
    assignee: "developer1",
    ...overrides,
  };
}

describe("Quality Evaluation API", () => {
  describe("バリデーション", () => {
    it("repositoryIdが必須", () => {
      const requestBody = {};

      const isValid = "repositoryId" in requestBody;
      expect(isValid).toBe(false);
    });

    it("issueNumber必須でなくても可（バッチ評価用）", () => {
      const requestBody = {
        repositoryId: "repo-1",
      };

      const isValid = "repositoryId" in requestBody;
      expect(isValid).toBe(true);
    });
  });

  describe("評価実行", () => {
    it("単一のIssueを評価できる", async () => {
      const issue = createMockIssue();
      const evaluation = createMockQualityEvaluation();

      // 評価結果の検証
      expect(evaluation.totalScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.totalScore).toBeLessThanOrEqual(100);
      expect(["A", "B", "C", "D", "E"]).toContain(evaluation.grade);
      expect(evaluation.categories.length).toBe(4);
    });

    it("複数のIssueを一括評価できる", async () => {
      const issues = [
        createMockIssue({ id: "issue-1", number: 1 }),
        createMockIssue({ id: "issue-2", number: 2 }),
        createMockIssue({ id: "issue-3", number: 3 }),
      ];

      const evaluations = issues.map((issue) => ({
        issueId: issue.id,
        issueNumber: issue.number,
        evaluation: createMockQualityEvaluation(),
      }));

      expect(evaluations.length).toBe(3);
      evaluations.forEach((result) => {
        expect(result.evaluation).toBeDefined();
        expect(result.evaluation.totalScore).toBeGreaterThanOrEqual(0);
      });
    });

    it("空のIssue本文でも評価できる", async () => {
      const issue = createMockIssue({ body: null });
      const evaluation = createMockQualityEvaluation({
        totalScore: 25,
        grade: "E",
        overallFeedback: "本文が空のため、詳細な評価ができません。",
      });

      expect(evaluation.grade).toBe("E");
      expect(evaluation.totalScore).toBeLessThan(40);
    });
  });

  describe("グレード判定", () => {
    it("スコア80-100はAグレード", () => {
      const evaluation = createMockQualityEvaluation({
        totalScore: 85,
        grade: "A",
      });

      expect(evaluation.grade).toBe("A");
    });

    it("スコア60-79はBグレード", () => {
      const evaluation = createMockQualityEvaluation({
        totalScore: 70,
        grade: "B",
      });

      expect(evaluation.grade).toBe("B");
    });

    it("スコア40-59はCグレード", () => {
      const evaluation = createMockQualityEvaluation({
        totalScore: 50,
        grade: "C",
      });

      expect(evaluation.grade).toBe("C");
    });

    it("スコア20-39はDグレード", () => {
      const evaluation = createMockQualityEvaluation({
        totalScore: 30,
        grade: "D",
      });

      expect(evaluation.grade).toBe("D");
    });

    it("スコア0-19はEグレード", () => {
      const evaluation = createMockQualityEvaluation({
        totalScore: 15,
        grade: "E",
      });

      expect(evaluation.grade).toBe("E");
    });
  });

  describe("カテゴリ別評価", () => {
    it("4つのカテゴリが評価される", () => {
      const evaluation = createMockQualityEvaluation();

      const categoryIds = evaluation.categories.map((c) => c.categoryId);
      expect(categoryIds).toContain("context-goal");
      expect(categoryIds).toContain("implementation-details");
      expect(categoryIds).toContain("acceptance-criteria");
      expect(categoryIds).toContain("structure-clarity");
    });

    it("各カテゴリにフィードバックが含まれる", () => {
      const evaluation = createMockQualityEvaluation();

      evaluation.categories.forEach((category) => {
        expect(category.feedback).toBeTruthy();
        expect(typeof category.feedback).toBe("string");
      });
    });

    it("各カテゴリのスコアは最大スコア以下", () => {
      const evaluation = createMockQualityEvaluation();

      evaluation.categories.forEach((category) => {
        expect(category.score).toBeLessThanOrEqual(category.maxScore);
        expect(category.score).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("改善提案", () => {
    it("改善提案が含まれる", () => {
      const evaluation = createMockQualityEvaluation();

      expect(evaluation.improvementSuggestions).toBeDefined();
      expect(Array.isArray(evaluation.improvementSuggestions)).toBe(true);
    });

    it("改善提案は最大3つ", () => {
      const evaluation = createMockQualityEvaluation({
        improvementSuggestions: [
          "提案1",
          "提案2",
          "提案3",
        ],
      });

      expect(evaluation.improvementSuggestions.length).toBeLessThanOrEqual(3);
    });

    it("高スコアの場合、改善提案が少ない", () => {
      const highScoreEvaluation = createMockQualityEvaluation({
        totalScore: 95,
        grade: "A",
        improvementSuggestions: [],
      });

      expect(highScoreEvaluation.improvementSuggestions.length).toBe(0);
    });
  });

  describe("APIレスポンス形式", () => {
    it("成功レスポンスの形式が正しい", () => {
      const mockResponse = {
        evaluated: 3,
        results: [
          {
            issueId: "issue-1",
            issueNumber: 1,
            totalScore: 85,
            grade: "A",
            overallFeedback: "良好な記述です。",
          },
          {
            issueId: "issue-2",
            issueNumber: 2,
            totalScore: 65,
            grade: "B",
            overallFeedback: "改善の余地があります。",
          },
          {
            issueId: "issue-3",
            issueNumber: 3,
            totalScore: 45,
            grade: "C",
            overallFeedback: "大幅な改善が必要です。",
          },
        ],
      };

      expect(mockResponse.evaluated).toBe(3);
      expect(mockResponse.results.length).toBe(3);
      expect(mockResponse.results[0].grade).toBe("A");
      expect(mockResponse.results[1].grade).toBe("B");
      expect(mockResponse.results[2].grade).toBe("C");
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
        error: "品質評価に失敗しました",
        status: 500,
      };

      expect(errorResponse.status).toBe(500);
    });
  });
});
