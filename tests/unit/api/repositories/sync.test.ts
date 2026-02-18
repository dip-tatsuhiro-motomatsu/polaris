import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Issue, PullRequest } from "@/infrastructure/database/schema";

// SyncIssuesUseCaseのモック
vi.mock("@/application/use-cases/sync-issues", () => {
  const mockExecute = vi.fn();
  return {
    SyncIssuesUseCase: vi.fn().mockImplementation(() => ({
      execute: mockExecute,
    })),
    __mockSyncIssuesExecute: mockExecute,
  };
});

// SyncPullRequestsUseCaseのモック
vi.mock("@/application/use-cases/sync-pull-requests", () => {
  const mockExecute = vi.fn();
  return {
    SyncPullRequestsUseCase: vi.fn().mockImplementation(() => ({
      execute: mockExecute,
    })),
    __mockSyncPRsExecute: mockExecute,
  };
});

import { __mockSyncIssuesExecute as mockSyncIssuesExecute } from "@/application/use-cases/sync-issues";
import { __mockSyncPRsExecute as mockSyncPRsExecute } from "@/application/use-cases/sync-pull-requests";

import { POST } from "@/app/api/repositories/[id]/sync/route";

describe("POST /api/repositories/[id]/sync", () => {
  const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
    id: 1,
    repositoryId: 1,
    githubNumber: 123,
    title: "Test Issue",
    body: "Test body",
    state: "open",
    authorCollaboratorId: null,
    assigneeCollaboratorId: null,
    sprintNumber: 1,
    githubCreatedAt: new Date("2024-01-15"),
    githubClosedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockPullRequest = (overrides: Partial<PullRequest> = {}): PullRequest => ({
    id: 1,
    repositoryId: 1,
    issueId: null,
    githubNumber: 456,
    title: "Test PR",
    state: "open",
    authorCollaboratorId: null,
    githubCreatedAt: new Date("2024-01-15"),
    githubMergedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Issue・PRを正常に同期できる", async () => {
    const issues = [createMockIssue({ id: 1 }), createMockIssue({ id: 2 })];
    const prs = [createMockPullRequest({ id: 1 })];

    (mockSyncIssuesExecute as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedCount: 2,
      issues,
    });

    (mockSyncPRsExecute as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedCount: 1,
      pullRequests: prs,
    });

    const request = new NextRequest("http://localhost/api/repositories/1/sync", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.issuesSynced).toBe(2);
    expect(data.prsSynced).toBe(1);
  });

  it("無効なリポジトリIDの場合400エラーを返す", async () => {
    const request = new NextRequest("http://localhost/api/repositories/invalid/sync", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "invalid" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("無効なリポジトリIDです");
  });

  it("Issue同期がエラーの場合でもPR同期は実行される", async () => {
    (mockSyncIssuesExecute as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "GitHubからのIssue取得に失敗しました",
    });

    (mockSyncPRsExecute as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedCount: 1,
      pullRequests: [createMockPullRequest()],
    });

    const request = new NextRequest("http://localhost/api/repositories/1/sync", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.issuesSynced).toBe(0);
    expect(data.issuesError).toBe("GitHubからのIssue取得に失敗しました");
    expect(data.prsSynced).toBe(1);
  });

  it("内部エラーの場合500エラーを返す", async () => {
    (mockSyncIssuesExecute as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Unexpected error")
    );

    const request = new NextRequest("http://localhost/api/repositories/1/sync", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("同期に失敗しました");
  });
});
