import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { RepositoryConfig, StoredIssue } from "@/types/settings";

export const dynamic = "force-dynamic";

// スプリント開始日を計算
function getSprintStartDate(date: Date, startDayOfWeek: number): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = (dayOfWeek - startDayOfWeek + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// スプリント終了日を計算
function getSprintEndDate(startDate: Date, durationWeeks: number): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationWeeks * 7 - 1);
  endDate.setHours(23, 59, 59, 999);
  return endDate;
}

// スプリント番号を計算
function getSprintNumber(
  date: Date,
  baseSprint: Date,
  durationWeeks: number,
  startDayOfWeek: number
): number {
  const sprintStart = getSprintStartDate(date, startDayOfWeek);
  const diffDays = Math.floor(
    (sprintStart.getTime() - baseSprint.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.floor(diffDays / (durationWeeks * 7)) + 1;
}

// 曜日名
const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

// 日付フォーマット
const formatDate = (d: Date) =>
  `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;

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
    gradeDistribution: { S: number; A: number; B: number; C: number };
    // 品質評価
    evaluatedIssues: number;
    averageQualityScore: number | null;
    qualityGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
    // PR整合性評価
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
    gradeDistribution: { S: number; A: number; B: number; C: number };
    // 品質評価
    averageQualityScore: number | null;
    qualityGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
    // PR整合性評価
    averageConsistencyScore: number | null;
    consistencyGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sprintCount = parseInt(searchParams.get("count") || "12", 10);
    const repoId = searchParams.get("repoId");

    const db = getAdminFirestore();

    // 設定を取得
    let configDoc;
    if (repoId) {
      // 指定されたリポジトリを取得
      const doc = await db.collection("repositories").doc(repoId).get();
      if (!doc.exists) {
        return NextResponse.json(
          { error: "指定されたリポジトリが見つかりません。" },
          { status: 404 }
        );
      }
      configDoc = doc;
    } else {
      // 後方互換: 最初のアクティブなリポジトリを取得
      const snapshot = await db.collection("repositories").where("isActive", "==", true).limit(1).get();
      if (snapshot.empty) {
        return NextResponse.json(
          { error: "設定が見つかりません。設定画面でリポジトリを登録してください。" },
          { status: 404 }
        );
      }
      configDoc = snapshot.docs[0];
    }

    const repoDocId = configDoc.id;
    const configData = configDoc.data()!;
    const config: RepositoryConfig = {
      id: repoDocId,
      owner: configData.owner,
      repo: configData.repo,
      githubPat: configData.githubPat,
      sprint: {
        startDayOfWeek: configData.sprint?.startDayOfWeek ?? 6,
        durationWeeks: configData.sprint?.durationWeeks ?? 1,
        baseDate: configData.sprint?.baseDate || new Date().toISOString(),
      },
      trackedUsers: configData.trackedUsers || [],
      isActive: configData.isActive ?? true,
      createdAt: configData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: configData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };

    const { owner, repo, sprint, trackedUsers } = config;

    // 現在のスプリント情報を計算
    const now = new Date();
    const baseDate = new Date(sprint.baseDate);
    const baseSprint = getSprintStartDate(baseDate, sprint.startDayOfWeek);
    const currentSprintStart = getSprintStartDate(now, sprint.startDayOfWeek);
    const currentSprintNumber = getSprintNumber(now, baseSprint, sprint.durationWeeks, sprint.startDayOfWeek);

    // 対象スプリント番号の範囲
    const minSprintNumber = currentSprintNumber - sprintCount + 1;

    // Firestoreから全Issueを取得（対象スプリント範囲）
    const issuesRef = db.collection("repositories").doc(repoDocId).collection("issues");
    const issuesSnapshot = await issuesRef
      .where("sprintNumber", ">=", minSprintNumber)
      .where("sprintNumber", "<=", currentSprintNumber)
      .get();

    // スプリント番号でグループ化
    const issuesBySprintMap = new Map<number, StoredIssue[]>();
    issuesSnapshot.docs.forEach((doc) => {
      const data = doc.data() as StoredIssue;
      // trackedUsersフィルタ
      if (trackedUsers.length > 0 && !trackedUsers.includes(data.creator)) {
        return;
      }
      const sprintNum = data.sprintNumber;
      if (!issuesBySprintMap.has(sprintNum)) {
        issuesBySprintMap.set(sprintNum, []);
      }
      issuesBySprintMap.get(sprintNum)!.push(data);
    });

    // スプリントごとの統計を計算
    const sprintStats: SprintStats[] = [];

    for (let i = 0; i < sprintCount; i++) {
      const offset = -i;
      const sprintStart = new Date(currentSprintStart);
      sprintStart.setDate(sprintStart.getDate() + offset * sprint.durationWeeks * 7);
      const sprintEnd = getSprintEndDate(sprintStart, sprint.durationWeeks);
      const sprintNumber = currentSprintNumber + offset;

      const sprintIssues = issuesBySprintMap.get(sprintNumber) || [];

      // チーム全体の統計
      const closedIssues = sprintIssues.filter((i) => i.state === "closed" && i.score !== null);
      const evaluatedIssues = sprintIssues.filter((i) => i.qualityEvaluation !== null);
      const consistencyEvaluatedIssues = sprintIssues.filter((i) => i.consistencyEvaluation !== null);
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
          S: closedIssues.filter((i) => i.grade === "S").length,
          A: closedIssues.filter((i) => i.grade === "A").length,
          B: closedIssues.filter((i) => i.grade === "B").length,
          C: closedIssues.filter((i) => i.grade === "C").length,
        },
        // 品質評価
        evaluatedIssues: evaluatedIssues.length,
        averageQualityScore: evaluatedIssues.length > 0
          ? Math.round((evaluatedIssues.reduce((sum, i) => sum + (i.qualityEvaluation?.totalScore || 0), 0) / evaluatedIssues.length) * 10) / 10
          : null,
        qualityGradeDistribution: {
          A: evaluatedIssues.filter((i) => i.qualityEvaluation?.grade === "A").length,
          B: evaluatedIssues.filter((i) => i.qualityEvaluation?.grade === "B").length,
          C: evaluatedIssues.filter((i) => i.qualityEvaluation?.grade === "C").length,
          D: evaluatedIssues.filter((i) => i.qualityEvaluation?.grade === "D").length,
          E: evaluatedIssues.filter((i) => i.qualityEvaluation?.grade === "E").length,
        },
        // PR整合性評価
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

      // ユーザー別の統計
      const userStatsMap = new Map<string, {
        username: string;
        totalIssues: number;
        closedIssues: number;
        scores: number[];
        hours: number[];
        gradeDistribution: { S: number; A: number; B: number; C: number };
        qualityScores: number[];
        qualityGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
        consistencyScores: number[];
        consistencyGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
      }>();

      // trackedUsersの順序で初期化
      for (const username of trackedUsers) {
        userStatsMap.set(username, {
          username,
          totalIssues: 0,
          closedIssues: 0,
          scores: [],
          hours: [],
          gradeDistribution: { S: 0, A: 0, B: 0, C: 0 },
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
            stats.gradeDistribution[issue.grade]++;
          }
        }

        // 品質評価の集計
        if (issue.qualityEvaluation) {
          stats.qualityScores.push(issue.qualityEvaluation.totalScore);
          stats.qualityGradeDistribution[issue.qualityEvaluation.grade]++;
        }

        // PR整合性評価の集計
        if (issue.consistencyEvaluation) {
          stats.consistencyScores.push(issue.consistencyEvaluation.totalScore);
          stats.consistencyGradeDistribution[issue.consistencyEvaluation.grade]++;
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
      trackedUsers,
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
