"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface Repository {
  id: string;
  owner: string;
  repo: string;
  displayName?: string;
}

interface RepositoryContextType {
  repositories: Repository[];
  selectedRepository: Repository | null;
  isLoading: boolean;
  selectRepository: (id: string) => void;
  refreshRepositories: () => Promise<void>;
}

const RepositoryContext = createContext<RepositoryContextType | undefined>(undefined);

const SELECTED_REPO_KEY = "polaris_selected_repository";

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRepositories = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/settings/repository");
      if (response.ok) {
        const data = await response.json();
        const repos: Repository[] = (data.repositories || []).map((r: {
          id: string;
          owner: string;
          repo: string;
          displayName?: string;
        }) => ({
          id: r.id,
          owner: r.owner,
          repo: r.repo,
          displayName: r.displayName || `${r.owner}/${r.repo}`,
        }));
        setRepositories(repos);

        // 保存されていた選択を復元、またはアクティブなリポジトリを選択
        const savedId = localStorage.getItem(SELECTED_REPO_KEY);
        const savedRepo = repos.find((r) => r.id === savedId);

        if (savedRepo) {
          setSelectedRepository(savedRepo);
        } else if (repos.length > 0) {
          setSelectedRepository(repos[0]);
          localStorage.setItem(SELECTED_REPO_KEY, repos[0].id);
        } else {
          setSelectedRepository(null);
        }
      }
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  const selectRepository = useCallback((id: string) => {
    const repo = repositories.find((r) => r.id === id);
    if (repo) {
      setSelectedRepository(repo);
      localStorage.setItem(SELECTED_REPO_KEY, id);
    }
  }, [repositories]);

  const refreshRepositories = useCallback(async () => {
    await fetchRepositories();
  }, [fetchRepositories]);

  return (
    <RepositoryContext.Provider
      value={{
        repositories,
        selectedRepository,
        isLoading,
        selectRepository,
        refreshRepositories,
      }}
    >
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository() {
  const context = useContext(RepositoryContext);
  if (context === undefined) {
    throw new Error("useRepository must be used within a RepositoryProvider");
  }
  return context;
}
