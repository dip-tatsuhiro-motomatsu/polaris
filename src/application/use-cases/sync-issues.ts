/**
 * Issue同期ユースケース
 *
 * GitHubからIssueを取得し、DBに同期する。
 * - 差分同期（since指定）対応
 * - コラボレーターとの紐付け
 */

import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { getIssues } from "@/lib/github/client";
import type { Issue, NewIssue, Collaborator } from "@/infrastructure/database/schema";

export interface SyncIssuesInput {
  repositoryId: number;
  /** この日時以降に更新されたIssueのみ同期 */
  since?: Date;
}

export interface SyncIssuesOutput {
  success: boolean;
  syncedCount?: number;
  issues?: Issue[];
  error?: string;
}

export class SyncIssuesUseCase {
  private repositoryRepository: RepositoryRepository;
  private issueRepository: IssueRepository;
  private collaboratorRepository: CollaboratorRepository;

  constructor(
    repositoryRepository?: RepositoryRepository,
    issueRepository?: IssueRepository,
    collaboratorRepository?: CollaboratorRepository
  ) {
    this.repositoryRepository = repositoryRepository ?? new RepositoryRepository();
    this.issueRepository = issueRepository ?? new IssueRepository();
    this.collaboratorRepository = collaboratorRepository ?? new CollaboratorRepository();
  }

  async execute(input: SyncIssuesInput): Promise<SyncIssuesOutput> {
    // リポジトリの存在確認
    const repository = await this.repositoryRepository.findById(input.repositoryId);
    if (!repository) {
      return { success: false, error: "リポジトリが見つかりません" };
    }

    // GitHubからIssue取得
    let githubIssues;
    try {
      githubIssues = await getIssues(
        repository.ownerName,
        repository.repoName,
        input.since
      );
    } catch {
      return { success: false, error: "GitHubからのIssue取得に失敗しました" };
    }

    // PRを除外（GitHubのIssue APIはPRも含むため）
    const issuesOnly = githubIssues.filter((issue) => !issue.pull_request);

    if (issuesOnly.length === 0) {
      return { success: true, syncedCount: 0, issues: [] };
    }

    // コラボレーター一覧を取得（紐付け用）
    const collaborators = await this.collaboratorRepository.findByRepositoryId(
      input.repositoryId
    );
    const collaboratorMap = new Map<string, Collaborator>();
    for (const collab of collaborators) {
      collaboratorMap.set(collab.githubUserName, collab);
    }

    // GitHub IssueをDB形式に変換
    const issuesToUpsert: NewIssue[] = issuesOnly.map((githubIssue) => {
      const authorLogin = githubIssue.user?.login;
      const assigneeLogin = githubIssue.assignee?.login;

      const authorCollaborator = authorLogin
        ? collaboratorMap.get(authorLogin)
        : undefined;
      const assigneeCollaborator = assigneeLogin
        ? collaboratorMap.get(assigneeLogin)
        : undefined;

      return {
        repositoryId: input.repositoryId,
        githubNumber: githubIssue.number,
        title: githubIssue.title,
        body: githubIssue.body ?? null,
        state: githubIssue.state,
        authorCollaboratorId: authorCollaborator?.id ?? null,
        assigneeCollaboratorId: assigneeCollaborator?.id ?? null,
        githubCreatedAt: new Date(githubIssue.created_at),
        githubClosedAt: githubIssue.closed_at
          ? new Date(githubIssue.closed_at)
          : null,
      };
    });

    // DBにupsert
    const savedIssues = await this.issueRepository.upsertMany(issuesToUpsert);

    return {
      success: true,
      syncedCount: savedIssues.length,
      issues: savedIssues,
    };
  }
}
