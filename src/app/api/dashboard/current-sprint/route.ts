import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { RepositoryConfig, SyncMetadata, StoredIssue } from "@/types/settings";

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

// ユーザー統計の型
interface UserStats {
  username: string;
  totalIssues: number;
  closedIssues: number;
  openIssues: number;
  averageScore: number | null;
  averageHours: number | null;
  gradeDistribution: { S: number; A: number; B: number; C: number };
  // 品質評価
  averageQualityScore: number | null;
  qualityGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
  // PR整合性評価
  averageConsistencyScore: number | null;
  consistencyGradeDistribution: { A: number; B: number; C: number; D: number; E: number };
  issues: StoredIssue[];
}

// 同期をトリガー（内部呼び出し）
async function triggerSync(baseUrl: string, repoId: string): Promise<boolean> {
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sprintOffset = parseInt(searchParams.get("offset") || "0", 10);
    const skipSync = searchParams.get("skipSync") === "true";
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

    // スプリント計算
    const now = new Date();
    const baseDate = new Date(sprint.baseDate);
    const baseSprint = getSprintStartDate(baseDate, sprint.startDayOfWeek);
    const currentSprintStart = getSprintStartDate(now, sprint.startDayOfWeek);
    const currentSprintNumber = getSprintNumber(now, baseSprint, sprint.durationWeeks, sprint.startDayOfWeek);

    // オフセットを適用したスプリント
    const targetSprintStart = new Date(currentSprintStart);
    targetSprintStart.setDate(targetSprintStart.getDate() + sprintOffset * sprint.durationWeeks * 7);
    const targetSprintEnd = getSprintEndDate(targetSprintStart, sprint.durationWeeks);
    const targetSprintNumber = currentSprintNumber + sprintOffset;

    const isCurrent = sprintOffset === 0;

    // 同期メタデータを取得
    const syncMetaRef = db.collection("repositories").doc(repoDocId).collection("syncMetadata").doc("latest");
    const syncMetaDoc = await syncMetaRef.get();
    let lastSyncAt: string | null = null;

    if (syncMetaDoc.exists) {
      const syncMeta = syncMetaDoc.data() as SyncMetadata;
      lastSyncAt = syncMeta.lastSyncAt;

      // 同期状態チェック（現在のスプリントのみ）
      if (!skipSync && isCurrent) {
        const needsSync = syncMeta.lastSyncSprintNumber !== currentSprintNumber;
        if (needsSync) {
          const baseUrl = new URL(request.url).origin;
          await triggerSync(baseUrl, repoDocId);
        }
      }
    } else if (!skipSync && isCurrent) {
      // メタデータがない場合は同期をトリガー
      const baseUrl = new URL(request.url).origin;
      await triggerSync(baseUrl, repoDocId);
    }

    // Firestoreからissueを取得
    const issuesRef = db.collection("repositories").doc(repoDocId).collection("issues");
    const issuesSnapshot = await issuesRef
      .where("sprintNumber", "==", targetSprintNumber)
      .get();

    const allIssues: StoredIssue[] = [];
    issuesSnapshot.docs.forEach((doc) => {
      const data = doc.data() as StoredIssue;
      // trackedUsersフィルタ
      if (trackedUsers.length === 0 || trackedUsers.includes(data.creator)) {
        allIssues.push(data);
      }
    });

    // ユーザー別に集計
    const userStatsMap = new Map<string, UserStats>();

    // trackedUsersの順序で初期化
    if (trackedUsers.length > 0) {
      for (const username of trackedUsers) {
        userStatsMap.set(username, {
          username,
          totalIssues: 0,
          closedIssues: 0,
          openIssues: 0,
          averageScore: null,
          averageHours: null,
          gradeDistribution: { S: 0, A: 0, B: 0, C: 0 },
          averageQualityScore: null,
          qualityGradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
          averageConsistencyScore: null,
          consistencyGradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
          issues: [],
        });
      }
    }

    for (const issue of allIssues) {
      const username = issue.creator;

      if (!userStatsMap.has(username)) {
        userStatsMap.set(username, {
          username,
          totalIssues: 0,
          closedIssues: 0,
          openIssues: 0,
          averageScore: null,
          averageHours: null,
          gradeDistribution: { S: 0, A: 0, B: 0, C: 0 },
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
          stats.gradeDistribution[issue.grade]++;
        }
      } else {
        stats.openIssues++;
      }

      // 品質評価の集計
      if (issue.qualityEvaluation) {
        stats.qualityGradeDistribution[issue.qualityEvaluation.grade]++;
      }

      // PR整合性評価の集計
      if (issue.consistencyEvaluation) {
        stats.consistencyGradeDistribution[issue.consistencyEvaluation.grade]++;
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

      // 品質スコアの平均を計算
      const qualityEvaluatedIssues = stats.issues.filter((i) => i.qualityEvaluation !== null);
      if (qualityEvaluatedIssues.length > 0) {
        const totalQualityScore = qualityEvaluatedIssues.reduce(
          (sum, i) => sum + (i.qualityEvaluation?.totalScore || 0),
          0
        );
        stats.averageQualityScore = Math.round((totalQualityScore / qualityEvaluatedIssues.length) * 10) / 10;
      }

      // PR整合性スコアの平均を計算
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
    const closedIssues = allIssues.filter((i) => i.state === "closed" && i.score !== null);
    const qualityEvaluatedIssues = allIssues.filter((i) => i.qualityEvaluation !== null);
    const consistencyEvaluatedIssues = allIssues.filter((i) => i.consistencyEvaluation !== null);
    const overallStats = {
      totalIssues: allIssues.length,
      closedIssues: closedIssues.length,
      openIssues: allIssues.length - closedIssues.length,
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
      // 品質評価の統計
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
      // PR整合性評価の統計
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
    const formatDate = (d: Date) =>
      `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
    const period = `${formatDate(targetSprintStart)} - ${formatDate(targetSprintEnd)}`;

    return NextResponse.json({
      sprint: {
        number: targetSprintNumber,
        startDate: targetSprintStart.toISOString(),
        endDate: targetSprintEnd.toISOString(),
        period,
        startDayName: DAY_NAMES[sprint.startDayOfWeek],
        durationWeeks: sprint.durationWeeks,
        isCurrent,
        offset: sprintOffset,
      },
      repository: `${owner}/${repo}`,
      trackedUsersCount: trackedUsers.length,
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
