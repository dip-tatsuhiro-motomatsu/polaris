import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PullRequest, NewPullRequest } from "@/infrastructure/database/schema";

// Drizzle ORMのモック
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

vi.mock("@/infrastructure/database", () => ({
  db: {
    insert: () => {
      mockInsert();
      return { values: mockValues };
    },
    select: () => {
      mockSelect();
      return { from: mockFrom };
    },
    update: () => {
      mockUpdate();
      return { set: mockSet };
    },
    delete: () => {
      mockDelete();
      return { where: mockWhere };
    },
  },
}));

// pullRequestsスキーマのモック
vi.mock("@/infrastructure/database/schema", () => ({
  pullRequests: {
    id: "id",
    repositoryId: "repository_id",
    githubNumber: "github_number",
    issueId: "issue_id",
  },
}));

// drizzle-ormのモック
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value, type: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, type: "and" })),
}));

import { PullRequestRepository } from "@/infrastructure/repositories/pull-request-repository";

describe("PullRequestRepository", () => {
  let repository: PullRequestRepository;

  const createMockPullRequest = (overrides: Partial<PullRequest> = {}): PullRequest => ({
    id: 1,
    repositoryId: 1,
    issueId: null,
    githubNumber: 456,
    title: "Test PR",
    state: "open",
    authorCollaboratorId: 1,
    githubCreatedAt: new Date("2024-01-01"),
    githubMergedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new PullRequestRepository();

    // チェーンメソッドのセットアップ
    mockValues.mockReturnValue({
      returning: mockReturning,
      onConflictDoUpdate: mockOnConflictDoUpdate,
    });
    mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit, returning: mockReturning });
    mockLimit.mockReturnValue([]);
    mockSet.mockReturnValue({ where: mockWhere });
  });

  describe("create", () => {
    it("新しいPullRequestを作成できる", async () => {
      const newPR: NewPullRequest = {
        repositoryId: 1,
        githubNumber: 456,
        title: "Test PR",
        state: "open",
        githubCreatedAt: new Date("2024-01-01"),
      };
      const createdPR = createMockPullRequest();
      mockReturning.mockResolvedValue([createdPR]);

      const result = await repository.create(newPR);

      expect(result).toEqual(createdPR);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(newPR);
    });
  });

  describe("upsert", () => {
    it("新規PRを挿入できる", async () => {
      const newPR: NewPullRequest = {
        repositoryId: 1,
        githubNumber: 456,
        title: "Test PR",
        state: "open",
        githubCreatedAt: new Date("2024-01-01"),
      };
      const upsertedPR = createMockPullRequest();
      mockReturning.mockResolvedValue([upsertedPR]);

      const result = await repository.upsert(newPR);

      expect(result).toEqual(upsertedPR);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it("既存PRを更新できる", async () => {
      const existingPR: NewPullRequest = {
        repositoryId: 1,
        githubNumber: 456,
        title: "Updated PR",
        state: "merged",
        githubCreatedAt: new Date("2024-01-01"),
        githubMergedAt: new Date("2024-01-02"),
      };
      const updatedPR = createMockPullRequest({
        title: "Updated PR",
        state: "merged",
        githubMergedAt: new Date("2024-01-02"),
      });
      mockReturning.mockResolvedValue([updatedPR]);

      const result = await repository.upsert(existingPR);

      expect(result).toEqual(updatedPR);
    });
  });

  describe("upsertMany", () => {
    it("複数のPRを一括upsertできる", async () => {
      const prs: NewPullRequest[] = [
        {
          repositoryId: 1,
          githubNumber: 456,
          title: "PR 1",
          state: "open",
          githubCreatedAt: new Date("2024-01-01"),
        },
        {
          repositoryId: 1,
          githubNumber: 457,
          title: "PR 2",
          state: "open",
          githubCreatedAt: new Date("2024-01-02"),
        },
      ];
      const upsertedPRs = [
        createMockPullRequest({ id: 1, githubNumber: 456, title: "PR 1" }),
        createMockPullRequest({ id: 2, githubNumber: 457, title: "PR 2" }),
      ];
      mockReturning.mockResolvedValue(upsertedPRs);

      const result = await repository.upsertMany(prs);

      expect(result).toHaveLength(2);
      expect(mockInsert).toHaveBeenCalled();
    });

    it("空の配列の場合は空配列を返す", async () => {
      const result = await repository.upsertMany([]);

      expect(result).toEqual([]);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("存在するIDでPRを取得できる", async () => {
      const mockPR = createMockPullRequest();
      mockLimit.mockResolvedValue([mockPR]);

      const result = await repository.findById(1);

      expect(result).toEqual(mockPR);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("存在しないIDの場合nullを返す", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe("findByRepositoryId", () => {
    it("リポジトリIDでPR一覧を取得できる", async () => {
      const mockPRs = [
        createMockPullRequest({ id: 1, githubNumber: 456 }),
        createMockPullRequest({ id: 2, githubNumber: 457 }),
      ];
      mockWhere.mockResolvedValue(mockPRs);

      const result = await repository.findByRepositoryId(1);

      expect(result).toEqual(mockPRs);
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe("findByGithubNumber", () => {
    it("リポジトリIDとgithubNumberでPRを取得できる", async () => {
      const mockPR = createMockPullRequest();
      mockLimit.mockResolvedValue([mockPR]);

      const result = await repository.findByGithubNumber(1, 456);

      expect(result).toEqual(mockPR);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("見つからない場合はnullを返す", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await repository.findByGithubNumber(1, 999);

      expect(result).toBeNull();
    });
  });

  describe("findByIssueId", () => {
    it("IssueIDでリンクされたPRを取得できる", async () => {
      const mockPRs = [
        createMockPullRequest({ id: 1, issueId: 10 }),
        createMockPullRequest({ id: 2, issueId: 10 }),
      ];
      mockWhere.mockResolvedValue(mockPRs);

      const result = await repository.findByIssueId(10);

      expect(result).toEqual(mockPRs);
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("PRを更新できる", async () => {
      const updatedPR = createMockPullRequest({ state: "merged" });
      mockReturning.mockResolvedValue([updatedPR]);

      const result = await repository.update(1, { state: "merged" });

      expect(result).toEqual(updatedPR);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("存在しないIDの場合はnullを返す", async () => {
      mockReturning.mockResolvedValue([]);

      const result = await repository.update(999, { state: "merged" });

      expect(result).toBeNull();
    });
  });

  describe("linkToIssue", () => {
    it("PRをIssueに紐付けできる", async () => {
      const linkedPR = createMockPullRequest({ issueId: 10 });
      mockReturning.mockResolvedValue([linkedPR]);

      const result = await repository.linkToIssue(1, 10);

      expect(result).toEqual(linkedPR);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("PRを削除できる", async () => {
      mockWhere.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete(1);

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("存在しないIDの場合はfalseを返す", async () => {
      mockWhere.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });
  });

  describe("deleteByRepositoryId", () => {
    it("リポジトリIDで全てのPRを削除できる", async () => {
      mockWhere.mockResolvedValue({ rowCount: 3 });

      const result = await repository.deleteByRepositoryId(1);

      expect(result).toBe(3);
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
