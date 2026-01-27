"use client";

import { useState, useEffect, useCallback } from "react";
import type { Repository } from "@/types/repository";

interface UseRepositoryResult {
  repository: Repository | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseRepositoriesResult {
  repositories: Repository[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (url: string) => Promise<Repository>;
  remove: (id: string) => Promise<void>;
}

/**
 * 単一リポジトリを取得するフック
 */
export function useRepository(id: string): UseRepositoryResult {
  const [repository, setRepository] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRepository = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
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
    if (id) {
      fetchRepository();
    }
  }, [id, fetchRepository]);

  return {
    repository,
    isLoading,
    error,
    refetch: fetchRepository,
  };
}

/**
 * リポジトリ一覧を取得するフック
 */
export function useRepositories(): UseRepositoriesResult {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRepositories = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/repositories");
      if (!response.ok) {
        throw new Error("Failed to fetch repositories");
      }
      const data = await response.json();
      setRepositories(data.repositories);
    } catch (err) {
      console.error("Error fetching repositories:", err);
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  const create = useCallback(async (url: string): Promise<Repository> => {
    const response = await fetch("/api/repositories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to create repository");
    }

    const repository = await response.json();
    setRepositories((prev) => [repository, ...prev]);
    return repository;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/repositories/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete repository");
    }

    setRepositories((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    repositories,
    isLoading,
    error,
    refetch: fetchRepositories,
    create,
    remove,
  };
}

/**
 * リポジトリ同期フック
 */
export function useRepositorySync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    issuesSynced: number;
    prsSynced: number;
    isFullSync: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(
    async (repositoryId: string, fullSync: boolean = false) => {
      try {
        setIsSyncing(true);
        setError(null);
        setSyncResult(null);

        const response = await fetch("/api/github/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repositoryId, fullSync }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to sync repository");
        }

        const result = await response.json();
        setSyncResult(result);
        return result;
      } catch (err) {
        console.error("Error syncing repository:", err);
        if (err instanceof Error) {
          setError(err.message);
        }
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  return {
    sync,
    isSyncing,
    syncResult,
    error,
  };
}
