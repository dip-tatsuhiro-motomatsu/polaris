"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

interface RepositoryFormProps {
  onSubmit: (url: string) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function RepositoryForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: RepositoryFormProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validateUrl = (value: string): boolean => {
    if (!value) {
      setError("URLは必須です");
      return false;
    }
    const match = value.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      setError("有効なGitHub URLを入力してください");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUrl(url)) return;

    try {
      await onSubmit(url);
      setUrl("");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>リポジトリを追加</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="url" className="text-sm font-medium">
              GitHub URL
            </label>
            <Input
              id="url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://github.com/owner/repo"
              disabled={isLoading}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              キャンセル
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "登録中..." : "登録"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
