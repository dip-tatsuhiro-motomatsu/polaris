import { NextRequest, NextResponse } from "next/server";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { EvaluationRepository } from "@/infrastructure/repositories/evaluation-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { SyncMetadataRepository } from "@/infrastructure/repositories/sync-metadata-repository";
import { TrackedCollaboratorRepository } from "@/infrastructure/repositories/tracked-collaborator-repository";
import { SprintCalculator, type SprintConfig } from "@/domain/sprint";

export const dynamic = "force-dynamic";

const repositoryRepo = new RepositoryRepository();
const issueRepo = new IssueRepository();
const evaluationRepo = new EvaluationRepository();
const collaboratorRepo = new CollaboratorRepository();
const syncMetadataRepo = new SyncMetadataRepository();
const trackedCollaboratorRepo = new TrackedCollaboratorRepository();

// SprintCalculatorのファクトリ関数
function createSprintCalculator(repository: {
  sprintStartDayOfWeek: number;
  sprintDurationWeeks: number;
  trackingStartDate: string | null;
}): SprintCalculator {
  const config: SprintConfig = {
    startDayOfWeek: repository.sprintStartDayOfWeek,
    durationWeeks: repository.sprintDurationWeeks,
    baseDate: repository.trackingStartDate
      ? new Date(repository.trackingStartDate)
      : new Date(),
  };
  return new SprintCalculator(config);
}

// 曜日名
const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

// ユーザー統計の型
interface UserStats {
  username: string;
  totalIssues: number;
  closedIssues: number;
  openIssues: number;
  averageScore: number | null;
  averageHours: number | null;
  gradeDistribution: { A: number; B: number; C: number; D: number; E: number };
  averageQualityScore: number | null;
  qualityGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
  averageConsistencyScore: number | null;
  consistencyGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
  issues: IssueWithEvaluation[];
}

interface IssueWithEvaluation {
  number: number;
  title: string;
  body: string | null;
  state: string;
  createdAt: Date;
  closedAt: Date | null;
  creator: string;
  assignee: string | null;
  sprintNumber: number | null;
  // リードタイム評価
  score: number | null;
  completionHours: number | null;
  grade: string | null;
  // 品質評価
  qualityEvaluation: {
    totalScore: number;
    grade: string;
    categories: unknown[];
    overallFeedback: string;
    improvementSuggestions: string[];
  } | null;
  // 整合性評価
  consistencyEvaluation: {
    totalScore: number;
    grade: string;
    linkedPRs: unknown[];
    categories: unknown[];
    overallFeedback: string;
    issueImprovementSuggestions: string[];
  } | null;
}

// 同期をトリガー（内部呼び出し）
async function triggerSync(baseUrl: string, repoId: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId }),
    });
    return response.ok;
  } catch (error) {
    console.error("Sync trigger failed:", error);
    return false;
  }
}

// リードタイム評価のグレードを計算（A-E、日数ベース）
function calculateLeadTimeGrade(hours: number): { grade: string; score: number } {
  const days = hours / 24;
  if (days <= 2) return { grade: "A", score: 100 };
  if (days <= 3) return { grade: "B", score: 80 };
  if (days <= 4) return { grade: "C", score: 60 };
  if (days <= 5) return { grade: "D", score: 40 };
  return { grade: "E", score: 20 };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sprintOffset = parseInt(searchParams.get("offset") || "0", 10);
    const skipSync = searchParams.get("skipSync") === "true";
    const repoIdParam = searchParams.get("repoId");

    // リポジトリを取得
    let repository;
    if (repoIdParam) {
      const repoId = parseInt(repoIdParam, 10);
      if (isNaN(repoId)) {
        return NextResponse.json(
          { error: "無効なリポジトリIDです" },
          { status: 400 }
        );
      }
      repository = await repositoryRepo.findById(repoId);
      if (!repository) {
        return NextResponse.json(
          { error: "指定されたリポジトリが見つかりません。" },
          { status: 404 }
        );
      }
    } else {
      const allRepos = await repositoryRepo.findAll();
      if (allRepos.length === 0) {
        return NextResponse.json(
          { error: "設定が見つかりません。設定画面でリポジトリを登録してください。" },
          { status: 404 }
        );
      }
      repository = allRepos[0];
    }

    const { id: repoId, ownerName: owner, repoName: repo } = repository;

    // SprintCalculatorを使用してスプリント情報を計算
    const sprintCalculator = createSprintCalculator({
      sprintStartDayOfWeek: repository.sprintStartDayOfWeek ?? 6,
      sprintDurationWeeks: repository.sprintDurationWeeks,
      trackingStartDate: repository.trackingStartDate,
    });
    const now = new Date();

    // オフセットを適用したスプリントを取得
    const targetSprint = sprintCalculator.getSprintWithOffset(now, sprintOffset);
    const targetSprintStart = targetSprint.period.startDate;
    const targetSprintEnd = targetSprint.period.endDate;
    const targetSprintNumber = targetSprint.number.value;

    const isCurrent = sprintOffset === 0;

    // 同期メタデータを取得
    const syncMeta = await syncMetadataRepo.findByRepositoryId(repoId);
    const lastSyncAt: string | null = syncMeta?.lastSyncAt?.toISOString() || null;

    // 同期状態チェック（現在のスプリントのみ）
    if (!skipSync && isCurrent && !syncMeta) {
      const baseUrl = new URL(request.url).origin;
      await triggerSync(baseUrl, repoId);
    }

    // 追跡対象ユーザーを取得
    const trackedUserNames = await trackedCollaboratorRepo.findTrackedUserNamesByRepositoryId(repoId);

    // Issueを取得（スプリント番号でフィルタ）
    const allIssues = await issueRepo.findBySprintNumber(repoId, targetSprintNumber);

    // 各Issueの評価データと作成者情報を取得
    const issuesWithEvaluations: IssueWithEvaluation[] = [];

    for (const issue of allIssues) {
      // 作成者の名前を取得
      let creatorName = "unknown";
      if (issue.authorCollaboratorId) {
        const author = await collaboratorRepo.findById(issue.authorCollaboratorId);
        if (author) creatorName = author.githubUserName;
      }

      // trackedUsersフィルタ
      if (trackedUserNames.length > 0 && !trackedUserNames.includes(creatorName)) {
        continue;
      }

      // assigneeの名前を取得
      let assigneeName: string | null = null;
      if (issue.assigneeCollaboratorId) {
        const assignee = await collaboratorRepo.findById(issue.assigneeCollaboratorId);
        if (assignee) assigneeName = assignee.githubUserName;
      }

      // 評価データを取得
      const evaluation = await evaluationRepo.findByIssueId(issue.id);

      // リードタイム評価を計算
      let score: number | null = null;
      let completionHours: number | null = null;
      let grade: string | null = null;

      if (issue.state === "closed" && issue.githubClosedAt && issue.githubCreatedAt) {
        const diffMs = issue.githubClosedAt.getTime() - issue.githubCreatedAt.getTime();
        completionHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        const leadTimeEval = calculateLeadTimeGrade(completionHours);
        score = leadTimeEval.score;
        grade = leadTimeEval.grade;
      }

      issuesWithEvaluations.push({
        number: issue.githubNumber,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        createdAt: issue.githubCreatedAt,
        closedAt: issue.githubClosedAt,
        creator: creatorName,
        assignee: assigneeName,
        sprintNumber: issue.sprintNumber,
        score,
        completionHours,
        grade,
        qualityEvaluation: evaluation?.qualityScore != null
          ? {
              totalScore: evaluation.qualityScore,
              grade: evaluation.qualityGrade || "E",
              categories: (evaluation.qualityDetails as { categories?: unknown[] })?.categories || [],
              overallFeedback: (evaluation.qualityDetails as { overallFeedback?: string })?.overallFeedback || "",
              improvementSuggestions: (evaluation.qualityDetails as { improvementSuggestions?: string[] })?.improvementSuggestions || [],
            }
          : null,
        consistencyEvaluation: evaluation?.consistencyScore != null
          ? {
              totalScore: evaluation.consistencyScore,
              grade: evaluation.consistencyGrade || "E",
              linkedPRs: (evaluation.consistencyDetails as { linkedPRs?: unknown[] })?.linkedPRs || [],
              categories: (evaluation.consistencyDetails as { categories?: unknown[] })?.categories || [],
              overallFeedback: (evaluation.consistencyDetails as { overallFeedback?: string })?.overallFeedback || "",
              issueImprovementSuggestions: (evaluation.consistencyDetails as { issueImprovementSuggestions?: string[] })?.issueImprovementSuggestions || [],
            }
          : null,
      });
    }

    // ユーザー別に集計
    const userStatsMap = new Map<string, UserStats>();

    // trackedUsersの順序で初期化
    if (trackedUserNames.length > 0) {
      for (const username of trackedUserNames) {
        userStatsMap.set(username, {
          username,
          totalIssues: 0,
          closedIssues: 0,
          openIssues: 0,
          averageScore: null,
          averageHours: null,
          gradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
          averageQualityScore: null,
          qualityGradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
          averageConsistencyScore: null,
          consistencyGradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
          issues: [],
        });
      }
    }

    for (const issue of issuesWithEvaluations) {
      const username = issue.creator;

      if (!userStatsMap.has(username)) {
        userStatsMap.set(username, {
          username,
          totalIssues: 0,
          closedIssues: 0,
          openIssues: 0,
          averageScore: null,
          averageHours: null,
          gradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
          averageQualityScore: null,
          qualityGradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
          averageConsistencyScore: null,
          consistencyGradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
          issues: [],
        });
      }

      const stats = userStatsMap.get(username)!;
      stats.totalIssues++;
      stats.issues.push(issue);

      if (issue.state === "closed") {
        stats.closedIssues++;
        if (issue.grade) {
          const gradeKey = issue.grade as "A" | "B" | "C" | "D" | "E";
          if (gradeKey in stats.gradeDistribution) {
            stats.gradeDistribution[gradeKey]++;
          }
        }
      } else {
        stats.openIssues++;
      }

      if (issue.qualityEvaluation) {
        const qGrade = issue.qualityEvaluation.grade as "A" | "B" | "C" | "D" | "E";
        if (qGrade in stats.qualityGradeDistribution) {
          stats.qualityGradeDistribution[qGrade]++;
        }
      }

      if (issue.consistencyEvaluation) {
        const cGrade = issue.consistencyEvaluation.grade as "A" | "B" | "C" | "D" | "E";
        if (cGrade in stats.consistencyGradeDistribution) {
          stats.consistencyGradeDistribution[cGrade]++;
        }
      }
    }

    // 平均スコア・時間を計算
    for (const stats of Array.from(userStatsMap.values())) {
      const closedIssues = stats.issues.filter((i) => i.state === "closed" && i.score !== null);
      if (closedIssues.length > 0) {
        const totalScore = closedIssues.reduce((sum, i) => sum + (i.score || 0), 0);
        const totalHours = closedIssues.reduce((sum, i) => sum + (i.completionHours || 0), 0);
        stats.averageScore = Math.round((totalScore / closedIssues.length) * 10) / 10;
        stats.averageHours = Math.round((totalHours / closedIssues.length) * 10) / 10;
      }

      const qualityEvaluatedIssues = stats.issues.filter((i) => i.qualityEvaluation !== null);
      if (qualityEvaluatedIssues.length > 0) {
        const totalQualityScore = qualityEvaluatedIssues.reduce(
          (sum, i) => sum + (i.qualityEvaluation?.totalScore || 0),
          0
        );
        stats.averageQualityScore = Math.round((totalQualityScore / qualityEvaluatedIssues.length) * 10) / 10;
      }

      const consistencyEvaluatedIssues = stats.issues.filter((i) => i.consistencyEvaluation !== null);
      if (consistencyEvaluatedIssues.length > 0) {
        const totalConsistencyScore = consistencyEvaluatedIssues.reduce(
          (sum, i) => sum + (i.consistencyEvaluation?.totalScore || 0),
          0
        );
        stats.averageConsistencyScore = Math.round((totalConsistencyScore / consistencyEvaluatedIssues.length) * 10) / 10;
      }
    }

    // 全体統計
    const closedIssues = issuesWithEvaluations.filter((i) => i.state === "closed" && i.score !== null);
    const qualityEvaluatedIssues = issuesWithEvaluations.filter((i) => i.qualityEvaluation !== null);
    const consistencyEvaluatedIssues = issuesWithEvaluations.filter((i) => i.consistencyEvaluation !== null);

    const overallStats = {
      totalIssues: issuesWithEvaluations.length,
      closedIssues: closedIssues.length,
      openIssues: issuesWithEvaluations.length - closedIssues.length,
      averageScore: closedIssues.length > 0
        ? Math.round((closedIssues.reduce((sum, i) => sum + (i.score || 0), 0) / closedIssues.length) * 10) / 10
        : null,
      averageHours: closedIssues.length > 0
        ? Math.round((closedIssues.reduce((sum, i) => sum + (i.completionHours || 0), 0) / closedIssues.length) * 10) / 10
        : null,
      gradeDistribution: {
        A: closedIssues.filter((i) => i.grade === "A").length,
        B: closedIssues.filter((i) => i.grade === "B").length,
        C: closedIssues.filter((i) => i.grade === "C").length,
        D: closedIssues.filter((i) => i.grade === "D").length,
        E: closedIssues.filter((i) => i.grade === "E").length,
      },
      qualityEvaluatedIssues: qualityEvaluatedIssues.length,
      averageQualityScore: qualityEvaluatedIssues.length > 0
        ? Math.round((qualityEvaluatedIssues.reduce((sum, i) => sum + (i.qualityEvaluation?.totalScore || 0), 0) / qualityEvaluatedIssues.length) * 10) / 10
        : null,
      qualityGradeDistribution: {
        A: qualityEvaluatedIssues.filter((i) => i.qualityEvaluation?.grade === "A").length,
        B: qualityEvaluatedIssues.filter((i) => i.qualityEvaluation?.grade === "B").length,
        C: qualityEvaluatedIssues.filter((i) => i.qualityEvaluation?.grade === "C").length,
        D: qualityEvaluatedIssues.filter((i) => i.qualityEvaluation?.grade === "D").length,
        E: qualityEvaluatedIssues.filter((i) => i.qualityEvaluation?.grade === "E").length,
      },
      consistencyEvaluatedIssues: consistencyEvaluatedIssues.length,
      averageConsistencyScore: consistencyEvaluatedIssues.length > 0
        ? Math.round((consistencyEvaluatedIssues.reduce((sum, i) => sum + (i.consistencyEvaluation?.totalScore || 0), 0) / consistencyEvaluatedIssues.length) * 10) / 10
        : null,
      consistencyGradeDistribution: {
        A: consistencyEvaluatedIssues.filter((i) => i.consistencyEvaluation?.grade === "A").length,
        B: consistencyEvaluatedIssues.filter((i) => i.consistencyEvaluation?.grade === "B").length,
        C: consistencyEvaluatedIssues.filter((i) => i.consistencyEvaluation?.grade === "C").length,
        D: consistencyEvaluatedIssues.filter((i) => i.consistencyEvaluation?.grade === "D").length,
        E: consistencyEvaluatedIssues.filter((i) => i.consistencyEvaluation?.grade === "E").length,
      },
    };

    // スプリント期間のフォーマット
    const period = targetSprint.period.format();

    return NextResponse.json({
      sprint: {
        number: targetSprintNumber,
        startDate: targetSprintStart.toISOString(),
        endDate: targetSprintEnd.toISOString(),
        period,
        startDayName: DAY_NAMES[repository.sprintStartDayOfWeek ?? 6],
        durationWeeks: repository.sprintDurationWeeks,
        isCurrent,
        offset: sprintOffset,
      },
      repository: `${owner}/${repo}`,
      trackedUsersCount: trackedUserNames.length,
      overallStats,
      users: Array.from(userStatsMap.values()),
      lastSyncAt,
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
