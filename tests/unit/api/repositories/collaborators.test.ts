import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Collaborator } from "@/infrastructure/database/schema";

// RegisterCollaboratorsUseCaseのモック
vi.mock("@/application/use-cases/register-collaborators", () => {
  const mockExecute = vi.fn();
  return {
    RegisterCollaboratorsUseCase: vi.fn().mockImplementation(() => ({
      execute: mockExecute,
    })),
    __mockExecute: mockExecute,
  };
});

import { __mockExecute as mockExecute } from "@/application/use-cases/register-collaborators";

// テスト対象（まだ存在しない）
import { POST } from "@/app/api/repositories/[id]/collaborators/route";

describe("POST /api/repositories/[id]/collaborators", () => {
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
  });

  it("コラボレーターを正常に登録できる", async () => {
    const collaborators = [
      createMockCollaborator({ id: 1, githubUserName: "user1" }),
      createMockCollaborator({ id: 2, githubUserName: "user2" }),
    ];
    (mockExecute as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      collaborators,
    });

    const request = new NextRequest("http://localhost/api/repositories/1/collaborators", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.collaborators).toHaveLength(2);
    expect(mockExecute).toHaveBeenCalledWith({
      repositoryId: 1,
      selectedGithubUsers: undefined,
    });
  });

  it("selectedGithubUsersを指定して登録できる", async () => {
    const collaborators = [
      createMockCollaborator({ id: 1, githubUserName: "user1" }),
    ];
    (mockExecute as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      collaborators,
    });

    const request = new NextRequest("http://localhost/api/repositories/1/collaborators", {
      method: "POST",
      body: JSON.stringify({ selectedGithubUsers: ["user1"] }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.collaborators).toHaveLength(1);
    expect(mockExecute).toHaveBeenCalledWith({
      repositoryId: 1,
      selectedGithubUsers: ["user1"],
    });
  });

  it("無効なリポジトリIDの場合400エラーを返す", async () => {
    const request = new NextRequest("http://localhost/api/repositories/invalid/collaborators", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "invalid" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("無効なリポジトリIDです");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("ユースケースがエラーを返した場合400エラーを返す", async () => {
    (mockExecute as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "リポジトリが見つかりません",
    });

    const request = new NextRequest("http://localhost/api/repositories/999/collaborators", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "999" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("リポジトリが見つかりません");
  });

  it("内部エラーの場合500エラーを返す", async () => {
    (mockExecute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unexpected error"));

    const request = new NextRequest("http://localhost/api/repositories/1/collaborators", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("コラボレーターの登録に失敗しました");
  });
});
