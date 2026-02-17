import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Issue, NewIssue } from "@/infrastructure/database/schema";

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

// issuesスキーマのモック
vi.mock("@/infrastructure/database/schema", () => ({
  issues: {
    id: "id",
    repositoryId: "repository_id",
    githubNumber: "github_number",
  },
}));

// drizzle-ormのモック
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value, type: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, type: "and" })),
}));

import { IssueRepository } from "@/infrastructure/repositories/issue-repository";

describe("IssueRepository", () => {
  let repository: IssueRepository;

  const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
    id: 1,
    repositoryId: 1,
    githubNumber: 123,
    title: "Test Issue",
    body: "Test body",
    state: "open",
    authorCollaboratorId: 1,
    assigneeCollaboratorId: null,
    githubCreatedAt: new Date("2024-01-01"),
    githubClosedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new IssueRepository();

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
    it("新しいIssueを作成できる", async () => {
      const newIssue: NewIssue = {
        repositoryId: 1,
        githubNumber: 123,
        title: "Test Issue",
        body: "Test body",
        state: "open",
        githubCreatedAt: new Date("2024-01-01"),
      };
      const createdIssue = createMockIssue();
      mockReturning.mockResolvedValue([createdIssue]);

      const result = await repository.create(newIssue);

      expect(result).toEqual(createdIssue);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(newIssue);
    });
  });

  describe("upsert", () => {
    it("新規Issueを挿入できる", async () => {
      const newIssue: NewIssue = {
        repositoryId: 1,
        githubNumber: 123,
        title: "Test Issue",
        body: "Test body",
        state: "open",
        githubCreatedAt: new Date("2024-01-01"),
      };
      const upsertedIssue = createMockIssue();
      mockReturning.mockResolvedValue([upsertedIssue]);

      const result = await repository.upsert(newIssue);

      expect(result).toEqual(upsertedIssue);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it("既存Issueを更新できる", async () => {
      const existingIssue: NewIssue = {
        repositoryId: 1,
        githubNumber: 123,
        title: "Updated Issue",
        body: "Updated body",
        state: "closed",
        githubCreatedAt: new Date("2024-01-01"),
        githubClosedAt: new Date("2024-01-02"),
      };
      const updatedIssue = createMockIssue({
        title: "Updated Issue",
        body: "Updated body",
        state: "closed",
        githubClosedAt: new Date("2024-01-02"),
      });
      mockReturning.mockResolvedValue([updatedIssue]);

      const result = await repository.upsert(existingIssue);

      expect(result).toEqual(updatedIssue);
    });
  });

  describe("upsertMany", () => {
    it("複数のIssueを一括upsertできる", async () => {
      const issues: NewIssue[] = [
        {
          repositoryId: 1,
          githubNumber: 123,
          title: "Issue 1",
          state: "open",
          githubCreatedAt: new Date("2024-01-01"),
        },
        {
          repositoryId: 1,
          githubNumber: 124,
          title: "Issue 2",
          state: "open",
          githubCreatedAt: new Date("2024-01-02"),
        },
      ];
      const upsertedIssues = [
        createMockIssue({ id: 1, githubNumber: 123, title: "Issue 1" }),
        createMockIssue({ id: 2, githubNumber: 124, title: "Issue 2" }),
      ];
      mockReturning.mockResolvedValue(upsertedIssues);

      const result = await repository.upsertMany(issues);

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
    it("存在するIDでIssueを取得できる", async () => {
      const mockIssue = createMockIssue();
      mockLimit.mockResolvedValue([mockIssue]);

      const result = await repository.findById(1);

      expect(result).toEqual(mockIssue);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("存在しないIDの場合nullを返す", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe("findByRepositoryId", () => {
    it("リポジトリIDでIssue一覧を取得できる", async () => {
      const mockIssues = [
        createMockIssue({ id: 1, githubNumber: 123 }),
        createMockIssue({ id: 2, githubNumber: 124 }),
      ];
      mockWhere.mockResolvedValue(mockIssues);

      const result = await repository.findByRepositoryId(1);

      expect(result).toEqual(mockIssues);
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe("findByGithubNumber", () => {
    it("リポジトリIDとgithubNumberでIssueを取得できる", async () => {
      const mockIssue = createMockIssue();
      mockLimit.mockResolvedValue([mockIssue]);

      const result = await repository.findByGithubNumber(1, 123);

      expect(result).toEqual(mockIssue);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("見つからない場合はnullを返す", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await repository.findByGithubNumber(1, 999);

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("Issueを更新できる", async () => {
      const updatedIssue = createMockIssue({ state: "closed" });
      mockReturning.mockResolvedValue([updatedIssue]);

      const result = await repository.update(1, { state: "closed" });

      expect(result).toEqual(updatedIssue);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("存在しないIDの場合はnullを返す", async () => {
      mockReturning.mockResolvedValue([]);

      const result = await repository.update(999, { state: "closed" });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("Issueを削除できる", async () => {
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
    it("リポジトリIDで全てのIssueを削除できる", async () => {
      mockWhere.mockResolvedValue({ rowCount: 5 });

      const result = await repository.deleteByRepositoryId(1);

      expect(result).toBe(5);
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
