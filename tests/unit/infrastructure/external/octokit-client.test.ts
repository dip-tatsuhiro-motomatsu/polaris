/**
 * OctokitGitHubClient実装のテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OctokitGitHubClient, getGitHubClient, setGitHubClient, resetGitHubClient } from "@/infrastructure/external/github";
import type { IGitHubClient } from "@/infrastructure/external/github";

// @octokit/rest モジュールをモック
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      repos: {
        get: vi.fn(),
        listContributors: vi.fn(),
      },
      issues: {
        listForRepo: vi.fn(),
      },
      pulls: {
        list: vi.fn(),
      },
    },
    graphql: vi.fn(),
  })),
}));

describe("OctokitGitHubClient", () => {
  const originalEnv = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "test-token";
    resetGitHubClient();
  });

  afterEach(() => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = originalEnv;
    resetGitHubClient();
  });

  describe("コンストラクタ", () => {
    it("環境変数からトークンを取得して初期化する", () => {
      const client = new OctokitGitHubClient();
      expect(client).toBeInstanceOf(OctokitGitHubClient);
    });

    it("configでトークンを指定して初期化できる", () => {
      const client = new OctokitGitHubClient({ token: "custom-token" });
      expect(client).toBeInstanceOf(OctokitGitHubClient);
    });

    it("トークンがない場合はエラーをスローする", () => {
      delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      expect(() => new OctokitGitHubClient()).toThrow(
        "GitHub token is required"
      );
    });
  });

  describe("getRepositoryInfo", () => {
    it("リポジトリ情報を取得して変換する", async () => {
      const { Octokit } = await import("@octokit/rest");
      const mockOctokit = vi.mocked(Octokit);
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          id: 123,
          name: "test-repo",
          full_name: "owner/test-repo",
          description: "Test repository",
          default_branch: "main",
          private: false,
        },
      });
      mockOctokit.mockImplementation(() => ({
        rest: {
          repos: { get: mockGet, listContributors: vi.fn() },
          issues: { listForRepo: vi.fn() },
          pulls: { list: vi.fn() },
        },
        graphql: vi.fn(),
      }) as unknown as ReturnType<typeof Octokit>);

      const client = new OctokitGitHubClient();
      const result = await client.getRepositoryInfo("owner", "test-repo");

      expect(result.id).toBe(123);
      expect(result.name).toBe("test-repo");
      expect(result.fullName).toBe("owner/test-repo");
      expect(result.description).toBe("Test repository");
      expect(result.defaultBranch).toBe("main");
      expect(result.private).toBe(false);
      expect(mockGet).toHaveBeenCalledWith({ owner: "owner", repo: "test-repo" });
    });
  });

  describe("getContributors", () => {
    it("コントリビューター一覧を取得して変換する", async () => {
      const { Octokit } = await import("@octokit/rest");
      const mockOctokit = vi.mocked(Octokit);
      const mockListContributors = vi.fn().mockResolvedValue({
        data: [
          { id: 1, login: "user1", avatar_url: "https://example.com/1.png", contributions: 10 },
          { id: 2, login: "user2", avatar_url: "https://example.com/2.png", contributions: 5 },
        ],
      });
      mockOctokit.mockImplementation(() => ({
        rest: {
          repos: { get: vi.fn(), listContributors: mockListContributors },
          issues: { listForRepo: vi.fn() },
          pulls: { list: vi.fn() },
        },
        graphql: vi.fn(),
      }) as unknown as ReturnType<typeof Octokit>);

      const client = new OctokitGitHubClient();
      const result = await client.getContributors("owner", "repo");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].login).toBe("user1");
      expect(result[0].avatarUrl).toBe("https://example.com/1.png");
      expect(result[0].contributions).toBe(10);
    });
  });

  describe("getLinkedIssuesForPR", () => {
    it("GraphQL APIでリンクされたIssue番号を取得する", async () => {
      const { Octokit } = await import("@octokit/rest");
      const mockOctokit = vi.mocked(Octokit);
      const mockGraphql = vi.fn().mockResolvedValue({
        repository: {
          pullRequest: {
            closingIssuesReferences: {
              nodes: [{ number: 1 }, { number: 2 }, { number: 3 }],
            },
          },
        },
      });
      mockOctokit.mockImplementation(() => ({
        rest: {
          repos: { get: vi.fn(), listContributors: vi.fn() },
          issues: { listForRepo: vi.fn() },
          pulls: { list: vi.fn() },
        },
        graphql: mockGraphql,
      }) as unknown as ReturnType<typeof Octokit>);

      const client = new OctokitGitHubClient();
      const result = await client.getLinkedIssuesForPR("owner", "repo", 10);

      expect(result).toEqual([1, 2, 3]);
    });
  });
});

describe("getGitHubClient / setGitHubClient", () => {
  const originalEnv = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "test-token";
    resetGitHubClient();
  });

  afterEach(() => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = originalEnv;
    resetGitHubClient();
  });

  it("シングルトンインスタンスを返す", () => {
    const client1 = getGitHubClient();
    const client2 = getGitHubClient();
    expect(client1).toBe(client2);
  });

  it("setGitHubClientでカスタムクライアントを設定できる", () => {
    const mockClient: IGitHubClient = {
      getRepositoryInfo: vi.fn(),
      getContributors: vi.fn(),
      getIssues: vi.fn(),
      getPullRequests: vi.fn(),
      getLinkedIssuesForPR: vi.fn(),
    };

    setGitHubClient(mockClient);
    const client = getGitHubClient();

    expect(client).toBe(mockClient);
  });

  it("resetGitHubClientでインスタンスをリセットできる", () => {
    const client1 = getGitHubClient();
    resetGitHubClient();
    const client2 = getGitHubClient();

    expect(client1).not.toBe(client2);
  });
});
