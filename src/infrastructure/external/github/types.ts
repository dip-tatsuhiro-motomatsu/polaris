/**
 * GitHubクライアント抽象レイヤーの型定義
 * 外部GitHub APIとの接点を抽象化し、依存性注入を可能にする
 */

/**
 * GitHubユーザー情報
 */
export interface GitHubUser {
  id: number;
  login: string;
}

/**
 * GitHubリポジトリ情報
 */
export interface GitHubRepositoryInfo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  private: boolean;
}

/**
 * GitHubコントリビューター
 */
export interface GitHubContributor {
  id: number;
  login: string;
  avatarUrl: string;
  contributions: number;
}

/**
 * GitHub Issue
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  user: GitHubUser | null;
  assignee: GitHubUser | null;
  isPullRequest: boolean;
}

/**
 * GitHub PRブランチ情報
 */
export interface GitHubPRBranch {
  ref: string;
  sha: string;
}

/**
 * GitHub Pull Request
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  user: GitHubUser | null;
  head: GitHubPRBranch;
  base: GitHubPRBranch;
}

/**
 * GitHubクライアントインターフェース
 * GitHub APIを抽象化し、依存性注入を可能にする
 */
export interface IGitHubClient {
  /**
   * リポジトリ情報を取得
   */
  getRepositoryInfo(owner: string, repo: string): Promise<GitHubRepositoryInfo>;

  /**
   * コントリビューター一覧を取得
   */
  getContributors(owner: string, repo: string): Promise<GitHubContributor[]>;

  /**
   * Issue一覧を取得（ページネーション対応）
   * @param since - この日時以降に更新されたIssueのみ取得
   */
  getIssues(owner: string, repo: string, since?: Date): Promise<GitHubIssue[]>;

  /**
   * PR一覧を取得（ページネーション対応）
   * @param since - この日時以降に更新されたPRのみ取得
   */
  getPullRequests(owner: string, repo: string, since?: Date): Promise<GitHubPullRequest[]>;

  /**
   * PRにリンクされたIssue番号を取得（GraphQL API使用）
   */
  getLinkedIssuesForPR(owner: string, repo: string, prNumber: number): Promise<number[]>;
}

/**
 * GitHubクライアントの設定
 */
export interface GitHubClientConfig {
  /** Personal Access Token */
  token: string;
}
