import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getOctokit } from "@/lib/github/client";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { GITHUB_REPOSITORY, SPRINT_CONFIG, getSprintStartDate, formatSprintPeriod, getCurrentSprint } from "@/config/project";
import { SPEED_CRITERIA } from "@/config/evaluation-criteria";
import type { Grade } from "@/types/evaluation";

// 完了時間から評価を取得
function getGradeFromHours(hours: number): { grade: Grade; score: number; message: string } {
  for (const criterion of SPEED_CRITERIA) {
    if (hours <= criterion.maxHours) {
      return {
        grade: criterion.grade,
        score: criterion.score,
        message: criterion.message,
      };
    }
  }
  const last = SPEED_CRITERIA[SPEED_CRITERIA.length - 1];
  return { grade: last.grade, score: last.score, message: last.message };
}

// Issue情報の型
interface IssueInfo {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  closedAt: string | null;
  completionTime: { totalHours: number; display: string } | null;
  grade: Grade | null;
  score: number | null;
  creator: string;
  assignee: string | null;
  sprintNumber: number;
}

// グレード分布の型
interface GradeDistribution {
  S: number;
  A: number;
  B: number;
  C: number;
}

// スプリント別統計の型
interface SprintStats {
  total: number;
  closed: number;
  avgHours: number | null;
  avgScore: number | null;
  gradeDistribution: GradeDistribution;
}

// ユーザー統計の型
interface UserStats {
  username: string;
  totalIssues: number;
  closedIssues: number;
  openIssues: number;
  averageCompletionHours: number | null;
  averageScore: number | null;
  gradeDistribution: GradeDistribution;
  issuesBySprint: Record<number, SprintStats>;
}

export default async function Home() {
  const { owner, repo } = GITHUB_REPOSITORY;

  try {
    const octokit = getOctokit();

    // 全Issueを取得（ページネーション対応）
    const allIssues: IssueInfo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: "all",
        per_page: perPage,
        page,
      });

      if (issues.length === 0) break;

      for (const issue of issues) {
        // PRは除外（issueのみ）
        if (issue.pull_request) continue;

        let completionTime = null;
        let grade: Grade | null = null;
        let score: number | null = null;

        if (issue.closed_at) {
          const createdAt = new Date(issue.created_at);
          const closedAt = new Date(issue.closed_at);
          const diffMs = closedAt.getTime() - createdAt.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          const diffDays = Math.floor(diffHours / 24);
          const remainingHours = Math.round(diffHours % 24);
          completionTime = {
            totalHours: Math.round(diffHours * 10) / 10,
            display: diffDays > 0 ? `${diffDays}日${remainingHours}時間` : `${remainingHours}時間`,
          };

          // 評価を計算
          const evaluation = getGradeFromHours(diffHours);
          grade = evaluation.grade;
          score = evaluation.score;
        }

        // Issue作成日からスプリント番号を計算
        const createdDate = new Date(issue.created_at);
        const sprintStart = getSprintStartDate(createdDate);
        const baseDate = new Date("2024-01-06");
        const diffDays = Math.floor((sprintStart.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
        const sprintNumber = Math.floor(diffDays / SPRINT_CONFIG.durationDays) + 1;

        allIssues.push({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          createdAt: issue.created_at,
          closedAt: issue.closed_at,
          completionTime,
          grade,
          score,
          creator: issue.user?.login || "unknown",
          assignee: issue.assignee?.login || null,
          sprintNumber,
        });
      }

      if (issues.length < perPage) break;
      page++;
    }

    // ユーザーごとの統計を計算
    const userStatsMap = new Map<string, UserStats>();

    for (const issue of allIssues) {
      const username = issue.creator;

      if (!userStatsMap.has(username)) {
        userStatsMap.set(username, {
          username,
          totalIssues: 0,
          closedIssues: 0,
          openIssues: 0,
          averageCompletionHours: null,
          averageScore: null,
          gradeDistribution: { S: 0, A: 0, B: 0, C: 0 },
          issuesBySprint: {},
        });
      }

      const stats = userStatsMap.get(username)!;
      stats.totalIssues++;

      if (issue.state === "closed") {
        stats.closedIssues++;
      } else {
        stats.openIssues++;
      }

      // グレード分布を更新
      if (issue.grade) {
        stats.gradeDistribution[issue.grade]++;
      }

      // スプリント別統計
      if (!stats.issuesBySprint[issue.sprintNumber]) {
        stats.issuesBySprint[issue.sprintNumber] = {
          total: 0,
          closed: 0,
          avgHours: null,
          avgScore: null,
          gradeDistribution: { S: 0, A: 0, B: 0, C: 0 },
        };
      }
      stats.issuesBySprint[issue.sprintNumber].total++;
      if (issue.state === "closed") {
        stats.issuesBySprint[issue.sprintNumber].closed++;
        if (issue.grade) {
          stats.issuesBySprint[issue.sprintNumber].gradeDistribution[issue.grade]++;
        }
      }
    }

    // 平均完了時間と平均スコアを計算
    for (const [username, stats] of Array.from(userStatsMap.entries())) {
      const closedIssues = allIssues.filter(
        (i) => i.creator === username && i.state === "closed" && i.completionTime
      );
      if (closedIssues.length > 0) {
        const totalHours = closedIssues.reduce(
          (sum, i) => sum + (i.completionTime?.totalHours || 0),
          0
        );
        stats.averageCompletionHours = Math.round((totalHours / closedIssues.length) * 10) / 10;

        const totalScore = closedIssues.reduce(
          (sum, i) => sum + (i.score || 0),
          0
        );
        stats.averageScore = Math.round((totalScore / closedIssues.length) * 10) / 10;
      }

      // スプリント別平均完了時間と平均スコア
      for (const sprintNum of Object.keys(stats.issuesBySprint).map(Number)) {
        const sprintClosedIssues = allIssues.filter(
          (i) =>
            i.creator === username &&
            i.sprintNumber === sprintNum &&
            i.state === "closed" &&
            i.completionTime
        );
        if (sprintClosedIssues.length > 0) {
          const totalHours = sprintClosedIssues.reduce(
            (sum, i) => sum + (i.completionTime?.totalHours || 0),
            0
          );
          stats.issuesBySprint[sprintNum].avgHours =
            Math.round((totalHours / sprintClosedIssues.length) * 10) / 10;

          const totalScore = sprintClosedIssues.reduce(
            (sum, i) => sum + (i.score || 0),
            0
          );
          stats.issuesBySprint[sprintNum].avgScore =
            Math.round((totalScore / sprintClosedIssues.length) * 10) / 10;
        }
      }
    }

    // コンソール出力
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 ${GITHUB_REPOSITORY.fullName} Issue統計`);
    console.log(`スプリント開始曜日: ${SPRINT_CONFIG.startDayName}曜日`);
    console.log(`現在のスプリント: ${formatSprintPeriod(getCurrentSprint())}`);
    console.log(`${"=".repeat(60)}`);

    console.log(`\n📋 全Issue一覧 (${allIssues.length}件)`);
    console.log("-".repeat(60));
    allIssues.forEach((issue) => {
      console.log({
        ...issue,
      });
    });

    console.log(`\n👥 ユーザー別統計`);
    console.log("-".repeat(60));
    for (const stats of Array.from(userStatsMap.values())) {
      console.log(`\n【${stats.username}】`);
      console.log(`  総Issue数: ${stats.totalIssues} (クローズ: ${stats.closedIssues}, オープン: ${stats.openIssues})`);
      console.log(`  平均完了時間: ${stats.averageCompletionHours ? `${stats.averageCompletionHours}時間` : "-"}`);
      console.log(`  平均スコア: ${stats.averageScore ? `${stats.averageScore}点` : "-"}`);
      console.log(`  グレード分布: S:${stats.gradeDistribution.S} A:${stats.gradeDistribution.A} B:${stats.gradeDistribution.B} C:${stats.gradeDistribution.C}`);
      console.log(`  スプリント別:`);
      const sortedSprints = Object.keys(stats.issuesBySprint)
        .map(Number)
        .sort((a, b) => a - b);
      for (const sprintNum of sortedSprints) {
        const s = stats.issuesBySprint[sprintNum];
        const gradeStr = `S:${s.gradeDistribution.S} A:${s.gradeDistribution.A} B:${s.gradeDistribution.B} C:${s.gradeDistribution.C}`;
        console.log(
          `    Sprint ${sprintNum}: ${s.total}件 (完了: ${s.closed}, 平均: ${s.avgHours ? `${s.avgHours}h` : "-"}, スコア: ${s.avgScore ? `${s.avgScore}点` : "-"}, ${gradeStr})`
        );
      }
    }

    console.log(`\n${"=".repeat(60)}\n`);
  } catch (error) {
    console.error("GitHub API エラー:", error);
  }

  // Firestore接続テスト
  console.log(`\n${"=".repeat(60)}`);
  console.log("🔥 Firestore接続テスト");
  console.log("=".repeat(60));

  try {
    const db = getAdminFirestore();

    // テストドキュメントを書き込み
    const testRef = db.collection("_connection_test").doc("test");
    await testRef.set({
      message: "Firestore接続テスト成功",
      timestamp: new Date(),
    });
    console.log("✅ Firestore書き込み成功");

    // テストドキュメントを読み込み
    const doc = await testRef.get();
    if (doc.exists) {
      console.log("✅ Firestore読み込み成功:", doc.data());
    }

    // テストドキュメントを削除
    await testRef.delete();
    console.log("✅ Firestoreテストドキュメント削除完了");

    console.log("\n🎉 Firestore接続: 正常");
  } catch (error) {
    console.error("❌ Firestore接続エラー:", error);
  }

  console.log(`\n${"=".repeat(60)}\n`);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">チーム健全性ダッシュボード</h1>
        <p className="text-muted-foreground mt-2">
          GitHubリポジトリのIssue/PRを分析し、チームの開発健全性を可視化します
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>リポジトリ管理</CardTitle>
            <CardDescription>
              GitHubリポジトリを登録し、Issue/PRデータを同期
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/repositories">リポジトリ一覧へ</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>チームサマリー</CardTitle>
            <CardDescription>
              3軸評価の平均スコア、グレード分布を確認
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/summary">サマリーを見る</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>評価基準</CardTitle>
            <CardDescription>
              完了速度・記述品質・整合性の評価基準
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">S (120点)</span>: 24時間以内完了
              </p>
              <p>
                <span className="font-semibold">A (100点)</span>: 72時間以内完了
              </p>
              <p>
                <span className="font-semibold">B (70点)</span>: 120時間以内完了
              </p>
              <p>
                <span className="font-semibold">C (40点)</span>: 120時間超
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
