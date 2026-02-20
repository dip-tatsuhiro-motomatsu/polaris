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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
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
  averageConsistencyScore: number | null;
  consistencyGradeDistribution: QualityGradeDistribution;
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
    consistencyEvaluatedIssues: number;
    averageConsistencyScore: number | null;
    consistencyGradeDistribution: QualityGradeDistribution;
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

// グレードの色（速度・A-E統一）
const GRADE_COLORS = {
  A: "#22c55e",
  B: "#3b82f6",
  C: "#eab308",
  D: "#f97316",
  E: "#ef4444",
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
    A: sprint.team.gradeDistribution.A,
    B: sprint.team.gradeDistribution.B,
    C: sprint.team.gradeDistribution.C,
    D: sprint.team.gradeDistribution.D,
    E: sprint.team.gradeDistribution.E,
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

  // PR整合性スコア推移のグラフデータ
  const consistencyScoreData = data.sprints.map((sprint) => {
    const entry: Record<string, string | number | null> = {
      name: `Sprint ${sprint.sprintNumber}`,
      period: sprint.period,
      "チーム平均": sprint.team.averageConsistencyScore,
    };
    for (const user of sprint.users) {
      entry[user.username] = user.averageConsistencyScore;
    }
    return entry;
  });

  // PR整合性グレード分布のグラフデータ
  const consistencyGradeDistributionData = data.sprints.map((sprint) => ({
    name: `Sprint ${sprint.sprintNumber}`,
    A: sprint.team.consistencyGradeDistribution?.A ?? 0,
    B: sprint.team.consistencyGradeDistribution?.B ?? 0,
    C: sprint.team.consistencyGradeDistribution?.C ?? 0,
    D: sprint.team.consistencyGradeDistribution?.D ?? 0,
    E: sprint.team.consistencyGradeDistribution?.E ?? 0,
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

  // PR整合性スコアの全体統計
  const allConsistencyScores = data.sprints
    .filter((s) => s.team.averageConsistencyScore !== null)
    .map((s) => s.team.averageConsistencyScore as number);
  const overallAverageConsistencyScore = allConsistencyScores.length > 0
    ? Math.round((allConsistencyScores.reduce((a, b) => a + b, 0) / allConsistencyScores.length) * 10) / 10
    : null;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">評価履歴</h1>
          <p className="text-muted-foreground mt-1">
            過去{data.sprintCount}スプリントの推移
          </p>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{data.trackedUsers.length}</div>
              <div className="text-sm text-muted-foreground">トラック中ユーザー</div>
            </div>
          </CardContent>
        </Card>
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
                <span className="text-sm text-muted-foreground">/100</span>
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
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <div className="text-sm text-muted-foreground">平均品質スコア</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">
                {overallAverageConsistencyScore !== null ? overallAverageConsistencyScore : "-"}
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <div className="text-sm text-muted-foreground">平均整合性スコア</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 評価軸別グラフ（タブ） */}
      <Card>
        <CardHeader>
          <CardTitle>評価推移グラフ</CardTitle>
          <CardDescription>スプリントごとの評価推移を軸別に表示</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="speed" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="speed">速度評価</TabsTrigger>
              <TabsTrigger value="quality">品質評価</TabsTrigger>
              <TabsTrigger value="consistency">PR整合性評価</TabsTrigger>
            </TabsList>

            {/* 速度評価タブ */}
            <TabsContent value="speed" className="space-y-6 mt-6">
              {/* 速度スコア推移 */}
              <div>
                <h4 className="font-semibold mb-2">スコア推移</h4>
                <p className="text-sm text-muted-foreground mb-4">スプリントごとのチーム平均と各ユーザーの速度スコア</p>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scoreData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis domain={[0, 100]} fontSize={12} />
                      <Tooltip
                        labelFormatter={(label) => {
                          const item = scoreData.find((d) => d.name === label);
                          return item ? `${label} (${item.period})` : label;
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="チーム平均"
                        stroke="#1f2937"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        connectNulls
                      />
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
              </div>

              {/* 速度グレード分布推移 */}
              <div className="pt-6 border-t">
                <h4 className="font-semibold mb-2">グレード分布推移</h4>
                <p className="text-sm text-muted-foreground mb-4">スプリントごとの速度グレード分布（チーム全体）</p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="A" stackId="a" fill={GRADE_COLORS.A} name="A" />
                      <Bar dataKey="B" stackId="a" fill={GRADE_COLORS.B} name="B" />
                      <Bar dataKey="C" stackId="a" fill={GRADE_COLORS.C} name="C" />
                      <Bar dataKey="D" stackId="a" fill={GRADE_COLORS.D} name="D" />
                      <Bar dataKey="E" stackId="a" fill={GRADE_COLORS.E} name="E" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>

            {/* 品質評価タブ */}
            <TabsContent value="quality" className="space-y-6 mt-6">
              {/* 品質スコア推移 */}
              <div>
                <h4 className="font-semibold mb-2">スコア推移</h4>
                <p className="text-sm text-muted-foreground mb-4">スプリントごとのチーム平均と各ユーザーの品質スコア</p>
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
                      <Line
                        type="monotone"
                        dataKey="チーム平均"
                        stroke="#1f2937"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        connectNulls
                      />
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
              </div>

              {/* 品質グレード分布推移 */}
              <div className="pt-6 border-t">
                <h4 className="font-semibold mb-2">グレード分布推移</h4>
                <p className="text-sm text-muted-foreground mb-4">スプリントごとの品質グレード分布（チーム全体）</p>
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
              </div>
            </TabsContent>

            {/* PR整合性評価タブ */}
            <TabsContent value="consistency" className="space-y-6 mt-6">
              {/* PR整合性スコア推移 */}
              <div>
                <h4 className="font-semibold mb-2">スコア推移</h4>
                <p className="text-sm text-muted-foreground mb-4">スプリントごとのチーム平均と各ユーザーのPR整合性スコア</p>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={consistencyScoreData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis domain={[0, 100]} fontSize={12} />
                      <Tooltip
                        labelFormatter={(label) => {
                          const item = consistencyScoreData.find((d) => d.name === label);
                          return item ? `${label} (${item.period})` : label;
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="チーム平均"
                        stroke="#1f2937"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        connectNulls
                      />
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
              </div>

              {/* PR整合性グレード分布推移 */}
              <div className="pt-6 border-t">
                <h4 className="font-semibold mb-2">グレード分布推移</h4>
                <p className="text-sm text-muted-foreground mb-4">スプリントごとのPR整合性グレード分布（チーム全体）</p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={consistencyGradeDistributionData}>
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
              </div>
            </TabsContent>
          </Tabs>
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
                  <th className="text-center p-2">平均整合性</th>
                  <th className="text-center p-2">整合性グレード</th>
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
                        {(["A", "B", "C", "D", "E"] as const).map((grade) => (
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
                    <td className="p-2 text-center">
                      {sprint.team.averageConsistencyScore !== null ? (
                        <span className="font-semibold">{sprint.team.averageConsistencyScore}</span>
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
                            {grade}:{sprint.team.consistencyGradeDistribution?.[grade] ?? 0}
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
