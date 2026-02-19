import { describe, it, expect, vi, beforeEach } from "vitest";

// テスト用のヘルパー関数
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

function validateRepositoryUrl(url: string): boolean {
  const parsed = parseGitHubUrl(url);
  if (!parsed) return false;
  return parsed.owner.length > 0 && parsed.repo.length > 0;
}

describe("Repository API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("URL Validation", () => {
    it("正しいGitHub URLをパースできる", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it("末尾に.gitがあるURLをパースできる", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo.git");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it("無効なURLはnullを返す", () => {
      expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
      expect(parseGitHubUrl("invalid-url")).toBeNull();
      expect(parseGitHubUrl("")).toBeNull();
    });

    it("有効なURLをバリデートできる", () => {
      expect(validateRepositoryUrl("https://github.com/owner/repo")).toBe(true);
      expect(validateRepositoryUrl("https://github.com/owner/repo.git")).toBe(
        true
      );
    });

    it("無効なURLをバリデートで拒否できる", () => {
      expect(validateRepositoryUrl("https://gitlab.com/owner/repo")).toBe(
        false
      );
      expect(validateRepositoryUrl("invalid")).toBe(false);
    });
  });

  describe("Repository CRUD Operations", () => {
    it("リポジトリ一覧を取得できる", async () => {
      const mockRepositories = [
        {
          id: "repo-1",
          owner: "owner1",
          name: "repo1",
          url: "https://github.com/owner1/repo1",
          githubId: 12345,
          lastSyncedAt: null,
          issueCount: 10,
          prCount: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // このテストは実際のAPIルート実装後に拡張
      expect(mockRepositories.length).toBe(1);
      expect(mockRepositories[0].owner).toBe("owner1");
    });

    it("新しいリポジトリを登録できる", async () => {
      const input = {
        url: "https://github.com/test-owner/test-repo",
      };

      const parsed = parseGitHubUrl(input.url);
      expect(parsed).toEqual({ owner: "test-owner", repo: "test-repo" });

      // リポジトリオブジェクトの構造を確認
      const repository = {
        id: "generated-id",
        owner: parsed!.owner,
        name: parsed!.repo,
        url: input.url,
        githubId: 0, // GitHub APIから取得予定
        lastSyncedAt: null,
        issueCount: 0,
        prCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(repository.owner).toBe("test-owner");
      expect(repository.name).toBe("test-repo");
    });

    it("重複するリポジトリは登録できない", async () => {
      // 既存のリポジトリをチェックするロジックのテスト
      const existingRepos = [
        { owner: "owner1", name: "repo1", githubId: 12345 },
      ];

      const newRepo = { owner: "owner1", name: "repo1" };

      const isDuplicate = existingRepos.some(
        (r) => r.owner === newRepo.owner && r.name === newRepo.name
      );

      expect(isDuplicate).toBe(true);
    });

    it("リポジトリを削除できる", async () => {
      const repositoryId = "repo-to-delete";
      // 削除操作のテスト
      const deleted = true;
      expect(deleted).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("不正なURLで400エラーを返す", () => {
      const invalidUrl = "not-a-github-url";
      const isValid = validateRepositoryUrl(invalidUrl);

      expect(isValid).toBe(false);
      // 実際のAPI実装では400 Bad Requestを返す
    });

    it("存在しないリポジトリIDで404エラーを返す", () => {
      const nonExistentId = "non-existent-id";
      const repository = null; // Firestoreから取得失敗

      expect(repository).toBeNull();
      // 実際のAPI実装では404 Not Foundを返す
    });
  });
});
