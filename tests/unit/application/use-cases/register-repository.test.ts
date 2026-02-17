import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RegisterRepositoryUseCase,
  type RegisterRepositoryInput,
} from "@/application/use-cases/register-repository";
import type { Repository, NewRepository } from "@/infrastructure/database/schema";

// RepositoryRepositoryのモック
const mockCreate = vi.fn();
const mockFindByOwnerAndRepo = vi.fn();

vi.mock("@/infrastructure/repositories/repository-repository", () => ({
  RepositoryRepository: vi.fn().mockImplementation(() => ({
    create: mockCreate,
    findByOwnerAndRepo: mockFindByOwnerAndRepo,
  })),
}));

describe("RegisterRepositoryUseCase", () => {
  let useCase: RegisterRepositoryUseCase;

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

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RegisterRepositoryUseCase();
  });

  describe("バリデーション", () => {
    it("オーナー名が空の場合エラーを返す", async () => {
      const input: RegisterRepositoryInput = {
        ownerName: "",
        repoName: "test-repo",
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe("オーナー名とリポジトリ名は必須です");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("リポジトリ名が空の場合エラーを返す", async () => {
      const input: RegisterRepositoryInput = {
        ownerName: "test-owner",
        repoName: "",
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe("オーナー名とリポジトリ名は必須です");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("スプリント周期が1または2以外の場合エラーを返す", async () => {
      mockFindByOwnerAndRepo.mockResolvedValue(null);

      const input: RegisterRepositoryInput = {
        ownerName: "test-owner",
        repoName: "test-repo",
        sprintDurationWeeks: 3,
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe("スプリント周期は1または2週間である必要があります");
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("重複チェック", () => {
    it("既に登録済みのリポジトリの場合エラーを返す", async () => {
      const existingRepo = createMockRepository();
      mockFindByOwnerAndRepo.mockResolvedValue(existingRepo);

      const input: RegisterRepositoryInput = {
        ownerName: "test-owner",
        repoName: "test-repo",
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe("このリポジトリは既に登録されています");
      expect(mockFindByOwnerAndRepo).toHaveBeenCalledWith("test-owner", "test-repo");
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("正常系", () => {
    it("新しいリポジトリを正常に登録できる", async () => {
      mockFindByOwnerAndRepo.mockResolvedValue(null);
      const createdRepo = createMockRepository();
      mockCreate.mockResolvedValue(createdRepo);

      const input: RegisterRepositoryInput = {
        ownerName: "test-owner",
        repoName: "test-repo",
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.repository).toEqual(createdRepo);
      expect(mockCreate).toHaveBeenCalledWith({
        ownerName: "test-owner",
        repoName: "test-repo",
        trackingStartDate: undefined,
        sprintDurationWeeks: 1,
      });
    });

    it("スプリント周期2週間で登録できる", async () => {
      mockFindByOwnerAndRepo.mockResolvedValue(null);
      const createdRepo = createMockRepository({ sprintDurationWeeks: 2 });
      mockCreate.mockResolvedValue(createdRepo);

      const input: RegisterRepositoryInput = {
        ownerName: "test-owner",
        repoName: "test-repo",
        sprintDurationWeeks: 2,
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith({
        ownerName: "test-owner",
        repoName: "test-repo",
        trackingStartDate: undefined,
        sprintDurationWeeks: 2,
      });
    });

    it("trackingStartDateを指定して登録できる", async () => {
      mockFindByOwnerAndRepo.mockResolvedValue(null);
      const createdRepo = createMockRepository({ trackingStartDate: "2024-01-01" });
      mockCreate.mockResolvedValue(createdRepo);

      const input: RegisterRepositoryInput = {
        ownerName: "test-owner",
        repoName: "test-repo",
        trackingStartDate: "2024-01-01",
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith({
        ownerName: "test-owner",
        repoName: "test-repo",
        trackingStartDate: "2024-01-01",
        sprintDurationWeeks: 1,
      });
    });
  });
});
