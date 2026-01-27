/**
 * 設定関連の型定義
 */

/**
 * リポジトリ設定
 */
export interface RepositoryConfig {
  id: string;
  owner: string;
  repo: string;
  displayName?: string;

  // GitHub PAT（このリポジトリ用）
  githubPat: string;

  // スプリント設定
  sprint: {
    startDayOfWeek: number; // 0-6 (0:日曜, 6:土曜)
    durationWeeks: 1 | 2;   // 1週間 or 2週間
    baseDate: string;       // スプリント計算の基準日 (ISO文字列)
  };

  // 追跡ユーザー名の配列
  trackedUsers: string[];

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * コラボレーター情報（GitHub APIから取得）
 */
export interface Collaborator {
  username: string;
  avatarUrl: string | null;
  isTracked: boolean;
}

/**
 * アプリ全体設定
 */
export interface AppSettings {
  defaultRepositoryId: string | null;
  updatedAt: string;
}

/**
 * 曜日オプション
 */
export const DAY_OF_WEEK_OPTIONS = [
  { value: 0, label: "日曜日" },
  { value: 1, label: "月曜日" },
  { value: 2, label: "火曜日" },
  { value: 3, label: "水曜日" },
  { value: 4, label: "木曜日" },
  { value: 5, label: "金曜日" },
  { value: 6, label: "土曜日" },
] as const;

/**
 * スプリント期間オプション
 */
export const SPRINT_DURATION_OPTIONS = [
  { value: 1, label: "1週間" },
  { value: 2, label: "2週間" },
] as const;

/**
 * 同期メタデータ
 */
export interface SyncMetadata {
  lastSyncAt: string;
  lastSyncSprintNumber: number;
  lastSyncSprintStart: string;
}

/**
 * 品質評価のカテゴリ別スコア（Firestore保存用）
 */
export interface StoredQualityCategoryScore {
  categoryId: string;
  categoryName: string;
  score: number;
  maxScore: number;
  feedback: string;
}

/**
 * Issue品質評価結果（Firestore保存用）
 */
export interface StoredQualityEvaluation {
  totalScore: number;
  grade: "A" | "B" | "C" | "D" | "E";
  categories: StoredQualityCategoryScore[];
  overallFeedback: string;
  improvementSuggestions: string[];
  evaluatedAt: string;
}

/**
 * Firestoreに保存するIssueデータ
 */
export interface StoredIssue {
  number: number;
  title: string;
  body: string | null; // 品質評価用に本文も保存
  state: "open" | "closed";
  createdAt: string;
  closedAt: string | null;

  // 速度評価
  completionHours: number | null;
  grade: "S" | "A" | "B" | "C" | null;  // 速度グレード
  score: number | null;                  // 速度スコア
  message: string | null;                // 速度評価メッセージ

  // 品質評価
  qualityEvaluation: StoredQualityEvaluation | null;

  creator: string;
  assignee: string | null;
  url: string;
  sprintNumber: number;
  isArchived: boolean;
  updatedAt: string;
}
