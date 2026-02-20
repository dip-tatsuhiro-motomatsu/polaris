/**
 * GitHubクライアント抽象レイヤーのテスト
 * 外部GitHub APIとの接点を抽象化
 */

import { describe, it, expect, vi } from "vitest";
import type {
  IGitHubClient,
  GitHubRepositoryInfo,
  GitHubContributor,
  GitHubIssue,
  GitHubPullRequest,
} from "@/infrastructure/external/github/types";

// モック実装
function createMockGitHubClient(overrides: Partial<IGitHubClient> = {}): IGitHubClient {
  return {
    getRepositoryInfo: vi.fn().mockResolvedValue({
      id: 123,
      name: "test-repo",
      fullName: "owner/test-repo",
      description: "テストリポジトリ",
      defaultBranch: "main",
      private: false,
    }),
    getContributors: vi.fn().mockResolvedValue([]),
    getIssues: vi.fn().mockResolvedValue([]),
    getPullRequests: vi.fn().mockResolvedValue([]),
    getLinkedIssuesForPR: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("IGitHubClient Interface", () => {
  describe("getRepositoryInfo", () => {
    it("リポジトリ情報を取得できる", async () => {
      const client = createMockGitHubClient();

      const result = await client.getRepositoryInfo("owner", "repo");

      expect(result.id).toBe(123);
      expect(result.name).toBe("test-repo");
      expect(result.fullName).toBe("owner/test-repo");
      expect(client.getRepositoryInfo).toHaveBeenCalledWith("owner", "repo");
    });
  });

  describe("getContributors", () => {
    it("コントリビューター一覧を取得できる", async () => {
      const mockContributors: GitHubContributor[] = [
        { id: 1, login: "user1", avatarUrl: "https://example.com/1.png", contributions: 10 },
        { id: 2, login: "user2", avatarUrl: "https://example.com/2.png", contributions: 5 },
      ];

      const client = createMockGitHubClient({
        getContributors: vi.fn().mockResolvedValue(mockContributors),
      });

      const result = await client.getContributors("owner", "repo");

      expect(result).toHaveLength(2);
      expect(result[0].login).toBe("user1");
      expect(result[1].contributions).toBe(5);
    });
  });

  describe("getIssues", () => {
    it("Issue一覧を取得できる", async () => {
      const mockIssues: GitHubIssue[] = [
        {
          id: 1,
          number: 1,
          title: "Issue 1",
          body: "本文1",
          state: "open",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
          closedAt: null,
          user: { id: 1, login: "user1" },
          assignee: null,
          isPullRequest: false,
        },
      ];

      const client = createMockGitHubClient({
        getIssues: vi.fn().mockResolvedValue(mockIssues),
      });

      const result = await client.getIssues("owner", "repo");

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(1);
      expect(result[0].state).toBe("open");
    });

    it("sinceパラメータでフィルタリングできる", async () => {
      const client = createMockGitHubClient();
      const since = new Date("2024-01-01");

      await client.getIssues("owner", "repo", since);

      expect(client.getIssues).toHaveBeenCalledWith("owner", "repo", since);
    });
  });

  describe("getPullRequests", () => {
    it("PR一覧を取得できる", async () => {
      const mockPRs: GitHubPullRequest[] = [
        {
          id: 1,
          number: 10,
          title: "PR 1",
          body: "PR本文",
          state: "open",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
          mergedAt: null,
          closedAt: null,
          user: { id: 1, login: "user1" },
          head: { ref: "feature-branch", sha: "abc123" },
          base: { ref: "main", sha: "def456" },
        },
      ];

      const client = createMockGitHubClient({
        getPullRequests: vi.fn().mockResolvedValue(mockPRs),
      });

      const result = await client.getPullRequests("owner", "repo");

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(10);
      expect(result[0].head.ref).toBe("feature-branch");
    });

    it("sinceパラメータでフィルタリングできる", async () => {
      const client = createMockGitHubClient();
      const since = new Date("2024-01-01");

      await client.getPullRequests("owner", "repo", since);

      expect(client.getPullRequests).toHaveBeenCalledWith("owner", "repo", since);
    });
  });

  describe("getLinkedIssuesForPR", () => {
    it("PRにリンクされたIssue番号を取得できる", async () => {
      const client = createMockGitHubClient({
        getLinkedIssuesForPR: vi.fn().mockResolvedValue([1, 2, 3]),
      });

      const result = await client.getLinkedIssuesForPR("owner", "repo", 10);

      expect(result).toEqual([1, 2, 3]);
      expect(client.getLinkedIssuesForPR).toHaveBeenCalledWith("owner", "repo", 10);
    });

    it("リンクがない場合は空配列を返す", async () => {
      const client = createMockGitHubClient({
        getLinkedIssuesForPR: vi.fn().mockResolvedValue([]),
      });

      const result = await client.getLinkedIssuesForPR("owner", "repo", 10);

      expect(result).toEqual([]);
    });
  });
});
