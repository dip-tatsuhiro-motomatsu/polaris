"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useRepository } from "@/contexts/RepositoryContext";

// 型定義
interface GradeDistribution {
  S: number;
  A: number;
  B: number;
  C: number;
}

interface QualityGradeDistribution {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
}

interface UserSprintStats {
  username: string;
  totalIssues: number;
  closedIssues: number;
  averageScore: number | null;
  averageHours: number | null;
  gradeDistribution: GradeDistribution;
  averageQualityScore: number | null;
  qualityGradeDistribution: QualityGradeDistribution;
}

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
    gradeDistribution: GradeDistribution;
    evaluatedIssues: number;
    averageQualityScore: number | null;
    qualityGradeDistribution: QualityGradeDistribution;
  };
  users: UserSprintStats[];
}

interface HistoryData {
  repository: string;
  trackedUsers: string[];
  sprintCount: number;
  sprints: SprintStats[];
}

// ユーザーごとの色
const USER_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#0088FE",
];

// グレードの色（速度）
const GRADE_COLORS = {
  S: "#a855f7",
  A: "#22c55e",
  B: "#eab308",
  C: "#ef4444",
};

// 品質グレードの色
const QUALITY_GRADE_COLORS = {
  A: "#22c55e",
  B: "#3b82f6",
  C: "#eab308",
  D: "#f97316",
  E: "#ef4444",
};

export default function HistoryPage() {
  const { selectedRepository, isLoading: isRepoLoading } = useRepository();
  const [data, setData] = useState<HistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sprintCount, setSprintCount] = useState("12");

  const fetchData = useCallback(async () => {
    if (!selectedRepository) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(
        `/api/dashboard/history?repoId=${selectedRepository.id}&count=${sprintCount}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch history data");
      }

      setData(result);
    } catch (err) {
      console.error("History fetch error:", err);
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }, [sprintCount, selectedRepository]);

  useEffect(() => {
    if (!isRepoLoading) {
      fetchData();
    }
  }, [fetchData, isRepoLoading]);

  if (isRepoLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="h-80 bg-gray-200 rounded mb-4"></div>
          <div className="h-80 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!selectedRepository) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">リポジトリが選択されていません</h2>
          <p className="text-muted-foreground mb-4">
            ヘッダーのドロップダウンからリポジトリを選択するか、新しいリポジトリを追加してください。
          </p>
          <Button asChild>
            <Link href="/settings">リポジトリを追加</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    const isSettingsError = error.includes("設定が見つかりません");

    return (
      <div className="space-y-4">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
        {isSettingsError && (
          <Button asChild>
            <Link href="/settings">設定画面へ</Link>
          </Button>
        )}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // チーム平均 + ユーザー別スコアのグラフデータ（統合・速度）
  const scoreData = data.sprints.map((sprint) => {
    const entry: Record<string, string | number | null> = {
      name: `Sprint ${sprint.sprintNumber}`,
      period: sprint.period,
      "チーム平均": sprint.team.averageScore,
    };
    for (const user of sprint.users) {
      entry[user.username] = user.averageScore;
    }
    return entry;
  });

  // 品質スコア推移のグラフデータ
  const qualityScoreData = data.sprints.map((sprint) => {
    const entry: Record<string, string | number | null> = {
      name: `Sprint ${sprint.sprintNumber}`,
      period: sprint.period,
      "チーム平均": sprint.team.averageQualityScore,
    };
    for (const user of sprint.users) {
      entry[user.username] = user.averageQualityScore;
    }
    return entry;
  });

  // グレード分布のグラフデータ（チーム全体・速度）
  const gradeDistributionData = data.sprints.map((sprint) => ({
    name: `Sprint ${sprint.sprintNumber}`,
    S: sprint.team.gradeDistribution.S,
    A: sprint.team.gradeDistribution.A,
    B: sprint.team.gradeDistribution.B,
    C: sprint.team.gradeDistribution.C,
  }));

  // 品質グレード分布のグラフデータ
  const qualityGradeDistributionData = data.sprints.map((sprint) => ({
    name: `Sprint ${sprint.sprintNumber}`,
    A: sprint.team.qualityGradeDistribution?.A ?? 0,
    B: sprint.team.qualityGradeDistribution?.B ?? 0,
    C: sprint.team.qualityGradeDistribution?.C ?? 0,
    D: sprint.team.qualityGradeDistribution?.D ?? 0,
    E: sprint.team.qualityGradeDistribution?.E ?? 0,
  }));

  // 全体統計の計算
  const totalClosedIssues = data.sprints.reduce((sum, s) => sum + s.team.closedIssues, 0);
  const allScores = data.sprints
    .filter((s) => s.team.averageScore !== null)
    .map((s) => s.team.averageScore as number);
  const overallAverageScore = allScores.length > 0
    ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
    : null;

  // 品質スコアの全体統計
  const allQualityScores = data.sprints
    .filter((s) => s.team.averageQualityScore !== null)
    .map((s) => s.team.averageQualityScore as number);
  const overallAverageQualityScore = allQualityScores.length > 0
    ? Math.round((allQualityScores.reduce((a, b) => a + b, 0) / allQualityScores.length) * 10) / 10
    : null;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">評価履歴</h1>
          <p className="text-muted-foreground mt-1">
            {data.repository} | 過去{data.sprintCount}スプリントの推移
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">表示期間:</span>
          <Select value={sprintCount} onValueChange={setSprintCount}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4週間</SelectItem>
              <SelectItem value="8">8週間</SelectItem>
              <SelectItem value="12">12週間</SelectItem>
              <SelectItem value="24">24週間</SelectItem>
              <SelectItem value="48">48週間</SelectItem>
              <SelectItem value="72">72週間</SelectItem>
              <SelectItem value="96">96週間</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{data.sprintCount}</div>
              <div className="text-sm text-muted-foreground">スプリント数</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{totalClosedIssues}</div>
              <div className="text-sm text-muted-foreground">完了Issue数</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">
                {overallAverageScore !== null ? overallAverageScore : "-"}
              </div>
              <div className="text-sm text-muted-foreground">平均速度スコア</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">
                {overallAverageQualityScore !== null ? overallAverageQualityScore : "-"}
              </div>
              <div className="text-sm text-muted-foreground">平均品質スコア</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{data.trackedUsers.length}</div>
              <div className="text-sm text-muted-foreground">トラック中ユーザー</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 速度スコア推移（チーム平均 + ユーザー別） */}
      <Card>
        <CardHeader>
          <CardTitle>速度スコア推移</CardTitle>
          <CardDescription>スプリントごとのチーム平均と各ユーザーの速度スコア</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 120]} fontSize={12} />
                <Tooltip
                  labelFormatter={(label) => {
                    const item = scoreData.find((d) => d.name === label);
                    return item ? `${label} (${item.period})` : label;
                  }}
                />
                <Legend />
                {/* チーム平均（太い点線） */}
                <Line
                  type="monotone"
                  dataKey="チーム平均"
                  stroke="#1f2937"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  connectNulls
                />
                {/* ユーザー別 */}
                {data.trackedUsers.map((username, index) => (
                  <Line
                    key={username}
                    type="monotone"
                    dataKey={username}
                    stroke={USER_COLORS[index % USER_COLORS.length]}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* グレード分布推移（速度） */}
      <Card>
        <CardHeader>
          <CardTitle>速度グレード分布推移</CardTitle>
          <CardDescription>スプリントごとの速度グレード分布（チーム全体）</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="S" stackId="a" fill={GRADE_COLORS.S} name="S" />
                <Bar dataKey="A" stackId="a" fill={GRADE_COLORS.A} name="A" />
                <Bar dataKey="B" stackId="a" fill={GRADE_COLORS.B} name="B" />
                <Bar dataKey="C" stackId="a" fill={GRADE_COLORS.C} name="C" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 品質スコア推移 */}
      <Card>
        <CardHeader>
          <CardTitle>品質スコア推移</CardTitle>
          <CardDescription>スプリントごとのチーム平均と各ユーザーの品質スコア</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={qualityScoreData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} />
                <Tooltip
                  labelFormatter={(label) => {
                    const item = qualityScoreData.find((d) => d.name === label);
                    return item ? `${label} (${item.period})` : label;
                  }}
                />
                <Legend />
                {/* チーム平均（太い点線） */}
                <Line
                  type="monotone"
                  dataKey="チーム平均"
                  stroke="#1f2937"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  connectNulls
                />
                {/* ユーザー別 */}
                {data.trackedUsers.map((username, index) => (
                  <Line
                    key={username}
                    type="monotone"
                    dataKey={username}
                    stroke={USER_COLORS[index % USER_COLORS.length]}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 品質グレード分布推移 */}
      <Card>
        <CardHeader>
          <CardTitle>品質グレード分布推移</CardTitle>
          <CardDescription>スプリントごとの品質グレード分布（チーム全体）</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={qualityGradeDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="A" stackId="a" fill={QUALITY_GRADE_COLORS.A} name="A" />
                <Bar dataKey="B" stackId="a" fill={QUALITY_GRADE_COLORS.B} name="B" />
                <Bar dataKey="C" stackId="a" fill={QUALITY_GRADE_COLORS.C} name="C" />
                <Bar dataKey="D" stackId="a" fill={QUALITY_GRADE_COLORS.D} name="D" />
                <Bar dataKey="E" stackId="a" fill={QUALITY_GRADE_COLORS.E} name="E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 詳細テーブル */}
      <Card>
        <CardHeader>
          <CardTitle>スプリント詳細</CardTitle>
          <CardDescription>各スプリントの詳細データ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Sprint</th>
                  <th className="text-left p-2">期間</th>
                  <th className="text-center p-2">完了Issue</th>
                  <th className="text-center p-2">平均速度</th>
                  <th className="text-center p-2">速度グレード</th>
                  <th className="text-center p-2">平均品質</th>
                  <th className="text-center p-2">品質グレード</th>
                </tr>
              </thead>
              <tbody>
                {data.sprints.slice().reverse().map((sprint) => (
                  <tr key={sprint.sprintNumber} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">Sprint {sprint.sprintNumber}</td>
                    <td className="p-2 text-muted-foreground">{sprint.period}</td>
                    <td className="p-2 text-center">{sprint.team.closedIssues}</td>
                    <td className="p-2 text-center">
                      {sprint.team.averageScore !== null ? (
                        <span className="font-semibold">{sprint.team.averageScore}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-center gap-1">
                        {(["S", "A", "B", "C"] as const).map((grade) => (
                          <Badge
                            key={grade}
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: GRADE_COLORS[grade],
                              color: GRADE_COLORS[grade],
                            }}
                          >
                            {grade}:{sprint.team.gradeDistribution[grade]}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      {sprint.team.averageQualityScore !== null ? (
                        <span className="font-semibold">{sprint.team.averageQualityScore}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-center gap-1">
                        {(["A", "B", "C", "D", "E"] as const).map((grade) => (
                          <Badge
                            key={grade}
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: QUALITY_GRADE_COLORS[grade],
                              color: QUALITY_GRADE_COLORS[grade],
                            }}
                          >
                            {grade}:{sprint.team.qualityGradeDistribution?.[grade] ?? 0}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
