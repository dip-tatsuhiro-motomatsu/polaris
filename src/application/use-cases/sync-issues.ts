/**
 * Issue同期ユースケース
 *
 * GitHubからIssueを取得し、DBに同期する。
 * - 差分同期（since指定）対応
 * - コラボレーターとの紐付け
 * - スプリント番号の計算（Issueの作成日ベース）
 */

import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { type IGitHubClient, getGitHubClient } from "@/infrastructure/external/github";
import { SprintCalculator, SprintConfig } from "@/domain/sprint";
import type { Issue, NewIssue, Collaborator } from "@/infrastructure/database/schema";

export interface SyncIssuesInput {
  repositoryId: number;
  /** この日時以降に更新されたIssueのみ同期 */
  since?: Date;
}

export interface SyncIssuesOutput {
  success: boolean;
  syncedCount?: number;
  currentSprintNumber?: number;
  issues?: Issue[];
  error?: string;
}

export class SyncIssuesUseCase {
  private repositoryRepository: RepositoryRepository;
  private issueRepository: IssueRepository;
  private collaboratorRepository: CollaboratorRepository;
  private gitHubClient: IGitHubClient;

  constructor(
    repositoryRepository?: RepositoryRepository,
    issueRepository?: IssueRepository,
    collaboratorRepository?: CollaboratorRepository,
    gitHubClient?: IGitHubClient
  ) {
    this.repositoryRepository = repositoryRepository ?? new RepositoryRepository();
    this.issueRepository = issueRepository ?? new IssueRepository();
    this.collaboratorRepository = collaboratorRepository ?? new CollaboratorRepository();
    this.gitHubClient = gitHubClient ?? getGitHubClient();
  }

  async execute(input: SyncIssuesInput): Promise<SyncIssuesOutput> {
    // リポジトリの存在確認
    const repository = await this.repositoryRepository.findById(input.repositoryId);
    if (!repository) {
      return { success: false, error: "リポジトリが見つかりません" };
    }

    // スプリント設定からSprintCalculatorを作成
    const sprintConfig: SprintConfig = {
      startDayOfWeek: repository.sprintStartDayOfWeek ?? 6, // デフォルト: 土曜日
      durationWeeks: repository.sprintDurationWeeks ?? 1,
      baseDate: repository.trackingStartDate
        ? new Date(repository.trackingStartDate)
        : new Date(),
    };
    const sprintCalculator = new SprintCalculator(sprintConfig);

    // 現在のスプリント番号を計算
    const currentSprintNumber = sprintCalculator.calculateSprintNumber(new Date()).value;

    // GitHubからIssue取得（抽象レイヤー経由）
    let githubIssues;
    try {
      githubIssues = await this.gitHubClient.getIssues(
        repository.ownerName,
        repository.repoName,
        input.since
      );
    } catch {
      return { success: false, error: "GitHubからのIssue取得に失敗しました" };
    }

    // PRを除外（GitHubのIssue APIはPRも含むため）
    const issuesOnly = githubIssues.filter((issue) => !issue.isPullRequest);

    if (issuesOnly.length === 0) {
      return { success: true, syncedCount: 0, currentSprintNumber, issues: [] };
    }

    // コラボレーター一覧を取得（紐付け用）
    const collaborators = await this.collaboratorRepository.findByRepositoryId(
      input.repositoryId
    );
    const collaboratorMap = new Map<string, Collaborator>();
    for (const collab of collaborators) {
      collaboratorMap.set(collab.githubUserName, collab);
    }

    // GitHub IssueをDB形式に変換（スプリント番号を計算）
    const issuesToUpsert: NewIssue[] = issuesOnly.map((githubIssue) => {
      const authorLogin = githubIssue.user?.login;
      const assigneeLogin = githubIssue.assignee?.login;

      const authorCollaborator = authorLogin
        ? collaboratorMap.get(authorLogin)
        : undefined;
      const assigneeCollaborator = assigneeLogin
        ? collaboratorMap.get(assigneeLogin)
        : undefined;

      // Issue作成日からスプリント番号を計算
      const issueCreatedAt = new Date(githubIssue.createdAt);
      const issueSprintNumber = sprintCalculator.calculateIssueSprintNumber(issueCreatedAt);

      return {
        repositoryId: input.repositoryId,
        githubNumber: githubIssue.number,
        title: githubIssue.title,
        body: githubIssue.body ?? null,
        state: githubIssue.state,
        authorCollaboratorId: authorCollaborator?.id ?? null,
        assigneeCollaboratorId: assigneeCollaborator?.id ?? null,
        sprintNumber: issueSprintNumber.value,
        githubCreatedAt: issueCreatedAt,
        githubClosedAt: githubIssue.closedAt
          ? new Date(githubIssue.closedAt)
          : null,
      };
    });

    // DBにupsert
    const savedIssues = await this.issueRepository.upsertMany(issuesToUpsert);

    return {
      success: true,
      syncedCount: savedIssues.length,
      currentSprintNumber,
      issues: savedIssues,
    };
  }
}
