/**
 * GetSprintDashboardUseCase
 *
 * 指定されたスプリントのダッシュボードデータを取得するユースケース。
 * スプリント計算、Issue取得、ユーザー統計集計を行う。
 */

import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { SprintCalculator, SprintConfig } from "@/domain/sprint";
import type { Issue, Collaborator } from "@/infrastructure/database/schema";

export interface GetSprintDashboardInput {
  repositoryId: number;
  /** スプリントオフセット（0=現在, -1=前, 1=次） */
  offset?: number;
}

export interface UserStats {
  collaboratorId: number;
  username: string;
  totalIssues: number;
  closedIssues: number;
  openIssues: number;
  issues: Issue[];
}

export interface SprintDashboardData {
  sprint: {
    number: number;
    startDate: string;
    endDate: string;
    period: string;
    startDayName: string;
    durationWeeks: number;
    isCurrent: boolean;
    offset: number;
  };
  repository: {
    id: number;
    owner: string;
    repo: string;
  };
  overallStats: {
    totalIssues: number;
    closedIssues: number;
    openIssues: number;
  };
  users: UserStats[];
}

export interface GetSprintDashboardOutput {
  success: boolean;
  data?: SprintDashboardData;
  error?: string;
}

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export class GetSprintDashboardUseCase {
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

  async execute(input: GetSprintDashboardInput): Promise<GetSprintDashboardOutput> {
    try {
      const { repositoryId, offset = 0 } = input;

      // リポジトリの存在確認
      const repository = await this.repositoryRepository.findById(repositoryId);
      if (!repository) {
        return { success: false, error: "リポジトリが見つかりません" };
      }

      // スプリント設定からSprintCalculatorを作成
      const sprintConfig: SprintConfig = {
        startDayOfWeek: repository.sprintStartDayOfWeek ?? 6,
        durationWeeks: repository.sprintDurationWeeks ?? 1,
        baseDate: repository.trackingStartDate
          ? new Date(repository.trackingStartDate)
          : new Date(),
      };
      const sprintCalculator = new SprintCalculator(sprintConfig);

      // スプリント情報を計算
      const sprint = sprintCalculator.getSprintWithOffset(new Date(), offset);

      // スプリントのIssueを取得
      const issues = await this.issueRepository.findBySprintNumber(
        repositoryId,
        sprint.number.value
      );

      // コラボレーター一覧を取得
      const collaborators = await this.collaboratorRepository.findByRepositoryId(
        repositoryId
      );
      const collaboratorMap = new Map<number, Collaborator>();
      for (const collab of collaborators) {
        collaboratorMap.set(collab.id, collab);
      }

      // ユーザー別に集計
      const userStatsMap = new Map<number, UserStats>();

      // コラボレーターで初期化
      for (const collab of collaborators) {
        userStatsMap.set(collab.id, {
          collaboratorId: collab.id,
          username: collab.githubUserName,
          totalIssues: 0,
          closedIssues: 0,
          openIssues: 0,
          issues: [],
        });
      }

      // Issueを集計
      for (const issue of issues) {
        const authorId = issue.authorCollaboratorId;
        if (authorId && userStatsMap.has(authorId)) {
          const stats = userStatsMap.get(authorId)!;
          stats.totalIssues++;
          stats.issues.push(issue);

          if (issue.state === "closed") {
            stats.closedIssues++;
          } else {
            stats.openIssues++;
          }
        }
      }

      // 全体統計
      const closedIssues = issues.filter((i) => i.state === "closed");
      const overallStats = {
        totalIssues: issues.length,
        closedIssues: closedIssues.length,
        openIssues: issues.length - closedIssues.length,
      };

      return {
        success: true,
        data: {
          sprint: {
            number: sprint.number.value,
            startDate: sprint.period.startDate.toISOString(),
            endDate: sprint.period.endDate.toISOString(),
            period: sprint.period.format(),
            startDayName: DAY_NAMES[sprintConfig.startDayOfWeek],
            durationWeeks: sprintConfig.durationWeeks,
            isCurrent: sprint.isCurrent,
            offset,
          },
          repository: {
            id: repository.id,
            owner: repository.ownerName,
            repo: repository.repoName,
          },
          overallStats,
          users: Array.from(userStatsMap.values()),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "ダッシュボードデータの取得に失敗しました",
      };
    }
  }
}
