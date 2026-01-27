"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Repository } from "@/types/repository";

interface RepositoryCardProps {
  repository: Repository;
  onSync?: (id: string) => void;
  onDelete?: (id: string) => void;
  isSyncing?: boolean;
}

export function RepositoryCard({
  repository,
  onSync,
  onDelete,
  isSyncing = false,
}: RepositoryCardProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "未同期";
    return new Date(date).toLocaleString("ja-JP");
  };

  return (
    <Card data-testid="repository-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            <Link
              href={`/repositories/${repository.id}`}
              className="hover:underline"
            >
              {repository.owner}/{repository.name}
            </Link>
          </CardTitle>
          <Link href={repository.url} target="_blank" rel="noopener noreferrer">
            <Badge variant="outline">GitHub</Badge>
          </Link>
        </div>
        <CardDescription>
          最終同期: {formatDate(repository.lastSyncedAt)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Issues:</span>{" "}
            <span className="font-medium">{repository.issueCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">PRs:</span>{" "}
            <span className="font-medium">{repository.prCount}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/repositories/${repository.id}/issues`}>
              Issues
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/repositories/${repository.id}/pull-requests`}>
              PRs
            </Link>
          </Button>
        </div>
        <div className="flex gap-2">
          {onSync && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSync(repository.id)}
              disabled={isSyncing}
            >
              {isSyncing ? "同期中..." : "同期"}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(repository.id)}
            >
              削除
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
