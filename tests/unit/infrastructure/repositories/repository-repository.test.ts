import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Repository, NewRepository } from "@/infrastructure/database/schema";

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

// repositoriesスキーマのモック
vi.mock("@/infrastructure/database/schema", () => ({
  repositories: {
    id: "id",
    ownerName: "owner_name",
    repoName: "repo_name",
  },
}));

// drizzle-ormのモック
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value, type: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, type: "and" })),
}));

import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";

describe("RepositoryRepository", () => {
  let repository: RepositoryRepository;

  const createMockRepository = (overrides: Partial<Repository> = {}): Repository => ({
    id: 1,
    ownerName: "test-owner",
    repoName: "test-repo",
    patEncrypted: null,
    trackingStartDate: null,
    sprintStartDayOfWeek: null,
    sprintDurationWeeks: 1,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new RepositoryRepository();

    // チェーンメソッドのセットアップ
    mockValues.mockReturnValue({ returning: mockReturning });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit, returning: mockReturning });
    mockLimit.mockReturnValue([]);
    mockSet.mockReturnValue({ where: mockWhere });
  });

  describe("create", () => {
    it("新しいリポジトリを作成できる", async () => {
      const newRepo: NewRepository = {
        ownerName: "test-owner",
        repoName: "test-repo",
        sprintDurationWeeks: 1,
      };
      const createdRepo = createMockRepository();
      mockReturning.mockResolvedValue([createdRepo]);

      const result = await repository.create(newRepo);

      expect(result).toEqual(createdRepo);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(newRepo);
    });
  });

  describe("findById", () => {
    it("存在するIDでリポジトリを取得できる", async () => {
      const mockRepo = createMockRepository();
      mockLimit.mockResolvedValue([mockRepo]);

      const result = await repository.findById(1);

      expect(result).toEqual(mockRepo);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("存在しないIDの場合nullを返す", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe("findByOwnerAndRepo", () => {
    it("オーナー名とリポジトリ名でリポジトリを取得できる", async () => {
      const mockRepo = createMockRepository();
      mockLimit.mockResolvedValue([mockRepo]);

      const result = await repository.findByOwnerAndRepo("test-owner", "test-repo");

      expect(result).toEqual(mockRepo);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("見つからない場合nullを返す", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await repository.findByOwnerAndRepo("unknown-owner", "unknown-repo");

      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("全てのリポジトリを取得できる", async () => {
      const mockRepos = [
        createMockRepository({ id: 1, ownerName: "owner1", repoName: "repo1" }),
        createMockRepository({ id: 2, ownerName: "owner2", repoName: "repo2" }),
      ];
      mockFrom.mockResolvedValue(mockRepos);

      const result = await repository.findAll();

      expect(result).toEqual(mockRepos);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("リポジトリがない場合空配列を返す", async () => {
      mockFrom.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("リポジトリを更新できる", async () => {
      const updatedRepo = createMockRepository({ sprintDurationWeeks: 2 });
      mockReturning.mockResolvedValue([updatedRepo]);

      const result = await repository.update(1, { sprintDurationWeeks: 2 });

      expect(result).toEqual(updatedRepo);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("存在しないIDの場合nullを返す", async () => {
      mockReturning.mockResolvedValue([]);

      const result = await repository.update(999, { sprintDurationWeeks: 2 });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("リポジトリを削除できる", async () => {
      mockWhere.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete(1);

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("存在しないIDの場合falseを返す", async () => {
      mockWhere.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });
  });
});
