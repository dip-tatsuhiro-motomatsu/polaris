import { NextRequest, NextResponse } from "next/server";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { PullRequestRepository } from "@/infrastructure/repositories/pull-request-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { SyncMetadataRepository } from "@/infrastructure/repositories/sync-metadata-repository";
import { syncRepository } from "@/lib/github/sync";
import type { NewIssue, NewPullRequest } from "@/infrastructure/database/schema";

export const dynamic = "force-dynamic";

const repositoryRepo = new RepositoryRepository();
const issueRepo = new IssueRepository();
const prRepo = new PullRequestRepository();
const collaboratorRepo = new CollaboratorRepository();
const syncMetadataRepo = new SyncMetadataRepository();

/**
 * POST /api/github/sync
 * GitHubからデータを同期（差分同期対応）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repositoryId, fullSync = false } = body;

    if (!repositoryId) {
      return NextResponse.json(
        { error: "repositoryIdは必須です", message: "repositoryId is required" },
        { status: 400 }
      );
    }

    const numericRepoId = parseInt(repositoryId, 10);
    if (isNaN(numericRepoId)) {
      return NextResponse.json(
        { error: "無効なリポジトリIDです", message: "Invalid repository ID" },
        { status: 400 }
      );
    }

    // リポジトリ取得
    const repository = await repositoryRepo.findById(numericRepoId);
    if (!repository) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    // 最終同期日時を取得
    const syncMeta = await syncMetadataRepo.findByRepositoryId(numericRepoId);
    const lastSyncedAt = syncMeta?.lastSyncAt || null;

    // GitHub同期を実行
    const { issues, pullRequests, result } = await syncRepository(
      repository.ownerName,
      repository.repoName,
      lastSyncedAt,
      fullSync
    );

    // コラボレーターのキャッシュ（同じユーザーを何度も検索しないため）
    const collaboratorCache = new Map<string, number>();

    const getOrCreateCollaboratorId = async (username: string | null): Promise<number | null> => {
      if (!username) return null;

      if (collaboratorCache.has(username)) {
        return collaboratorCache.get(username)!;
      }

      const collaborator = await collaboratorRepo.findOrCreate(numericRepoId, username);
      collaboratorCache.set(username, collaborator.id);
      return collaborator.id;
    };

    // Issues保存
    for (const issue of issues) {
      const assigneeId = await getOrCreateCollaboratorId(issue.assignee);

      const issueData: NewIssue = {
        repositoryId: numericRepoId,
        githubNumber: issue.number,
        title: issue.title,
        body: issue.body || null,
        state: issue.state,
        assigneeCollaboratorId: assigneeId,
        githubCreatedAt: issue.createdAt,
        githubClosedAt: issue.closedAt,
      };

      await issueRepo.upsert(issueData);
    }

    // Pull Requests保存
    for (const pr of pullRequests) {
      const authorId = await getOrCreateCollaboratorId(pr.author);

      // リンクされたIssueを検索
      let linkedIssueId: number | null = null;
      if (pr.linkedIssueNumbers && pr.linkedIssueNumbers.length > 0) {
        // 最初にリンクされたIssueを取得
        const linkedIssue = await issueRepo.findByGithubNumber(
          numericRepoId,
          pr.linkedIssueNumbers[0]
        );
        linkedIssueId = linkedIssue?.id || null;
      }

      const prData: NewPullRequest = {
        repositoryId: numericRepoId,
        githubNumber: pr.number,
        title: pr.title,
        state: pr.state,
        authorCollaboratorId: authorId,
        issueId: linkedIssueId,
        githubCreatedAt: pr.createdAt,
        githubMergedAt: pr.mergedAt,
      };

      await prRepo.upsert(prData);
    }

    // 同期メタデータを更新
    await syncMetadataRepo.upsert(numericRepoId, result.lastSyncedAt);

    return NextResponse.json({
      issuesSynced: result.issuesSynced,
      prsSynced: result.prsSynced,
      isFullSync: result.isFullSync,
      lastSyncedAt: result.lastSyncedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error syncing repository:", error);

    // GitHub APIレート制限チェック
    if (error instanceof Error && error.message.includes("rate limit")) {
      return NextResponse.json(
        {
          error: "GitHub APIレート制限に達しました",
          message: "GitHub API rate limit exceeded",
          retryAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to sync repository" },
      { status: 500 }
    );
  }
}
