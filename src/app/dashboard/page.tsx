"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useRepository } from "@/contexts/RepositoryContext";

// 型定義
interface QualityCategoryScore {
  categoryId: string;
  categoryName: string;
  score: number;
  maxScore: number;
  feedback: string;
}

interface QualityEvaluation {
  totalScore: number;
  grade: "A" | "B" | "C" | "D" | "E";
  categories: QualityCategoryScore[];
  overallFeedback: string;
  improvementSuggestions: string[];
  evaluatedAt: string;
}

interface ConsistencyCategoryScore {
  categoryId: string;
  categoryName: string;
  score: number;
  maxScore: number;
  feedback: string;
}

interface ConsistencyEvaluation {
  totalScore: number;
  grade: "A" | "B" | "C" | "D" | "E";
  linkedPRs: { number: number; title: string; url: string }[];
  categories: ConsistencyCategoryScore[];
  overallFeedback: string;
  issueImprovementSuggestions: string[];
  evaluatedAt: string;
}

interface IssueData {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  closedAt: string | null;
  completionHours: number | null;
  grade: "A" | "B" | "C" | "D" | "E" | null;
  score: number | null;
  message: string | null;
  qualityEvaluation: QualityEvaluation | null;
  consistencyEvaluation: ConsistencyEvaluation | null;
  creator: string;
  assignee: string | null;
  url: string;
}

// 完了時間を表示用文字列に変換
function formatCompletionTime(hours: number | null): string | null {
  if (hours === null) return null;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return days > 0 ? `${days}日${remainingHours}時間` : `${remainingHours}時間`;
}

// 相対時間を表示用文字列に変換
function formatRelativeTime(isoString: string | null): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "たった今";
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

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

interface UserStats {
  username: string;
  totalIssues: number;
  closedIssues: number;
  openIssues: number;
  averageScore: number | null;
  averageHours: number | null;
  gradeDistribution: GradeDistribution;
  averageQualityScore: number | null;
  qualityGradeDistribution: QualityGradeDistribution;
  averageConsistencyScore: number | null;
  consistencyGradeDistribution: QualityGradeDistribution;
  issues: IssueData[];
}

interface DashboardData {
  sprint: {
    number: number;
    startDate: string;
    endDate: string;
    period: string;
    startDayName: string;
    isCurrent: boolean;
    offset: number;
  };
  repository: string;
  overallStats: {
    totalIssues: number;
    closedIssues: number;
    openIssues: number;
    averageScore: number | null;
    averageHours: number | null;
    gradeDistribution: GradeDistribution;
    qualityEvaluatedIssues: number;
    averageQualityScore: number | null;
    qualityGradeDistribution: QualityGradeDistribution;
    consistencyEvaluatedIssues: number;
    averageConsistencyScore: number | null;
    consistencyGradeDistribution: QualityGradeDistribution;
  };
  users: UserStats[];
  lastSyncAt: string | null;
}

// グレードに応じた色を返す（A-E統一）
function getGradeColor(grade: "A" | "B" | "C" | "D" | "E" | null) {
  switch (grade) {
    case "A":
      return "bg-green-500 text-white";
    case "B":
      return "bg-blue-500 text-white";
    case "C":
      return "bg-yellow-500 text-white";
    case "D":
      return "bg-orange-500 text-white";
    case "E":
      return "bg-red-500 text-white";
    default:
      return "bg-gray-300 text-gray-700";
  }
}

// スコアに応じたグレードを計算（A-E）
function getGradeFromScore(score: number | null): "A" | "B" | "C" | "D" | "E" | null {
  if (score === null) return null;
  if (score >= 81) return "A";
  if (score >= 61) return "B";
  if (score >= 41) return "C";
  if (score >= 21) return "D";
  return "E";
}

// 品質グレードに応じた色を返す
function getQualityGradeColor(grade: "A" | "B" | "C" | "D" | "E" | null) {
  switch (grade) {
    case "A":
      return "bg-green-500 text-white";
    case "B":
      return "bg-blue-500 text-white";
    case "C":
      return "bg-yellow-500 text-white";
    case "D":
      return "bg-orange-500 text-white";
    case "E":
      return "bg-red-500 text-white";
    default:
      return "bg-gray-300 text-gray-700";
  }
}

// 品質スコアからグレードを計算
function getQualityGradeFromScore(score: number | null): "A" | "B" | "C" | "D" | "E" | null {
  if (score === null) return null;
  if (score >= 81) return "A";
  if (score >= 61) return "B";
  if (score >= 41) return "C";
  if (score >= 21) return "D";
  return "E";
}

// 総合評価カード
function OverallStatsCard({ stats, title }: { stats: UserStats | DashboardData["overallStats"]; title: string }) {
  const avgGrade = getGradeFromScore(stats.averageScore);
  const avgQualityGrade = getQualityGradeFromScore(stats.averageQualityScore);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 速度評価 */}
        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-2 font-medium">速度評価</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {stats.averageScore !== null ? (
                  <span className={getGradeColor(avgGrade).replace("bg-", "text-").replace(" text-white", "")}>
                    {stats.averageScore}
                  </span>
                ) : (
                  "-"
                )}
              </div>
              <div className="text-xs text-muted-foreground">平均スコア</div>
            </div>
            <div className="text-center">
              <Badge className={`text-sm px-2 py-0.5 ${getGradeColor(avgGrade)}`}>
                {avgGrade || "-"}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">平均グレード</div>
            </div>
          </div>
          <div className="flex gap-2 mt-2 justify-center">
            {(["A", "B", "C", "D", "E"] as const).map((grade) => (
              <div key={grade} className="flex items-center gap-1">
                <Badge className={`${getGradeColor(grade)} text-xs`}>{grade}</Badge>
                <span className="text-xs">{stats.gradeDistribution[grade]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 品質評価 */}
        <div className="mb-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground mb-2 font-medium">記述品質評価</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {stats.averageQualityScore !== null ? (
                  <span className={getQualityGradeColor(avgQualityGrade).replace("bg-", "text-").replace(" text-white", "")}>
                    {stats.averageQualityScore}
                  </span>
                ) : (
                  "-"
                )}
              </div>
              <div className="text-xs text-muted-foreground">平均スコア</div>
            </div>
            <div className="text-center">
              <Badge className={`text-sm px-2 py-0.5 ${getQualityGradeColor(avgQualityGrade)}`}>
                {avgQualityGrade || "-"}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">平均グレード</div>
            </div>
          </div>
          <div className="flex gap-2 mt-2 justify-center flex-wrap">
            {(["A", "B", "C", "D", "E"] as const).map((grade) => (
              <div key={grade} className="flex items-center gap-1">
                <Badge className={`${getQualityGradeColor(grade)} text-xs`}>{grade}</Badge>
                <span className="text-xs">{stats.qualityGradeDistribution[grade]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PR整合性評価 */}
        {"consistencyGradeDistribution" in stats && (
          <div className="mb-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground mb-2 font-medium">PR整合性評価</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {stats.averageConsistencyScore !== null ? (
                    <span className={getQualityGradeColor(getQualityGradeFromScore(stats.averageConsistencyScore)).replace("bg-", "text-").replace(" text-white", "")}>
                      {stats.averageConsistencyScore}
                    </span>
                  ) : (
                    "-"
                  )}
                </div>
                <div className="text-xs text-muted-foreground">平均スコア</div>
              </div>
              <div className="text-center">
                <Badge className={`text-sm px-2 py-0.5 ${getQualityGradeColor(getQualityGradeFromScore(stats.averageConsistencyScore))}`}>
                  {getQualityGradeFromScore(stats.averageConsistencyScore) || "-"}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">平均グレード</div>
              </div>
            </div>
            <div className="flex gap-2 mt-2 justify-center flex-wrap">
              {(["A", "B", "C", "D", "E"] as const).map((grade) => (
                <div key={grade} className="flex items-center gap-1">
                  <Badge className={`${getQualityGradeColor(grade)} text-xs`}>{grade}</Badge>
                  <span className="text-xs">{stats.consistencyGradeDistribution[grade]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Issue数 */}
        <div className="pt-4 border-t grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="font-semibold">{stats.totalIssues}</div>
            <div className="text-muted-foreground text-xs">総Issue</div>
          </div>
          <div>
            <div className="font-semibold text-green-600">{stats.closedIssues}</div>
            <div className="text-muted-foreground text-xs">完了</div>
          </div>
          <div>
            <div className="font-semibold text-orange-600">{stats.openIssues}</div>
            <div className="text-muted-foreground text-xs">未完了</div>
          </div>
        </div>

        {"averageHours" in stats && stats.averageHours !== null && (
          <div className="mt-4 text-sm text-muted-foreground">
            平均完了時間: <span className="font-semibold text-foreground">{stats.averageHours}時間</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 品質評価詳細ダイアログ
function QualityEvaluationDialog({
  issue,
  open,
  onOpenChange,
}: {
  issue: IssueData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!issue?.qualityEvaluation) return null;

  const evaluation = issue.qualityEvaluation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>#{issue.number}</span>
            <Badge className={getQualityGradeColor(evaluation.grade)}>
              {evaluation.grade} ({evaluation.totalScore}点)
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-left">
            {issue.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* カテゴリ別スコア */}
          <div>
            <h4 className="font-semibold mb-3">カテゴリ別評価</h4>
            <div className="space-y-3">
              {evaluation.categories.map((cat) => (
                <div key={cat.categoryId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{cat.categoryName}</span>
                    <span className="font-semibold">{cat.score}/{cat.maxScore}点</span>
                  </div>
                  <Progress value={(cat.score / cat.maxScore) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground">{cat.feedback}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 総評 */}
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">総評</h4>
            <p className="text-sm text-muted-foreground">{evaluation.overallFeedback}</p>
          </div>

          {/* 改善提案 */}
          {evaluation.improvementSuggestions.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-2">改善提案</h4>
              <ul className="list-disc list-inside space-y-1">
                {evaluation.improvementSuggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// PR整合性評価詳細ダイアログ
function ConsistencyEvaluationDialog({
  issue,
  open,
  onOpenChange,
}: {
  issue: IssueData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!issue?.consistencyEvaluation) return null;

  const evaluation = issue.consistencyEvaluation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>#{issue.number}</span>
            <Badge className={getQualityGradeColor(evaluation.grade)}>
              {evaluation.grade} ({evaluation.totalScore}点)
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-left">
            {issue.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* リンクされたPR */}
          {evaluation.linkedPRs.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">リンクされたPR</h4>
              <ul className="space-y-1">
                {evaluation.linkedPRs.map((pr) => (
                  <li key={pr.number} className="text-sm">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      #{pr.number}: {pr.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* カテゴリ別スコア */}
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-3">カテゴリ別評価</h4>
            <div className="space-y-3">
              {evaluation.categories.map((cat) => (
                <div key={cat.categoryId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{cat.categoryName}</span>
                    <span className="font-semibold">{cat.score}/{cat.maxScore}点</span>
                  </div>
                  <Progress value={(cat.score / cat.maxScore) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground">{cat.feedback}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 総評 */}
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">総評</h4>
            <p className="text-sm text-muted-foreground">{evaluation.overallFeedback}</p>
          </div>

          {/* Issue改善提案 */}
          {evaluation.issueImprovementSuggestions.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-2">Issue記述の改善提案</h4>
              <ul className="list-disc list-inside space-y-1">
                {evaluation.issueImprovementSuggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Issue一覧テーブル
function IssueTable({ issues }: { issues: IssueData[] }) {
  const [selectedIssue, setSelectedIssue] = useState<IssueData | null>(null);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);
  const [consistencyDialogOpen, setConsistencyDialogOpen] = useState(false);

  const handleQualityClick = (issue: IssueData) => {
    if (issue.qualityEvaluation) {
      setSelectedIssue(issue);
      setQualityDialogOpen(true);
    }
  };

  const handleConsistencyClick = (issue: IssueData) => {
    if (issue.consistencyEvaluation) {
      setSelectedIssue(issue);
      setConsistencyDialogOpen(true);
    }
  };

  if (issues.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        このスプリントにはIssueがありません
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>タイトル</TableHead>
            <TableHead className="w-20">状態</TableHead>
            <TableHead className="w-20">速度</TableHead>
            <TableHead className="w-20">品質</TableHead>
            <TableHead className="w-20">整合性</TableHead>
            <TableHead className="w-28">完了時間</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <TableRow key={issue.number}>
              <TableCell className="font-mono">
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  #{issue.number}
                </a>
              </TableCell>
              <TableCell>
                <div className="max-w-md truncate" title={issue.title}>
                  {issue.title}
                </div>
                {issue.message && issue.state === "closed" && (
                  <div className="text-xs text-muted-foreground mt-1">{issue.message}</div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={issue.state === "closed" ? "secondary" : "default"}>
                  {issue.state === "closed" ? "完了" : "未完了"}
                </Badge>
              </TableCell>
              <TableCell>
                {issue.grade ? (
                  <div className="flex items-center gap-1">
                    <Badge className={getGradeColor(issue.grade)}>{issue.grade}</Badge>
                    <span className="text-xs text-muted-foreground">{issue.score}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {issue.qualityEvaluation ? (
                  <button
                    onClick={() => handleQualityClick(issue)}
                    className="flex items-center gap-1 hover:opacity-80 cursor-pointer"
                  >
                    <Badge className={getQualityGradeColor(issue.qualityEvaluation.grade)}>
                      {issue.qualityEvaluation.grade}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{issue.qualityEvaluation.totalScore}</span>
                  </button>
                ) : (
                  <span className="text-muted-foreground text-xs">未評価</span>
                )}
              </TableCell>
              <TableCell>
                {issue.consistencyEvaluation ? (
                  <button
                    onClick={() => handleConsistencyClick(issue)}
                    className="flex items-center gap-1 hover:opacity-80 cursor-pointer"
                  >
                    <Badge className={getQualityGradeColor(issue.consistencyEvaluation.grade)}>
                      {issue.consistencyEvaluation.grade}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{issue.consistencyEvaluation.totalScore}</span>
                  </button>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </TableCell>
              <TableCell>
                {formatCompletionTime(issue.completionHours) || <span className="text-muted-foreground">-</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <QualityEvaluationDialog
        issue={selectedIssue}
        open={qualityDialogOpen}
        onOpenChange={setQualityDialogOpen}
      />

      <ConsistencyEvaluationDialog
        issue={selectedIssue}
        open={consistencyDialogOpen}
        onOpenChange={setConsistencyDialogOpen}
      />
    </>
  );
}

export default function DashboardPage() {
  const { selectedRepository, isLoading: isRepoLoading } = useRepository();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sprintOffset, setSprintOffset] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [evaluationProgress, setEvaluationProgress] = useState<{
    type: "quality" | "consistency" | null;
    evaluated: number;
    remaining: number;
    total: number;
  } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // バッチ評価を実行する関数
  const runBatchEvaluation = useCallback(async (
    type: "quality" | "consistency",
    initialRemaining: number
  ) => {
    if (!selectedRepository) return;

    const total = initialRemaining;
    let totalEvaluated = 0;
    let remaining = initialRemaining;

    setIsEvaluating(true);
    setEvaluationProgress({ type, evaluated: 0, remaining, total });

    while (remaining > 0) {
      try {
        const response = await fetch("/api/evaluations/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoId: selectedRepository.id,
            type,
            limit: 5, // Vercelタイムアウトに収まるよう少なめに
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("Batch evaluation error:", error);
          break;
        }

        const result = await response.json();
        totalEvaluated += result.evaluated;
        remaining = result.remaining;

        setEvaluationProgress({
          type,
          evaluated: totalEvaluated,
          remaining,
          total,
        });

        // レート制限に引っかかった場合は停止
        if (result.errors > 0) {
          console.log("Errors occurred, stopping batch");
          break;
        }

        // 評価した件数が0なら終了（全て完了）
        if (result.evaluated === 0) {
          break;
        }
      } catch (err) {
        console.error("Batch evaluation failed:", err);
        break;
      }
    }

    setIsEvaluating(false);
    setEvaluationProgress(null);

    return totalEvaluated;
  }, [selectedRepository]);

  const fetchData = useCallback(async (skipSync = false) => {
    if (!selectedRepository) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(
        `/api/dashboard/current-sprint?repoId=${selectedRepository.id}&offset=${sprintOffset}${skipSync ? "&skipSync=true" : ""}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch dashboard data");
      }

      setData(result);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }, [sprintOffset, selectedRepository]);

  useEffect(() => {
    if (!isRepoLoading) {
      fetchData();
    }
  }, [fetchData, isRepoLoading]);

  // 手動同期
  const handleSync = async () => {
    if (!selectedRepository) return;

    try {
      setIsSyncing(true);
      setSyncMessage(null);
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId: selectedRepository.id, forceFullSync: false }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "同期に失敗しました");
      }

      setSyncMessage(`同期完了: ${result.stats.synced}件更新`);
      setIsSyncing(false);

      // データを再取得（同期スキップ）
      await fetchData(true);

      // 未評価のIssueがあればバッチ評価を開始
      const pendingEvaluations = result.pendingEvaluations;
      if (pendingEvaluations) {
        // 品質評価を先に実行
        if (pendingEvaluations.quality > 0) {
          setSyncMessage(`品質評価を実行中... (${pendingEvaluations.quality}件)`);
          await runBatchEvaluation("quality", pendingEvaluations.quality);
          await fetchData(true);
        }

        // 次に整合性評価を実行
        if (pendingEvaluations.consistency > 0) {
          setSyncMessage(`整合性評価を実行中... (${pendingEvaluations.consistency}件)`);
          await runBatchEvaluation("consistency", pendingEvaluations.consistency);
          await fetchData(true);
        }

        if (pendingEvaluations.quality > 0 || pendingEvaluations.consistency > 0) {
          setSyncMessage("評価完了");
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
      setSyncMessage(err instanceof Error ? err.message : "同期エラー");
      setIsSyncing(false);
    } finally {
      // 3秒後にメッセージをクリア
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  // スプリントナビゲーション
  const goToPrevSprint = () => setSprintOffset((prev) => prev - 1);
  const goToNextSprint = () => setSprintOffset((prev) => prev + 1);
  const goToCurrentSprint = () => setSprintOffset(0);

  if (isRepoLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
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

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {data.sprint.isCurrent ? "今スプリント" : `Sprint ${data.sprint.number}`}のダッシュボード
          </h1>
          <p className="text-muted-foreground mt-1">
            {data.repository} | Sprint {data.sprint.number} ({data.sprint.period})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing || isEvaluating}
            >
              {isSyncing ? "同期中..." : isEvaluating ? "評価中..." : "GitHub同期"}
            </Button>
            {data.lastSyncAt && (
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(data.lastSyncAt)}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={goToPrevSprint}>
            ← 前のスプリント
          </Button>
          {!data.sprint.isCurrent && (
            <Button variant="outline" size="sm" onClick={goToCurrentSprint}>
              今週に戻る
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextSprint}
            disabled={data.sprint.isCurrent}
          >
            次のスプリント →
          </Button>
        </div>
      </div>

      {/* 同期・評価メッセージ */}
      {(syncMessage || evaluationProgress) && (
        <div className="bg-blue-500/10 text-blue-700 p-3 rounded-md text-sm space-y-2">
          {syncMessage && <div>{syncMessage}</div>}
          {evaluationProgress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>
                  {evaluationProgress.type === "quality" ? "品質評価" : "整合性評価"}
                </span>
                <span>
                  {evaluationProgress.evaluated} / {evaluationProgress.total} 件完了
                </span>
              </div>
              <Progress
                value={(evaluationProgress.evaluated / evaluationProgress.total) * 100}
                className="h-2"
              />
            </div>
          )}
        </div>
      )}

      {/* 全体統計 */}
      <div className="grid gap-4 md:grid-cols-2">
        <OverallStatsCard stats={data.overallStats} title="チーム全体" />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">スプリント情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">スプリント番号</span>
                <span className="font-semibold">Sprint {data.sprint.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">期間</span>
                <span className="font-semibold">{data.sprint.period}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">開始曜日</span>
                <span className="font-semibold">{data.sprint.startDayName}曜日</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">参加メンバー</span>
                <span className="font-semibold">{data.users.length}人</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ユーザー別タブ */}
      {data.users.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>ユーザー別評価</CardTitle>
            <CardDescription>タブを切り替えてユーザーごとの評価を確認</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={data.users[0]?.username} className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                {data.users.map((user) => {
                  const avgGrade = getGradeFromScore(user.averageScore);
                  return (
                    <TabsTrigger
                      key={user.username}
                      value={user.username}
                      className="flex items-center gap-2"
                    >
                      <span>{user.username}</span>
                      {avgGrade && (
                        <Badge className={`${getGradeColor(avgGrade)} text-xs`}>
                          {avgGrade}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {data.users.map((user) => (
                <TabsContent key={user.username} value={user.username}>
                  <div className="space-y-4">
                    {/* ユーザー統計 */}
                    <OverallStatsCard stats={user} title={`${user.username} の評価`} />

                    {/* Issue一覧 */}
                    <div>
                      <h3 className="font-semibold mb-2">Issue一覧</h3>
                      <IssueTable issues={user.issues} />
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            このスプリントにはまだIssueがありません
          </CardContent>
        </Card>
      )}
    </div>
  );
}
