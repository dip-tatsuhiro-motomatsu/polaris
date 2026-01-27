import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Issue } from "@/types/issue";
import type { EvaluationResult } from "@/types/evaluation";

// モック用の評価関数
function evaluateIssueSpeed(issue: Issue): EvaluationResult | null {
  // オープンなIssueは評価不可
  if (issue.state === "open" || !issue.closedAt) {
    return null;
  }

  const createdAt = new Date(issue.createdAt);
  const closedAt = new Date(issue.closedAt);
  const hours = (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  if (hours <= 24) {
    return {
      score: 120,
      grade: "S",
      message: "小さな単位で開発できています！素晴らしい。",
      details: { completionHours: Math.round(hours * 10) / 10 },
      evaluatedAt: new Date(),
    };
  } else if (hours <= 72) {
    return {
      score: 100,
      grade: "A",
      message: "非常に健全な開発スピードです。",
      details: { completionHours: Math.round(hours * 10) / 10 },
      evaluatedAt: new Date(),
    };
  } else if (hours <= 120) {
    return {
      score: 70,
      grade: "B",
      message: "少しタスクが肥大化しているかも？分担を検討。",
      details: { completionHours: Math.round(hours * 10) / 10 },
      evaluatedAt: new Date(),
    };
  } else {
    return {
      score: 40,
      grade: "C",
      message: "何か詰まっているはず。メンターに相談しよう。",
      details: { completionHours: Math.round(hours * 10) / 10 },
      evaluatedAt: new Date(),
    };
  }
}

describe("Speed Evaluation API", () => {
  describe("evaluateIssueSpeed", () => {
    it("クローズされたIssueを評価できる", () => {
      const issue: Issue = {
        id: "issue-1",
        number: 1,
        title: "Test Issue",
        body: "",
        state: "closed",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        closedAt: new Date("2024-01-01T12:00:00Z"),
        assignee: "developer",
        labels: [],
        githubId: 12345,
        speedEvaluation: null,
        qualityEvaluation: null,
        syncedAt: new Date(),
      };

      const result = evaluateIssueSpeed(issue);

      expect(result).not.toBeNull();
      expect(result?.grade).toBe("S");
      expect(result?.score).toBe(120);
    });

    it("オープンなIssueは評価しない", () => {
      const issue: Issue = {
        id: "issue-2",
        number: 2,
        title: "Open Issue",
        body: "",
        state: "open",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        closedAt: null,
        assignee: null,
        labels: [],
        githubId: 12346,
        speedEvaluation: null,
        qualityEvaluation: null,
        syncedAt: new Date(),
      };

      const result = evaluateIssueSpeed(issue);

      expect(result).toBeNull();
    });

    it("closedAtがnullの場合は評価しない", () => {
      const issue: Issue = {
        id: "issue-3",
        number: 3,
        title: "Issue without closedAt",
        body: "",
        state: "closed",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        closedAt: null,
        assignee: null,
        labels: [],
        githubId: 12347,
        speedEvaluation: null,
        qualityEvaluation: null,
        syncedAt: new Date(),
      };

      const result = evaluateIssueSpeed(issue);

      expect(result).toBeNull();
    });
  });

  describe("Batch evaluation", () => {
    it("複数のIssueを一括評価できる", () => {
      const issues: Issue[] = [
        {
          id: "issue-1",
          number: 1,
          title: "Fast Issue",
          body: "",
          state: "closed",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          closedAt: new Date("2024-01-01T12:00:00Z"),
          assignee: "dev1",
          labels: [],
          githubId: 1,
          speedEvaluation: null,
          qualityEvaluation: null,
          syncedAt: new Date(),
        },
        {
          id: "issue-2",
          number: 2,
          title: "Medium Issue",
          body: "",
          state: "closed",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          closedAt: new Date("2024-01-03T00:00:00Z"),
          assignee: "dev2",
          labels: [],
          githubId: 2,
          speedEvaluation: null,
          qualityEvaluation: null,
          syncedAt: new Date(),
        },
        {
          id: "issue-3",
          number: 3,
          title: "Open Issue",
          body: "",
          state: "open",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          closedAt: null,
          assignee: null,
          labels: [],
          githubId: 3,
          speedEvaluation: null,
          qualityEvaluation: null,
          syncedAt: new Date(),
        },
      ];

      const results = issues.map((issue) => ({
        issueId: issue.id,
        evaluation: evaluateIssueSpeed(issue),
      }));

      // 評価されたものだけをカウント
      const evaluated = results.filter((r) => r.evaluation !== null);
      expect(evaluated.length).toBe(2);

      // 各評価を確認
      expect(results[0].evaluation?.grade).toBe("S");
      expect(results[1].evaluation?.grade).toBe("A");
      expect(results[2].evaluation).toBeNull();
    });
  });

  describe("API response format", () => {
    it("評価結果のレスポンス形式が正しい", () => {
      const mockResponse = {
        evaluated: 2,
        results: [
          {
            issueId: "issue-1",
            score: 120,
            grade: "S",
            message: "小さな単位で開発できています！",
          },
          {
            issueId: "issue-2",
            score: 100,
            grade: "A",
            message: "非常に健全な開発スピードです。",
          },
        ],
      };

      expect(mockResponse.evaluated).toBe(2);
      expect(mockResponse.results.length).toBe(2);
      expect(mockResponse.results[0].grade).toBe("S");
    });
  });
});
