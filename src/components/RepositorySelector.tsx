"use client";

import { useRepository } from "@/contexts/RepositoryContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import Link from "next/link";
import { Plus } from "lucide-react";

export function RepositorySelector() {
  const { repositories, selectedRepository, isLoading, selectRepository } = useRepository();

  if (isLoading) {
    return (
      <div className="w-48 h-9 bg-muted animate-pulse rounded-md" />
    );
  }

  if (repositories.length === 0) {
    return (
      <Link
        href="/settings"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        リポジトリを追加
      </Link>
    );
  }

  return (
    <Select
      value={selectedRepository?.id || ""}
      onValueChange={(value) => {
        if (value === "__add__") {
          window.location.href = "/settings?action=add";
        } else {
          selectRepository(value);
        }
      }}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder="リポジトリを選択">
          {selectedRepository ? (
            <span className="truncate">
              {selectedRepository.owner}/{selectedRepository.repo}
            </span>
          ) : (
            "リポジトリを選択"
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {repositories.map((repo) => (
          <SelectItem key={repo.id} value={repo.id}>
            <span className="truncate">{repo.owner}/{repo.repo}</span>
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value="__add__" className="text-muted-foreground">
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            リポジトリを追加
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
