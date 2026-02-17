import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Collaborator, NewCollaborator } from "@/infrastructure/database/schema";

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

// collaboratorsスキーマのモック
vi.mock("@/infrastructure/database/schema", () => ({
  collaborators: {
    id: "id",
    repositoryId: "repository_id",
    githubUserName: "github_user_name",
  },
}));

// drizzle-ormのモック
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value, type: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, type: "and" })),
}));

import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";

describe("CollaboratorRepository", () => {
  let repository: CollaboratorRepository;

  const createMockCollaborator = (overrides: Partial<Collaborator> = {}): Collaborator => ({
    id: 1,
    repositoryId: 1,
    githubUserName: "test-user",
    displayName: "Test User",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new CollaboratorRepository();

    // チェーンメソッドのセットアップ
    mockValues.mockReturnValue({ returning: mockReturning });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit, returning: mockReturning });
    mockLimit.mockReturnValue([]);
    mockSet.mockReturnValue({ where: mockWhere });
  });

  describe("create", () => {
    it("新しいコラボレーターを作成できる", async () => {
      const newCollaborator: NewCollaborator = {
        repositoryId: 1,
        githubUserName: "test-user",
        displayName: "Test User",
      };
      const createdCollaborator = createMockCollaborator();
      mockReturning.mockResolvedValue([createdCollaborator]);

      const result = await repository.create(newCollaborator);

      expect(result).toEqual(createdCollaborator);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(newCollaborator);
    });
  });

  describe("createMany", () => {
    it("複数のコラボレーターを一括作成できる", async () => {
      const collaborators: NewCollaborator[] = [
        { repositoryId: 1, githubUserName: "user1", displayName: "User 1" },
        { repositoryId: 1, githubUserName: "user2", displayName: "User 2" },
      ];
      const createdCollaborators = [
        createMockCollaborator({ id: 1, githubUserName: "user1", displayName: "User 1" }),
        createMockCollaborator({ id: 2, githubUserName: "user2", displayName: "User 2" }),
      ];
      mockReturning.mockResolvedValue(createdCollaborators);

      const result = await repository.createMany(collaborators);

      expect(result).toEqual(createdCollaborators);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(collaborators);
    });

    it("空の配列の場合は空配列を返す", async () => {
      const result = await repository.createMany([]);

      expect(result).toEqual([]);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("存在するIDでコラボレーターを取得できる", async () => {
      const mockCollaborator = createMockCollaborator();
      mockLimit.mockResolvedValue([mockCollaborator]);

      const result = await repository.findById(1);

      expect(result).toEqual(mockCollaborator);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("存在しないIDの場合nullを返す", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe("findByRepositoryId", () => {
    it("リポジトリIDでコラボレーター一覧を取得できる", async () => {
      const mockCollaborators = [
        createMockCollaborator({ id: 1, githubUserName: "user1" }),
        createMockCollaborator({ id: 2, githubUserName: "user2" }),
      ];
      mockWhere.mockResolvedValue(mockCollaborators);

      const result = await repository.findByRepositoryId(1);

      expect(result).toEqual(mockCollaborators);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("コラボレーターがいない場合は空配列を返す", async () => {
      mockWhere.mockResolvedValue([]);

      const result = await repository.findByRepositoryId(1);

      expect(result).toEqual([]);
    });
  });

  describe("findByRepositoryAndGithubUser", () => {
    it("リポジトリIDとGitHubユーザー名でコラボレーターを取得できる", async () => {
      const mockCollaborator = createMockCollaborator();
      mockLimit.mockResolvedValue([mockCollaborator]);

      const result = await repository.findByRepositoryAndGithubUser(1, "test-user");

      expect(result).toEqual(mockCollaborator);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("見つからない場合はnullを返す", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await repository.findByRepositoryAndGithubUser(1, "unknown-user");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("コラボレーターを更新できる", async () => {
      const updatedCollaborator = createMockCollaborator({ displayName: "Updated Name" });
      mockReturning.mockResolvedValue([updatedCollaborator]);

      const result = await repository.update(1, { displayName: "Updated Name" });

      expect(result).toEqual(updatedCollaborator);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("存在しないIDの場合はnullを返す", async () => {
      mockReturning.mockResolvedValue([]);

      const result = await repository.update(999, { displayName: "Updated Name" });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("コラボレーターを削除できる", async () => {
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
    it("リポジトリIDで全てのコラボレーターを削除できる", async () => {
      mockWhere.mockResolvedValue({ rowCount: 3 });

      const result = await repository.deleteByRepositoryId(1);

      expect(result).toBe(3);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("削除するコラボレーターがない場合は0を返す", async () => {
      mockWhere.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteByRepositoryId(1);

      expect(result).toBe(0);
    });
  });
});
