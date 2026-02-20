/**
 * PullRequest同期ユースケース
 *
 * GitHubからPRを取得し、DBに同期する。
 * - 差分同期（since指定）対応
 * - コラボレーターとの紐付け
 */

import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { PullRequestRepository } from "@/infrastructure/repositories/pull-request-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { type IGitHubClient, getGitHubClient } from "@/infrastructure/external/github";
import type { PullRequest, NewPullRequest, Collaborator } from "@/infrastructure/database/schema";

export interface SyncPullRequestsInput {
  repositoryId: number;
  /** この日時以降に更新されたPRのみ同期 */
  since?: Date;
}

export interface SyncPullRequestsOutput {
  success: boolean;
  syncedCount?: number;
  pullRequests?: PullRequest[];
  error?: string;
}

export class SyncPullRequestsUseCase {
  private repositoryRepository: RepositoryRepository;
  private pullRequestRepository: PullRequestRepository;
  private collaboratorRepository: CollaboratorRepository;
  private gitHubClient: IGitHubClient;

  constructor(
    repositoryRepository?: RepositoryRepository,
    pullRequestRepository?: PullRequestRepository,
    collaboratorRepository?: CollaboratorRepository,
    gitHubClient?: IGitHubClient
  ) {
    this.repositoryRepository = repositoryRepository ?? new RepositoryRepository();
    this.pullRequestRepository = pullRequestRepository ?? new PullRequestRepository();
    this.collaboratorRepository = collaboratorRepository ?? new CollaboratorRepository();
    this.gitHubClient = gitHubClient ?? getGitHubClient();
  }

  async execute(input: SyncPullRequestsInput): Promise<SyncPullRequestsOutput> {
    // リポジトリの存在確認
    const repository = await this.repositoryRepository.findById(input.repositoryId);
    if (!repository) {
      return { success: false, error: "リポジトリが見つかりません" };
    }

    // GitHubからPR取得（抽象レイヤー経由）
    let githubPRs;
    try {
      githubPRs = await this.gitHubClient.getPullRequests(
        repository.ownerName,
        repository.repoName,
        input.since
      );
    } catch {
      return { success: false, error: "GitHubからのPR取得に失敗しました" };
    }

    if (githubPRs.length === 0) {
      return { success: true, syncedCount: 0, pullRequests: [] };
    }

    // コラボレーター一覧を取得（紐付け用）
    const collaborators = await this.collaboratorRepository.findByRepositoryId(
      input.repositoryId
    );
    const collaboratorMap = new Map<string, Collaborator>();
    for (const collab of collaborators) {
      collaboratorMap.set(collab.githubUserName, collab);
    }

    // GitHub PRをDB形式に変換
    const prsToUpsert: NewPullRequest[] = githubPRs.map((githubPR) => {
      const authorLogin = githubPR.user?.login;
      const authorCollaborator = authorLogin
        ? collaboratorMap.get(authorLogin)
        : undefined;

      return {
        repositoryId: input.repositoryId,
        githubNumber: githubPR.number,
        title: githubPR.title,
        state: githubPR.state,
        authorCollaboratorId: authorCollaborator?.id ?? null,
        githubCreatedAt: new Date(githubPR.createdAt),
        githubMergedAt: githubPR.mergedAt
          ? new Date(githubPR.mergedAt)
          : null,
      };
    });

    // DBにupsert
    const savedPRs = await this.pullRequestRepository.upsertMany(prsToUpsert);

    return {
      success: true,
      syncedCount: savedPRs.length,
      pullRequests: savedPRs,
    };
  }
}
