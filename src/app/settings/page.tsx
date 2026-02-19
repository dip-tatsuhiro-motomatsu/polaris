"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DAY_OF_WEEK_OPTIONS,
  SPRINT_DURATION_OPTIONS,
  type RepositoryConfig,
  type Collaborator,
} from "@/types/settings";
import { useRepository } from "@/contexts/RepositoryContext";
import { Trash2, Edit, Plus } from "lucide-react";

type ViewMode = "list" | "add" | "edit";

function SettingsContent() {
  const searchParams = useSearchParams();
  const { repositories, selectedRepository, refreshRepositories, selectRepository } = useRepository();

  // 表示モード
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingRepoId, setEditingRepoId] = useState<string | null>(null);

  // フォーム状態
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [startDayOfWeek, setStartDayOfWeek] = useState<number>(6);
  const [durationWeeks, setDurationWeeks] = useState<1 | 2>(1);
  const [trackedUsers, setTrackedUsers] = useState<string[]>([]);

  // 状態管理
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // URLパラメータでaction=addの場合、追加モードに
  useEffect(() => {
    if (searchParams.get("action") === "add") {
      resetForm();
      setViewMode("add");
    }
  }, [searchParams]);

  // フォームリセット
  const resetForm = () => {
    setOwner("");
    setRepo("");
    setStartDayOfWeek(6);
    setDurationWeeks(1);
    setTrackedUsers([]);
    setCollaborators([]);
    setEditingRepoId(null);
    setMessage(null);
  };

  // 編集モードに切り替え
  const startEdit = (repoConfig: RepositoryConfig) => {
    setOwner(repoConfig.owner);
    setRepo(repoConfig.repo);
    setStartDayOfWeek(repoConfig.sprint.startDayOfWeek);
    setDurationWeeks(repoConfig.sprint.durationWeeks);
    setTrackedUsers(repoConfig.trackedUsers || []);
    setEditingRepoId(repoConfig.id);
    setCollaborators([]);
    setViewMode("edit");
    setMessage(null);
  };

  // リストに戻る
  const goBackToList = () => {
    resetForm();
    setViewMode("list");
  };

  // コラボレーター取得
  const fetchCollaborators = async () => {
    if (!owner || !repo) {
      setMessage({ type: "error", text: "オーナーとリポジトリを入力してください" });
      return;
    }

    setIsLoadingCollaborators(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/settings/collaborators?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "コラボレーター取得に失敗しました");
      }

      const data = await response.json();

      // 既存のtrackedUsersを反映
      const collabs = data.collaborators.map((c: Collaborator) => ({
        ...c,
        isTracked: trackedUsers.includes(c.username),
      }));

      setCollaborators(collabs);
      setMessage({ type: "success", text: `${data.count}人のユーザーを取得しました` });
    } catch (error) {
      console.error("Failed to fetch collaborators:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "コラボレーター取得に失敗しました",
      });
    } finally {
      setIsLoadingCollaborators(false);
    }
  };

  // ユーザー選択の切り替え
  const toggleUser = (username: string) => {
    setTrackedUsers((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username]
    );

    setCollaborators((prev) =>
      prev.map((c) =>
        c.username === username ? { ...c, isTracked: !c.isTracked } : c
      )
    );
  };

  // 全選択/全解除
  const toggleAllUsers = (selectAll: boolean) => {
    if (selectAll) {
      const allUsernames = collaborators.map((c) => c.username);
      setTrackedUsers(allUsernames);
      setCollaborators((prev) =>
        prev.map((c) => ({ ...c, isTracked: true }))
      );
    } else {
      setTrackedUsers([]);
      setCollaborators((prev) =>
        prev.map((c) => ({ ...c, isTracked: false }))
      );
    }
  };

  // 設定保存
  const saveSettings = async () => {
    if (!owner || !repo) {
      setMessage({ type: "error", text: "オーナーとリポジトリは必須です" });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/repository", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingRepoId,
          owner,
          repo,
          sprint: {
            startDayOfWeek,
            durationWeeks,
            baseDate: new Date().toISOString(),
          },
          trackedUsers,
          isActive: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "保存に失敗しました");
      }

      const data = await response.json();
      setMessage({ type: "success", text: data.message });

      // リポジトリ一覧を更新
      await refreshRepositories();

      // 新規追加の場合、追加したリポジトリを選択
      if (!editingRepoId && data.id) {
        selectRepository(data.id);
      }

      // 少し待ってからリストに戻る
      setTimeout(() => {
        goBackToList();
      }, 1000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存に失敗しました",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // リポジトリ削除
  const deleteRepository = async (repoId: string) => {
    if (!confirm("このリポジトリを削除しますか？関連するすべてのデータが削除されます。")) {
      return;
    }

    setIsDeleting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/settings/repository?id=${repoId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "削除に失敗しました");
      }

      setMessage({ type: "success", text: "リポジトリを削除しました" });

      // リポジトリ一覧を更新
      await refreshRepositories();
    } catch (error) {
      console.error("Failed to delete repository:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "削除に失敗しました",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // リスト表示
  if (viewMode === "list") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">設定</h1>
            <p className="text-muted-foreground mt-1">
              リポジトリとスプリントの設定を管理します
            </p>
          </div>
          <Button onClick={() => { resetForm(); setViewMode("add"); }}>
            <Plus className="h-4 w-4 mr-2" />
            リポジトリを追加
          </Button>
        </div>

        {message && (
          <div
            className={`p-4 rounded-md ${
              message.type === "success"
                ? "bg-green-500/10 text-green-700"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* リポジトリ一覧 */}
        <Card>
          <CardHeader>
            <CardTitle>登録済みリポジトリ</CardTitle>
            <CardDescription>
              管理しているリポジトリの一覧
            </CardDescription>
          </CardHeader>
          <CardContent>
            {repositories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                リポジトリが登録されていません。<br />
                「リポジトリを追加」ボタンから追加してください。
              </div>
            ) : (
              <div className="space-y-3">
                {repositories.map((repoItem) => (
                  <div
                    key={repoItem.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      selectedRepository?.id === repoItem.id ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div>
                      <div className="font-medium">{repoItem.owner}/{repoItem.repo}</div>
                      {selectedRepository?.id === repoItem.id && (
                        <div className="text-xs text-muted-foreground">選択中</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // 詳細を取得して編集モードへ
                          fetch(`/api/settings/repository`)
                            .then((res) => res.json())
                            .then((data) => {
                              const config = data.repositories.find(
                                (r: RepositoryConfig) => r.id === repoItem.id
                              );
                              if (config) {
                                startEdit(config);
                              }
                            });
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteRepository(repoItem.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // 追加/編集フォーム
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {viewMode === "add" ? "リポジトリを追加" : "リポジトリを編集"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {viewMode === "add"
              ? "新しいリポジトリを追加します"
              : `${owner}/${repo} の設定を編集します`}
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md ${
            message.type === "success"
              ? "bg-green-500/10 text-green-700"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* GitHub設定 */}
      <Card>
        <CardHeader>
          <CardTitle>GitHub設定</CardTitle>
          <CardDescription>
            対象リポジトリを設定
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">オーナー</label>
              <Input
                placeholder="owner_name"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">リポジトリ</label>
              <Input
                placeholder="repository_name"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* スプリント設定 */}
      <Card>
        <CardHeader>
          <CardTitle>スプリント設定</CardTitle>
          <CardDescription>
            スプリントの開始曜日と期間を設定
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">開始曜日</label>
              <Select
                value={startDayOfWeek.toString()}
                onValueChange={(value) => setStartDayOfWeek(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="曜日を選択" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OF_WEEK_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">スプリント期間</label>
              <Select
                value={durationWeeks.toString()}
                onValueChange={(value) => setDurationWeeks(parseInt(value) as 1 | 2)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="期間を選択" />
                </SelectTrigger>
                <SelectContent>
                  {SPRINT_DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ユーザー選択 */}
      <Card>
        <CardHeader>
          <CardTitle>追跡ユーザー</CardTitle>
          <CardDescription>
            履歴を追跡するユーザーを選択
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            onClick={fetchCollaborators}
            disabled={isLoadingCollaborators}
          >
            {isLoadingCollaborators ? "取得中..." : "コラボレーターを取得"}
          </Button>

          {collaborators.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAllUsers(true)}
                >
                  全選択
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAllUsers(false)}
                >
                  全解除
                </Button>
                <span className="text-muted-foreground">
                  {trackedUsers.length}/{collaborators.length} 選択中
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-md p-4">
                {collaborators.map((collab) => (
                  <div
                    key={collab.username}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => toggleUser(collab.username)}
                  >
                    <Checkbox
                      checked={trackedUsers.includes(collab.username)}
                      onCheckedChange={() => toggleUser(collab.username)}
                    />
                    {collab.avatarUrl && (
                      <img
                        src={collab.avatarUrl}
                        alt={collab.username}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="text-sm">{collab.username}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {collaborators.length === 0 && trackedUsers.length > 0 && (
            <div className="text-sm text-muted-foreground">
              選択済みユーザー: {trackedUsers.join(", ")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ボタン */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={goBackToList}>
          キャンセル
        </Button>
        <Button onClick={saveSettings} disabled={isSaving}>
          {isSaving ? "保存中..." : viewMode === "add" ? "追加" : "保存"}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div></div>}>
      <SettingsContent />
    </Suspense>
  );
}
