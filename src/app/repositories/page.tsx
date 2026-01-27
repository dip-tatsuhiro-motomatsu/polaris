"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RepositoryForm } from "@/components/forms/RepositoryForm";
import { RepositoryCard } from "@/components/dashboard/RepositoryCard";
import type { Repository } from "@/types/repository";

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRepositories = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/repositories");
      if (!response.ok) throw new Error("Failed to fetch repositories");
      const data = await response.json();
      setRepositories(data.repositories);
    } catch (err) {
      console.error("Error fetching repositories:", err);
      setError("リポジトリの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  const handleSubmit = async (url: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create repository");
      }

      setShowForm(false);
      await fetchRepositories();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
        throw err;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    setError(null);

    try {
      const response = await fetch("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync repository");
      }

      await fetchRepositories();
    } catch (err) {
      console.error("Error syncing repository:", err);
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このリポジトリを削除しますか？")) return;

    try {
      const response = await fetch(`/api/repositories/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete repository");
      }

      await fetchRepositories();
    } catch (err) {
      console.error("Error deleting repository:", err);
      setError("リポジトリの削除に失敗しました");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">リポジトリ</h1>
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">リポジトリ</h1>
        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          リポジトリを追加
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
      )}

      {showForm && (
        <RepositoryForm
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          isLoading={isSubmitting}
        />
      )}

      {repositories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            リポジトリが登録されていません
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            「リポジトリを追加」ボタンからGitHubリポジトリを登録してください
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {repositories.map((repo) => (
            <RepositoryCard
              key={repo.id}
              repository={repo}
              onSync={handleSync}
              onDelete={handleDelete}
              isSyncing={syncingId === repo.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
