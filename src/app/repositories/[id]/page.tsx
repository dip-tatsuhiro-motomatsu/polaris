"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Repository } from "@/types/repository";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RepositoryDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [repository, setRepository] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchRepository = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/repositories/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("リポジトリが見つかりません");
        }
        throw new Error("Failed to fetch repository");
      }
      const data = await response.json();
      setRepository(data);
    } catch (err) {
      console.error("Error fetching repository:", err);
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRepository();
  }, [fetchRepository]);

  const handleSync = async (fullSync: boolean = false) => {
    setIsSyncing(true);
    setError(null);
    setSyncMessage(null);

    try {
      const response = await fetch("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: id, fullSync }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync repository");
      }

      const result = await response.json();
      setSyncMessage(
        `同期完了: ${result.issuesSynced}件のIssue、${result.prsSynced}件のPRを同期しました`
      );
      await fetchRepository();
    } catch (err) {
      console.error("Error syncing repository:", err);
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error && !repository) {
    return (
      <div className="space-y-6">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
        <Button asChild variant="outline">
          <Link href="/repositories">リポジトリ一覧に戻る</Link>
        </Button>
      </div>
    );
  }

  if (!repository) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {repository.owner}/{repository.name}
          </h1>
          <Link
            href={repository.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {repository.url}
          </Link>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleSync(false)}
            disabled={isSyncing}
          >
            {isSyncing ? "同期中..." : "同期"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSync(true)}
            disabled={isSyncing}
          >
            全件再同期
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="bg-green-500/10 text-green-700 p-4 rounded-md">
          {syncMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Issue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{repository.issueCount}</p>
            <Button asChild className="mt-4 w-full" variant="outline">
              <Link href={`/repositories/${id}/issues`}>Issue一覧を見る</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pull Request</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{repository.prCount}</p>
            <Button asChild className="mt-4 w-full" variant="outline">
              <Link href={`/repositories/${id}/pull-requests`}>
                PR一覧を見る
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">最終同期</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">
              {repository.lastSyncedAt
                ? new Date(repository.lastSyncedAt).toLocaleString("ja-JP")
                : "未同期"}
            </p>
            {!repository.lastSyncedAt && (
              <Badge variant="warning" className="mt-2">
                同期が必要です
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-start">
        <Button asChild variant="outline">
          <Link href="/repositories">リポジトリ一覧に戻る</Link>
        </Button>
      </div>
    </div>
  );
}
