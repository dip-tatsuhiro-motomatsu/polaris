"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IssueTable } from "@/components/dashboard/IssueTable";
import type { Issue } from "@/types/issue";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function IssuesPage({ params }: PageProps) {
  const { id } = use(params);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [total, setTotal] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationMessage, setEvaluationMessage] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/repositories/${id}/issues?state=${filter}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("リポジトリが見つかりません");
        }
        throw new Error("Failed to fetch issues");
      }
      const data = await response.json();
      setIssues(data.issues);
      setTotal(data.total);
    } catch (err) {
      console.error("Error fetching issues:", err);
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, filter]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleEvaluateSpeed = async () => {
    setIsEvaluating(true);
    setEvaluationMessage(null);

    try {
      const response = await fetch("/api/evaluations/speed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: id }),
      });

      if (!response.ok) {
        throw new Error("Failed to evaluate speed");
      }

      const result = await response.json();
      setEvaluationMessage(`${result.evaluated}件のIssueを評価しました`);
      await fetchIssues();
    } catch (err) {
      console.error("Error evaluating speed:", err);
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
        <Button asChild variant="outline">
          <Link href={`/repositories/${id}`}>リポジトリに戻る</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Issues</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleEvaluateSpeed}
            disabled={isEvaluating}
          >
            {isEvaluating ? "評価中..." : "速度を評価"}
          </Button>
          <Button asChild variant="outline">
            <Link href={`/repositories/${id}`}>リポジトリに戻る</Link>
          </Button>
        </div>
      </div>

      {evaluationMessage && (
        <div className="bg-green-500/10 text-green-700 p-4 rounded-md">
          {evaluationMessage}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">フィルタ:</span>
        {(["all", "open", "closed"] as const).map((state) => (
          <Button
            key={state}
            variant={filter === state ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(state)}
          >
            {state === "all" ? "すべて" : state === "open" ? "オープン" : "クローズ"}
          </Button>
        ))}
        <span className="text-sm text-muted-foreground ml-4">
          {total}件
        </span>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : issues.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {filter === "all"
              ? "Issueがありません"
              : filter === "open"
              ? "オープンなIssueがありません"
              : "クローズされたIssueがありません"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            GitHubからデータを同期してください
          </p>
        </div>
      ) : (
        <IssueTable
          issues={issues}
          showSpeedEvaluation={true}
          showQualityEvaluation={false}
        />
      )}
    </div>
  );
}
