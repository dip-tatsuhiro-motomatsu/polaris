import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Repository, Issue, Collaborator } from "@/infrastructure/database/schema";

// モック定義
vi.mock("@/infrastructure/repositories/repository-repository", () => {
  const mockFindById = vi.fn();
  return {
    RepositoryRepository: vi.fn().mockImplementation(() => ({
      findById: mockFindById,
    })),
    __mockFindById: mockFindById,
  };
});

vi.mock("@/infrastructure/repositories/issue-repository", () => {
  const mockUpsertMany = vi.fn();
  const mockFindByRepositoryId = vi.fn();
  return {
    IssueRepository: vi.fn().mockImplementation(() => ({
      upsertMany: mockUpsertMany,
      findByRepositoryId: mockFindByRepositoryId,
    })),
    __mockUpsertMany: mockUpsertMany,
    __mockFindByRepositoryId: mockFindByRepositoryId,
  };
});

vi.mock("@/infrastructure/repositories/collaborator-repository", () => {
  const mockFindByRepositoryId = vi.fn();
  return {
    CollaboratorRepository: vi.fn().mockImplementation(() => ({
      findByRepositoryId: mockFindByRepositoryId,
    })),
    __mockFindByRepositoryId: mockFindByRepositoryId,
  };
});

vi.mock("@/lib/github/client", () => {
  const mockGetIssues = vi.fn();
  return {
    getIssues: mockGetIssues,
    __mockGetIssues: mockGetIssues,
  };
});

import { __mockFindById as mockRepoFindById } from "@/infrastructure/repositories/repository-repository";
import {
  __mockUpsertMany as mockIssueUpsertMany,
  __mockFindByRepositoryId as mockIssueFindByRepositoryId,
} from "@/infrastructure/repositories/issue-repository";
import { __mockFindByRepositoryId as mockCollabFindByRepositoryId } from "@/infrastructure/repositories/collaborator-repository";
import { __mockGetIssues as mockGetIssues } from "@/lib/github/client";

import {
  SyncIssuesUseCase,
  type SyncIssuesInput,
} from "@/application/use-cases/sync-issues";

describe("SyncIssuesUseCase", () => {
  let useCase: SyncIssuesUseCase;

  const createMockRepository = (overrides: Partial<Repository> = {}): Repository => ({
    id: 1,
    ownerName: "test-owner",
    repoName: "test-repo",
    patEncrypted: null,
    trackingStartDate: "2024-01-01",
    sprintStartDayOfWeek: 1,
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

  const createMockGitHubIssue = (overrides: Partial<{
    number: number;
    title: string;
    body: string | null;
    state: string;
    created_at: string;
    closed_at: string | null;
    user: { login: string } | null;
    assignee: { login: string } | null;
  }> = {}) => ({
    number: 123,
    title: "Test Issue",
    body: "Test body",
    state: "open",
    created_at: "2024-01-15T10:00:00Z",
    closed_at: null,
    user: { login: "author-user" },
    assignee: { login: "assignee-user" },
    pull_request: undefined,
    ...overrides,
  });

  const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
    id: 1,
    repositoryId: 1,
    githubNumber: 123,
    title: "Test Issue",
    body: "Test body",
    state: "open",
    authorCollaboratorId: 1,
    assigneeCollaboratorId: 2,
    sprintNumber: 1,
    githubCreatedAt: new Date("2024-01-15"),
    githubClosedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SyncIssuesUseCase();
  });

  describe("バリデーション", () => {
    it("存在しないリポジトリIDの場合エラーを返す", async () => {
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const input: SyncIssuesInput = { repositoryId: 999 };

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe("リポジトリが見つかりません");
    });
  });

  describe("Issue同期", () => {
    it("GitHubからIssueを取得してDBに保存できる", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubIssues = [
        createMockGitHubIssue({ number: 1, title: "Issue 1" }),
        createMockGitHubIssue({ number: 2, title: "Issue 2" }),
      ];
      (mockGetIssues as ReturnType<typeof vi.fn>).mockResolvedValue(githubIssues);

      const collaborators = [
        createMockCollaborator({ id: 1, githubUserName: "author-user" }),
        createMockCollaborator({ id: 2, githubUserName: "assignee-user" }),
      ];
      (mockCollabFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue(collaborators);

      const savedIssues = [
        createMockIssue({ id: 1, githubNumber: 1, title: "Issue 1" }),
        createMockIssue({ id: 2, githubNumber: 2, title: "Issue 2" }),
      ];
      (mockIssueUpsertMany as ReturnType<typeof vi.fn>).mockResolvedValue(savedIssues);

      const input: SyncIssuesInput = { repositoryId: 1 };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(2);
      expect(mockGetIssues).toHaveBeenCalledWith("test-owner", "test-repo", undefined);
      expect(mockIssueUpsertMany).toHaveBeenCalled();
    });

    it("PRはスキップされる", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubIssues = [
        createMockGitHubIssue({ number: 1, title: "Issue 1" }),
        { ...createMockGitHubIssue({ number: 2, title: "PR 1" }), pull_request: {} },
      ];
      (mockGetIssues as ReturnType<typeof vi.fn>).mockResolvedValue(githubIssues);

      const collaborators: Collaborator[] = [];
      (mockCollabFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue(collaborators);

      const savedIssues = [createMockIssue({ id: 1, githubNumber: 1, title: "Issue 1" })];
      (mockIssueUpsertMany as ReturnType<typeof vi.fn>).mockResolvedValue(savedIssues);

      const input: SyncIssuesInput = { repositoryId: 1 };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(1);
    });

    it("コラボレーターとの紐付けができる", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubIssues = [
        createMockGitHubIssue({
          number: 1,
          user: { login: "author-user" },
          assignee: { login: "assignee-user" },
        }),
      ];
      (mockGetIssues as ReturnType<typeof vi.fn>).mockResolvedValue(githubIssues);

      const collaborators = [
        createMockCollaborator({ id: 10, githubUserName: "author-user" }),
        createMockCollaborator({ id: 20, githubUserName: "assignee-user" }),
      ];
      (mockCollabFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue(collaborators);

      (mockIssueUpsertMany as ReturnType<typeof vi.fn>).mockImplementation((issues) => {
        return Promise.resolve(issues.map((i: { githubNumber: number }, idx: number) => ({
          ...createMockIssue(),
          id: idx + 1,
          githubNumber: i.githubNumber,
          authorCollaboratorId: 10,
          assigneeCollaboratorId: 20,
        })));
      });

      const input: SyncIssuesInput = { repositoryId: 1 };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      // upsertManyに渡されたデータにコラボレーターIDが含まれていることを確認
      const upsertCall = (mockIssueUpsertMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(upsertCall[0].authorCollaboratorId).toBe(10);
      expect(upsertCall[0].assigneeCollaboratorId).toBe(20);
    });

    it("差分同期（since指定）ができる", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubIssues = [createMockGitHubIssue({ number: 1 })];
      (mockGetIssues as ReturnType<typeof vi.fn>).mockResolvedValue(githubIssues);
      (mockCollabFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockIssueUpsertMany as ReturnType<typeof vi.fn>).mockResolvedValue([createMockIssue()]);

      const sinceDate = new Date("2024-01-01");
      const input: SyncIssuesInput = { repositoryId: 1, since: sinceDate };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(mockGetIssues).toHaveBeenCalledWith("test-owner", "test-repo", sinceDate);
    });

    it("GitHubからの取得に失敗した場合エラーを返す", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);
      (mockGetIssues as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("GitHub API error"));

      const input: SyncIssuesInput = { repositoryId: 1 };

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe("GitHubからのIssue取得に失敗しました");
    });
  });

  describe("速度スコア計算", () => {
    it("クローズされたIssueの完了時間を計算する", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      // 作成から24時間後にクローズ
      const githubIssues = [
        createMockGitHubIssue({
          number: 1,
          state: "closed",
          created_at: "2024-01-15T10:00:00Z",
          closed_at: "2024-01-16T10:00:00Z",
        }),
      ];
      (mockGetIssues as ReturnType<typeof vi.fn>).mockResolvedValue(githubIssues);
      (mockCollabFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      (mockIssueUpsertMany as ReturnType<typeof vi.fn>).mockImplementation((issues) => {
        return Promise.resolve(issues);
      });

      const input: SyncIssuesInput = { repositoryId: 1 };

      await useCase.execute(input);

      // upsertManyに渡されたデータを確認
      const upsertCall = (mockIssueUpsertMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(upsertCall[0].state).toBe("closed");
      expect(upsertCall[0].githubClosedAt).toBeDefined();
    });
  });
});
