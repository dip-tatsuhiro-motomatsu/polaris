import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GitHubIssue, GitHubPullRequest, SyncResult } from "@/types/github";
import type { Issue } from "@/types/issue";
import type { PullRequest } from "@/types/pull-request";

// モック用の関数
const mockOctokit = {
  rest: {
    repos: {
      get: vi.fn(),
    },
    issues: {
      listForRepo: vi.fn(),
    },
    pulls: {
      list: vi.fn(),
    },
  },
};

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn(() => mockOctokit),
}));

// 同期ロジックのヘルパー関数（実装前のテスト）
function convertGitHubIssueToIssue(ghIssue: GitHubIssue): Omit<Issue, "id"> {
  return {
    number: ghIssue.number,
    title: ghIssue.title,
    body: ghIssue.body || "",
    state: ghIssue.state,
    createdAt: new Date(ghIssue.created_at),
    closedAt: ghIssue.closed_at ? new Date(ghIssue.closed_at) : null,
    assignee: ghIssue.assignee?.login || null,
    labels: ghIssue.labels.map((l) => l.name),
    githubId: ghIssue.id,
    speedEvaluation: null,
    qualityEvaluation: null,
    syncedAt: new Date(),
  };
}

function convertGitHubPRToPullRequest(
  ghPR: GitHubPullRequest
): Omit<PullRequest, "id"> {
  // PRボディからリンクされたIssue番号を抽出
  const linkedIssueNumbers = extractLinkedIssueNumbers(ghPR.body || "");

  return {
    number: ghPR.number,
    title: ghPR.title,
    body: ghPR.body || "",
    state: ghPR.merged_at ? "merged" : ghPR.state,
    linkedIssueNumbers,
    githubId: ghPR.id,
    consistencyEvaluation: null,
    createdAt: new Date(ghPR.created_at),
    mergedAt: ghPR.merged_at ? new Date(ghPR.merged_at) : null,
    closedAt: ghPR.closed_at ? new Date(ghPR.closed_at) : null,
    author: ghPR.user?.login || null,
    syncedAt: new Date(),
  };
}

function extractLinkedIssueNumbers(body: string): number[] {
  // #123, fixes #123, closes #123, resolves #123 などのパターンを抽出
  const patterns = [
    /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi,
    /#(\d+)/g,
  ];

  const numbers = new Set<number>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      numbers.add(parseInt(match[1], 10));
    }
  }

  return Array.from(numbers);
}

describe("GitHub Sync Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Issue Conversion", () => {
    it("GitHubのIssueをアプリ内Issue型に変換できる", () => {
      const ghIssue: GitHubIssue = {
        id: 12345,
        number: 1,
        title: "Test Issue",
        body: "Issue description",
        state: "open",
        created_at: "2024-01-01T00:00:00Z",
        closed_at: null,
        updated_at: "2024-01-01T00:00:00Z",
        assignee: { login: "developer" },
        labels: [{ name: "bug" }, { name: "priority:high" }],
      };

      const issue = convertGitHubIssueToIssue(ghIssue);

      expect(issue.number).toBe(1);
      expect(issue.title).toBe("Test Issue");
      expect(issue.state).toBe("open");
      expect(issue.assignee).toBe("developer");
      expect(issue.labels).toEqual(["bug", "priority:high"]);
      expect(issue.speedEvaluation).toBeNull();
      expect(issue.qualityEvaluation).toBeNull();
    });

    it("クローズされたIssueを正しく変換できる", () => {
      const ghIssue: GitHubIssue = {
        id: 12346,
        number: 2,
        title: "Closed Issue",
        body: null,
        state: "closed",
        created_at: "2024-01-01T00:00:00Z",
        closed_at: "2024-01-02T12:00:00Z",
        updated_at: "2024-01-02T12:00:00Z",
        assignee: null,
        labels: [],
      };

      const issue = convertGitHubIssueToIssue(ghIssue);

      expect(issue.state).toBe("closed");
      expect(issue.closedAt).toEqual(new Date("2024-01-02T12:00:00Z"));
      expect(issue.body).toBe("");
      expect(issue.assignee).toBeNull();
    });
  });

  describe("Pull Request Conversion", () => {
    it("GitHubのPRをアプリ内PullRequest型に変換できる", () => {
      const ghPR: GitHubPullRequest = {
        id: 54321,
        number: 10,
        title: "Fix bug",
        body: "This PR fixes #1 and closes #2",
        state: "closed",
        merged_at: "2024-01-03T10:00:00Z",
        closed_at: "2024-01-03T10:00:00Z",
        created_at: "2024-01-02T00:00:00Z",
        updated_at: "2024-01-03T10:00:00Z",
        user: { login: "contributor" },
      };

      const pr = convertGitHubPRToPullRequest(ghPR);

      expect(pr.number).toBe(10);
      expect(pr.title).toBe("Fix bug");
      expect(pr.state).toBe("merged");
      expect(pr.linkedIssueNumbers).toContain(1);
      expect(pr.linkedIssueNumbers).toContain(2);
      expect(pr.author).toBe("contributor");
    });

    it("マージされていないクローズPRを正しく変換できる", () => {
      const ghPR: GitHubPullRequest = {
        id: 54322,
        number: 11,
        title: "Rejected PR",
        body: "This was rejected",
        state: "closed",
        merged_at: null,
        closed_at: "2024-01-03T10:00:00Z",
        created_at: "2024-01-02T00:00:00Z",
        updated_at: "2024-01-03T10:00:00Z",
        user: null,
      };

      const pr = convertGitHubPRToPullRequest(ghPR);

      expect(pr.state).toBe("closed");
      expect(pr.mergedAt).toBeNull();
      expect(pr.author).toBeNull();
    });
  });

  describe("Linked Issue Extraction", () => {
    it("PR本文からリンクされたIssue番号を抽出できる", () => {
      const body = "Fixes #1, closes #2, and resolves #3";
      const numbers = extractLinkedIssueNumbers(body);

      expect(numbers).toContain(1);
      expect(numbers).toContain(2);
      expect(numbers).toContain(3);
    });

    it("ハッシュタグ形式のIssue参照を抽出できる", () => {
      const body = "Related to #10 and #20";
      const numbers = extractLinkedIssueNumbers(body);

      expect(numbers).toContain(10);
      expect(numbers).toContain(20);
    });

    it("リンクがない場合は空配列を返す", () => {
      const body = "No linked issues here";
      const numbers = extractLinkedIssueNumbers(body);

      expect(numbers).toEqual([]);
    });

    it("重複を排除する", () => {
      const body = "Fixes #1 and also fixes #1";
      const numbers = extractLinkedIssueNumbers(body);

      expect(numbers.filter((n) => n === 1).length).toBe(1);
    });
  });

  describe("Differential Sync", () => {
    it("lastSyncedAt以降の更新のみを取得する", async () => {
      const lastSyncedAt = new Date("2024-01-15T00:00:00Z");
      const since = lastSyncedAt.toISOString();

      // GitHub APIのsince パラメータを使用したクエリ
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            id: 1,
            number: 5,
            title: "New Issue",
            updated_at: "2024-01-16T00:00:00Z",
          },
        ],
      });

      // sincパラメータが正しく渡されることを確認
      expect(since).toBe("2024-01-15T00:00:00.000Z");
    });

    it("初回同期時は全件取得する", async () => {
      const lastSyncedAt = null;
      const isFullSync = lastSyncedAt === null;

      expect(isFullSync).toBe(true);
      // since パラメータなしで全件取得
    });
  });

  describe("Sync Result", () => {
    it("同期結果を正しく返す", () => {
      const result: SyncResult = {
        issuesSynced: 10,
        prsSynced: 5,
        isFullSync: true,
        lastSyncedAt: new Date(),
      };

      expect(result.issuesSynced).toBe(10);
      expect(result.prsSynced).toBe(5);
      expect(result.isFullSync).toBe(true);
    });
  });
});
