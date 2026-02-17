import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Repository, PullRequest, Collaborator } from "@/infrastructure/database/schema";

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

vi.mock("@/infrastructure/repositories/pull-request-repository", () => {
  const mockUpsertMany = vi.fn();
  const mockFindByRepositoryId = vi.fn();
  return {
    PullRequestRepository: vi.fn().mockImplementation(() => ({
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
  const mockGetPullRequests = vi.fn();
  return {
    getPullRequests: mockGetPullRequests,
    __mockGetPullRequests: mockGetPullRequests,
  };
});

import { __mockFindById as mockRepoFindById } from "@/infrastructure/repositories/repository-repository";
import {
  __mockUpsertMany as mockPRUpsertMany,
} from "@/infrastructure/repositories/pull-request-repository";
import { __mockFindByRepositoryId as mockCollabFindByRepositoryId } from "@/infrastructure/repositories/collaborator-repository";
import { __mockGetPullRequests as mockGetPullRequests } from "@/lib/github/client";

import {
  SyncPullRequestsUseCase,
  type SyncPullRequestsInput,
} from "@/application/use-cases/sync-pull-requests";

describe("SyncPullRequestsUseCase", () => {
  let useCase: SyncPullRequestsUseCase;

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

  const createMockGitHubPR = (overrides: Partial<{
    number: number;
    title: string;
    state: string;
    created_at: string;
    merged_at: string | null;
    user: { login: string } | null;
    body: string | null;
  }> = {}) => ({
    number: 456,
    title: "Test PR",
    state: "open",
    created_at: "2024-01-15T10:00:00Z",
    merged_at: null,
    user: { login: "author-user" },
    body: "PR body",
    ...overrides,
  });

  const createMockPullRequest = (overrides: Partial<PullRequest> = {}): PullRequest => ({
    id: 1,
    repositoryId: 1,
    issueId: null,
    githubNumber: 456,
    title: "Test PR",
    state: "open",
    authorCollaboratorId: 1,
    githubCreatedAt: new Date("2024-01-15"),
    githubMergedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SyncPullRequestsUseCase();
  });

  describe("バリデーション", () => {
    it("存在しないリポジトリIDの場合エラーを返す", async () => {
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const input: SyncPullRequestsInput = { repositoryId: 999 };

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe("リポジトリが見つかりません");
    });
  });

  describe("PR同期", () => {
    it("GitHubからPRを取得してDBに保存できる", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubPRs = [
        createMockGitHubPR({ number: 1, title: "PR 1" }),
        createMockGitHubPR({ number: 2, title: "PR 2" }),
      ];
      (mockGetPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(githubPRs);

      const collaborators = [
        createMockCollaborator({ id: 1, githubUserName: "author-user" }),
      ];
      (mockCollabFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue(collaborators);

      const savedPRs = [
        createMockPullRequest({ id: 1, githubNumber: 1, title: "PR 1" }),
        createMockPullRequest({ id: 2, githubNumber: 2, title: "PR 2" }),
      ];
      (mockPRUpsertMany as ReturnType<typeof vi.fn>).mockResolvedValue(savedPRs);

      const input: SyncPullRequestsInput = { repositoryId: 1 };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(2);
      expect(mockGetPullRequests).toHaveBeenCalledWith("test-owner", "test-repo", undefined);
      expect(mockPRUpsertMany).toHaveBeenCalled();
    });

    it("コラボレーターとの紐付けができる", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubPRs = [
        createMockGitHubPR({ number: 1, user: { login: "author-user" } }),
      ];
      (mockGetPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(githubPRs);

      const collaborators = [
        createMockCollaborator({ id: 10, githubUserName: "author-user" }),
      ];
      (mockCollabFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue(collaborators);

      (mockPRUpsertMany as ReturnType<typeof vi.fn>).mockImplementation((prs) => {
        return Promise.resolve(prs.map((p: { githubNumber: number }, idx: number) => ({
          ...createMockPullRequest(),
          id: idx + 1,
          githubNumber: p.githubNumber,
          authorCollaboratorId: 10,
        })));
      });

      const input: SyncPullRequestsInput = { repositoryId: 1 };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      const upsertCall = (mockPRUpsertMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(upsertCall[0].authorCollaboratorId).toBe(10);
    });

    it("差分同期（since指定）ができる", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubPRs = [createMockGitHubPR({ number: 1 })];
      (mockGetPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(githubPRs);
      (mockCollabFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPRUpsertMany as ReturnType<typeof vi.fn>).mockResolvedValue([createMockPullRequest()]);

      const sinceDate = new Date("2024-01-01");
      const input: SyncPullRequestsInput = { repositoryId: 1, since: sinceDate };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(mockGetPullRequests).toHaveBeenCalledWith("test-owner", "test-repo", sinceDate);
    });

    it("GitHubからの取得に失敗した場合エラーを返す", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);
      (mockGetPullRequests as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("GitHub API error"));

      const input: SyncPullRequestsInput = { repositoryId: 1 };

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe("GitHubからのPR取得に失敗しました");
    });

    it("マージ日時を保存できる", async () => {
      const mockRepo = createMockRepository();
      (mockRepoFindById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRepo);

      const githubPRs = [
        createMockGitHubPR({
          number: 1,
          state: "closed",
          merged_at: "2024-01-16T10:00:00Z",
        }),
      ];
      (mockGetPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(githubPRs);
      (mockCollabFindByRepositoryId as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      (mockPRUpsertMany as ReturnType<typeof vi.fn>).mockImplementation((prs) => {
        return Promise.resolve(prs);
      });

      const input: SyncPullRequestsInput = { repositoryId: 1 };

      await useCase.execute(input);

      const upsertCall = (mockPRUpsertMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(upsertCall[0].state).toBe("closed");
      expect(upsertCall[0].githubMergedAt).toEqual(new Date("2024-01-16T10:00:00Z"));
    });
  });
});
