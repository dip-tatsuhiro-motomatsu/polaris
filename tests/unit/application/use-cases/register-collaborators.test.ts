import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Repository, Collaborator, NewCollaborator } from "@/infrastructure/database/schema";

// RepositoryRepositoryのモック
vi.mock("@/infrastructure/repositories/repository-repository", () => {
  const mockFindById = vi.fn();
  return {
    RepositoryRepository: vi.fn().mockImplementation(() => ({
      findById: mockFindById,
    })),
    __mockFindById: mockFindById,
  };
});

// CollaboratorRepositoryのモック
vi.mock("@/infrastructure/repositories/collaborator-repository", () => {
  const mockFindByRepositoryId = vi.fn();
  const mockCreateMany = vi.fn();
  const mockDeleteByRepositoryId = vi.fn();
  return {
    CollaboratorRepository: vi.fn().mockImplementation(() => ({
      findByRepositoryId: mockFindByRepositoryId,
      createMany: mockCreateMany,
      deleteByRepositoryId: mockDeleteByRepositoryId,
    })),
    __mockFindByRepositoryId: mockFindByRepositoryId,
    __mockCreateMany: mockCreateMany,
    __mockDeleteByRepositoryId: mockDeleteByRepositoryId,
  };
});

// GitHubクライアントのモック
vi.mock("@/lib/github/client", () => {
  const mockGetContributors = vi.fn();
  return {
    getContributors: mockGetContributors,
    __mockGetContributors: mockGetContributors,
  };
});

// モック関数へのアクセス
import { __mockFindById as mockFindById } from "@/infrastructure/repositories/repository-repository";
import {
  __mockFindByRepositoryId as mockFindByRepositoryId,
  __mockCreateMany as mockCreateMany,
} from "@/infrastructure/repositories/collaborator-repository";
import { __mockGetContributors as mockGetContributors } from "@/lib/github/client";

// テスト対象
import {
  RegisterCollaboratorsUseCase,
  type RegisterCollaboratorsInput,
} from "@/application/use-cases/register-collaborators";

describe("RegisterCollaboratorsUseCase", () => {
  let useCase: RegisterCollaboratorsUseCase;

  const createMockRepository = (overrides: Partial<Repository> = {}): Repository => ({
    id: 1,
    ownerName: "test-owner",
    repoName: "test-repo",
    patEncrypted: null,
    trackingStartDate: null,
    sprintStartDayOfWeek: null,
    sprintDurationWeeks: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockCollaborator = (overrides: Partial<Collaborator> = {}): Collaborator => ({
    id: 1,
    repositoryId: 1,
    githubUserName: "test-user",
    displayName: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockGitHubContributor = (login: string, contributions: number = 10) => ({
    login,
    avatar_url: `https://github.com/${login}.png`,
    contributions,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RegisterCollaboratorsUseCase();
  });

  describe("バリデーション", () => {
    it("存在しないリポジトリIDの場合エラーを返す", async () => {
      (mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const input: RegisterCollaboratorsInput = {
        repositoryId: 999,
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe("リポジトリが見つかりません");
      expect(mockGetContributors).not.toHaveBeenCalled();
    });
  });

  describe("GitHubからコントリビューター取得", () => {
    it("GitHubからコントリビューターを取得してDBに登録できる", async () => {
      const mockRepo = createMockRepository();
      (mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubContributors = [
        createMockGitHubContributor("user1", 50),
        createMockGitHubContributor("user2", 30),
      ];
      (mockGetContributors as ReturnType<typeof vi.fn>).mockResolvedValue(githubContributors);
      (mockFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const createdCollaborators = [
        createMockCollaborator({ id: 1, githubUserName: "user1" }),
        createMockCollaborator({ id: 2, githubUserName: "user2" }),
      ];
      (mockCreateMany as ReturnType<typeof vi.fn>).mockResolvedValue(createdCollaborators);

      const input: RegisterCollaboratorsInput = {
        repositoryId: 1,
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.collaborators).toHaveLength(2);
      expect(mockGetContributors).toHaveBeenCalledWith("test-owner", "test-repo");
      expect(mockCreateMany).toHaveBeenCalled();
    });

    it("GitHubからの取得に失敗した場合エラーを返す", async () => {
      const mockRepo = createMockRepository();
      (mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);
      (mockGetContributors as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("GitHub API error"));

      const input: RegisterCollaboratorsInput = {
        repositoryId: 1,
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe("GitHubからのコントリビューター取得に失敗しました");
    });
  });

  describe("既存コラボレーターとの同期", () => {
    it("既存のコラボレーターがいる場合は差分のみ登録する", async () => {
      const mockRepo = createMockRepository();
      (mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubContributors = [
        createMockGitHubContributor("user1"),
        createMockGitHubContributor("user2"),
        createMockGitHubContributor("user3"),
      ];
      (mockGetContributors as ReturnType<typeof vi.fn>).mockResolvedValue(githubContributors);

      // user1は既に登録済み
      const existingCollaborators = [
        createMockCollaborator({ id: 1, githubUserName: "user1" }),
      ];
      (mockFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue(existingCollaborators);

      const newCollaborators = [
        createMockCollaborator({ id: 2, githubUserName: "user2" }),
        createMockCollaborator({ id: 3, githubUserName: "user3" }),
      ];
      (mockCreateMany as ReturnType<typeof vi.fn>).mockResolvedValue(newCollaborators);

      const input: RegisterCollaboratorsInput = {
        repositoryId: 1,
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      // 既存1 + 新規2 = 合計3
      expect(result.collaborators).toHaveLength(3);
      // 新規のみcreateMany
      expect(mockCreateMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ githubUserName: "user2" }),
          expect.objectContaining({ githubUserName: "user3" }),
        ])
      );
    });

    it("全員が既に登録済みの場合は何も登録しない", async () => {
      const mockRepo = createMockRepository();
      (mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubContributors = [
        createMockGitHubContributor("user1"),
      ];
      (mockGetContributors as ReturnType<typeof vi.fn>).mockResolvedValue(githubContributors);

      const existingCollaborators = [
        createMockCollaborator({ id: 1, githubUserName: "user1" }),
      ];
      (mockFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue(existingCollaborators);

      const input: RegisterCollaboratorsInput = {
        repositoryId: 1,
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.collaborators).toHaveLength(1);
      expect(mockCreateMany).not.toHaveBeenCalled();
    });
  });

  describe("選択されたコラボレーターのみ登録", () => {
    it("selectedGithubUsersが指定された場合、そのユーザーのみ登録する", async () => {
      const mockRepo = createMockRepository();
      (mockFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubContributors = [
        createMockGitHubContributor("user1"),
        createMockGitHubContributor("user2"),
        createMockGitHubContributor("user3"),
      ];
      (mockGetContributors as ReturnType<typeof vi.fn>).mockResolvedValue(githubContributors);
      (mockFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const createdCollaborators = [
        createMockCollaborator({ id: 1, githubUserName: "user1" }),
        createMockCollaborator({ id: 2, githubUserName: "user3" }),
      ];
      (mockCreateMany as ReturnType<typeof vi.fn>).mockResolvedValue(createdCollaborators);

      const input: RegisterCollaboratorsInput = {
        repositoryId: 1,
        selectedGithubUsers: ["user1", "user3"],
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.collaborators).toHaveLength(2);
      expect(mockCreateMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ githubUserName: "user1" }),
          expect.objectContaining({ githubUserName: "user3" }),
        ])
      );
    });
  });
});
