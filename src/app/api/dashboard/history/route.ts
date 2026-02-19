import { NextRequest, NextResponse } from "next/server";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { EvaluationRepository } from "@/infrastructure/repositories/evaluation-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { TrackedCollaboratorRepository } from "@/infrastructure/repositories/tracked-collaborator-repository";
import { SprintCalculator, type SprintConfig } from "@/domain/sprint";
import { SprintNumber } from "@/domain/sprint/value-objects/SprintNumber";

export const dynamic = "force-dynamic";

const repositoryRepo = new RepositoryRepository();
const issueRepo = new IssueRepository();
const evaluationRepo = new EvaluationRepository();
const collaboratorRepo = new CollaboratorRepository();
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

// 日付フォーマット
const formatDate = (d: Date) =>
  `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;

// リードタイム評価のグレードを計算（A-E、日数ベース）
function calculateLeadTimeGrade(hours: number): { grade: string; score: number } {
  const days = hours / 24;
  if (days <= 2) return { grade: "A", score: 100 };
  if (days <= 3) return { grade: "B", score: 80 };
  if (days <= 4) return { grade: "C", score: 60 };
  if (days <= 5) return { grade: "D", score: 40 };
  return { grade: "E", score: 20 };
}

// スプリント統計の型
interface SprintStats {
  sprintNumber: number;
  period: string;
  startDate: string;
  endDate: string;
  team: {
    totalIssues: number;
    closedIssues: number;
    averageScore: number | null;
    averageHours: number | null;
    gradeDistribution: { A: number; B: number; C: number; D: number; E: number };
    evaluatedIssues: number;
    averageQualityScore: number | null;
    qualityGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
    consistencyEvaluatedIssues: number;
    averageConsistencyScore: number | null;
    consistencyGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
  };
  users: {
    username: string;
    totalIssues: number;
    closedIssues: number;
    averageScore: number | null;
    averageHours: number | null;
    gradeDistribution: { A: number; B: number; C: number; D: number; E: number };
    averageQualityScore: number | null;
    qualityGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
    averageConsistencyScore: number | null;
    consistencyGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
  }[];
}

interface IssueWithEvaluation {
  sprintNumber: number;
  creator: string;
  state: string;
  score: number | null;
  completionHours: number | null;
  grade: string | null;
  qualityScore: number | null;
  qualityGrade: string | null;
  consistencyScore: number | null;
  consistencyGrade: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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
    const currentSprint = sprintCalculator.getCurrentSprint(now);
    const currentSprintNumber = currentSprint.number.value;

    // 追跡対象ユーザーを取得
    const trackedUserNames = await trackedCollaboratorRepo.findTrackedUserNamesByRepositoryId(repoId);

    // 全Issueを取得
    const allIssues = await issueRepo.findByRepositoryId(repoId);

    // スプリント番号が設定されていて、1以上のIssueをフィルタ
    const targetIssues = allIssues.filter(
      (issue) =>
        issue.sprintNumber !== null &&
        issue.sprintNumber >= 1
    );

    // 各Issueの評価データと作成者情報を取得
    const issuesWithEvaluations: IssueWithEvaluation[] = [];

    for (const issue of targetIssues) {
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
        sprintNumber: issue.sprintNumber!,
        creator: creatorName,
        state: issue.state,
        score,
        completionHours,
        grade,
        qualityScore: evaluation?.qualityScore || null,
        qualityGrade: evaluation?.qualityGrade || null,
        consistencyScore: evaluation?.consistencyScore || null,
        consistencyGrade: evaluation?.consistencyGrade || null,
      });
    }

    // スプリント番号でグループ化
    const issuesBySprintMap = new Map<number, IssueWithEvaluation[]>();
    for (const issue of issuesWithEvaluations) {
      if (!issuesBySprintMap.has(issue.sprintNumber)) {
        issuesBySprintMap.set(issue.sprintNumber, []);
      }
      issuesBySprintMap.get(issue.sprintNumber)!.push(issue);
    }

    // フィルタ前の全Issue（sprint_number >= 1）からスプリント範囲を決定
    const allSprintNumbers = targetIssues.map(issue => issue.sprintNumber!);
    const MIN_SPRINT_COUNT = 8;

    let minSprintInData: number;
    let maxSprintInData: number;

    if (allSprintNumbers.length > 0) {
      minSprintInData = Math.max(1, Math.min(...allSprintNumbers));
      maxSprintInData = Math.max(...allSprintNumbers, currentSprintNumber);
    } else {
      // データがない場合でも最低8スプリント分を表示
      minSprintInData = Math.max(1, currentSprintNumber - MIN_SPRINT_COUNT + 1);
      maxSprintInData = currentSprintNumber;
    }

    // 最低8スプリント分を確保
    const sprintRange = maxSprintInData - minSprintInData + 1;
    if (sprintRange < MIN_SPRINT_COUNT) {
      // 現在のスプリントから8個分を確保（ただし最小は1）
      minSprintInData = Math.max(1, maxSprintInData - MIN_SPRINT_COUNT + 1);
    }

    // スプリントごとの統計を計算
    const sprintStats: SprintStats[] = [];

    // DBに存在するスプリント範囲でループ
    for (let sprintNum = minSprintInData; sprintNum <= maxSprintInData; sprintNum++) {
      const sprintNumber = sprintNum;
      const sprintNumberVO = SprintNumber.createAllowingZeroOrNegative(sprintNum);
      const period = sprintCalculator.calculateSprintPeriod(sprintNumberVO);
      const sprintStart = period.startDate;
      const sprintEnd = period.endDate;

      const sprintIssues = issuesBySprintMap.get(sprintNumber) || [];

      // チーム全体の統計
      const closedIssues = sprintIssues.filter((i) => i.state === "closed" && i.score !== null);
      const evaluatedIssues = sprintIssues.filter((i) => i.qualityScore !== null);
      const consistencyEvaluatedIssues = sprintIssues.filter((i) => i.consistencyScore !== null);

      const teamStats = {
        totalIssues: sprintIssues.length,
        closedIssues: closedIssues.length,
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
        evaluatedIssues: evaluatedIssues.length,
        averageQualityScore: evaluatedIssues.length > 0
          ? Math.round((evaluatedIssues.reduce((sum, i) => sum + (i.qualityScore || 0), 0) / evaluatedIssues.length) * 10) / 10
          : null,
        qualityGradeDistribution: {
          A: evaluatedIssues.filter((i) => i.qualityGrade === "A").length,
          B: evaluatedIssues.filter((i) => i.qualityGrade === "B").length,
          C: evaluatedIssues.filter((i) => i.qualityGrade === "C").length,
          D: evaluatedIssues.filter((i) => i.qualityGrade === "D").length,
          E: evaluatedIssues.filter((i) => i.qualityGrade === "E").length,
        },
        consistencyEvaluatedIssues: consistencyEvaluatedIssues.length,
        averageConsistencyScore: consistencyEvaluatedIssues.length > 0
          ? Math.round((consistencyEvaluatedIssues.reduce((sum, i) => sum + (i.consistencyScore || 0), 0) / consistencyEvaluatedIssues.length) * 10) / 10
          : null,
        consistencyGradeDistribution: {
          A: consistencyEvaluatedIssues.filter((i) => i.consistencyGrade === "A").length,
          B: consistencyEvaluatedIssues.filter((i) => i.consistencyGrade === "B").length,
          C: consistencyEvaluatedIssues.filter((i) => i.consistencyGrade === "C").length,
          D: consistencyEvaluatedIssues.filter((i) => i.consistencyGrade === "D").length,
          E: consistencyEvaluatedIssues.filter((i) => i.consistencyGrade === "E").length,
        },
      };

      // ユーザー別の統計
      const userStatsMap = new Map<string, {
        username: string;
        totalIssues: number;
        closedIssues: number;
        scores: number[];
        hours: number[];
        gradeDistribution: { A: number; B: number; C: number; D: number; E: number };
        qualityScores: number[];
        qualityGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
        consistencyScores: number[];
        consistencyGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
      }>();

      // trackedUsersの順序で初期化
      for (const username of trackedUserNames) {
        userStatsMap.set(username, {
          username,
          totalIssues: 0,
          closedIssues: 0,
          scores: [],
          hours: [],
          gradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
          qualityScores: [],
          qualityGradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
          consistencyScores: [],
          consistencyGradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
        });
      }

      for (const issue of sprintIssues) {
        const stats = userStatsMap.get(issue.creator);
        if (!stats) continue;

        stats.totalIssues++;
        if (issue.state === "closed") {
          stats.closedIssues++;
          if (issue.score !== null) {
            stats.scores.push(issue.score);
          }
          if (issue.completionHours !== null) {
            stats.hours.push(issue.completionHours);
          }
          if (issue.grade) {
            const gradeKey = issue.grade as "A" | "B" | "C" | "D" | "E";
            if (gradeKey in stats.gradeDistribution) {
              stats.gradeDistribution[gradeKey]++;
            }
          }
        }

        if (issue.qualityScore !== null) {
          stats.qualityScores.push(issue.qualityScore);
          if (issue.qualityGrade) {
            const qGrade = issue.qualityGrade as "A" | "B" | "C" | "D" | "E";
            if (qGrade in stats.qualityGradeDistribution) {
              stats.qualityGradeDistribution[qGrade]++;
            }
          }
        }

        if (issue.consistencyScore !== null) {
          stats.consistencyScores.push(issue.consistencyScore);
          if (issue.consistencyGrade) {
            const cGrade = issue.consistencyGrade as "A" | "B" | "C" | "D" | "E";
            if (cGrade in stats.consistencyGradeDistribution) {
              stats.consistencyGradeDistribution[cGrade]++;
            }
          }
        }
      }

      const userStats = Array.from(userStatsMap.values()).map((stats) => ({
        username: stats.username,
        totalIssues: stats.totalIssues,
        closedIssues: stats.closedIssues,
        averageScore: stats.scores.length > 0
          ? Math.round((stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) * 10) / 10
          : null,
        averageHours: stats.hours.length > 0
          ? Math.round((stats.hours.reduce((a, b) => a + b, 0) / stats.hours.length) * 10) / 10
          : null,
        gradeDistribution: stats.gradeDistribution,
        averageQualityScore: stats.qualityScores.length > 0
          ? Math.round((stats.qualityScores.reduce((a, b) => a + b, 0) / stats.qualityScores.length) * 10) / 10
          : null,
        qualityGradeDistribution: stats.qualityGradeDistribution,
        averageConsistencyScore: stats.consistencyScores.length > 0
          ? Math.round((stats.consistencyScores.reduce((a, b) => a + b, 0) / stats.consistencyScores.length) * 10) / 10
          : null,
        consistencyGradeDistribution: stats.consistencyGradeDistribution,
      }));

      sprintStats.push({
        sprintNumber,
        period: `${formatDate(sprintStart)} - ${formatDate(sprintEnd)}`,
        startDate: sprintStart.toISOString(),
        endDate: sprintEnd.toISOString(),
        team: teamStats,
        users: userStats,
      });
    }

    // 古い順にソート（スプリント番号の昇順 = 左から右へ時系列順）
    sprintStats.sort((a, b) => a.sprintNumber - b.sprintNumber);

    return NextResponse.json({
      repository: `${owner}/${repo}`,
      trackedUsers: trackedUserNames,
      sprintCount: sprintStats.length,
      sprints: sprintStats,
    });
  } catch (error) {
    console.error("History API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history data" },
      { status: 500 }
    );
  }
}
