import { Octokit } from "@octokit/rest";
import type { ParsedGitHubUrl } from "@/types/github";

let octokitInstance: Octokit | null = null;

/**
 * Octokitクライアントを取得
 * シングルトンパターンで管理
 */
export function getOctokit(): Octokit {
  if (!octokitInstance) {
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!token) {
      throw new Error("GITHUB_PERSONAL_ACCESS_TOKEN is not set");
    }
    octokitInstance = new Octokit({ auth: token });
  }
  return octokitInstance;
}

/**
 * 新しいOctokitクライアントを作成（トークン指定）
 */
export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

/**
 * GitHub URLをパース
 * @param url - GitHub リポジトリURL (例: https://github.com/owner/repo)
 * @returns パースされたowner/repo、無効な場合はnull
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");

  if (!owner || !repo) return null;

  return { owner, repo };
}

/**
 * GitHub URLのバリデーション
 */
export function validateGitHubUrl(url: string): boolean {
  const parsed = parseGitHubUrl(url);
  return parsed !== null && parsed.owner.length > 0 && parsed.repo.length > 0;
}

/**
 * GitHubリポジトリ情報を取得
 */
export async function getRepositoryInfo(owner: string, repo: string) {
  const octokit = getOctokit();
  const response = await octokit.rest.repos.get({ owner, repo });
  return response.data;
}

/**
 * GitHubリポジトリのコントリビューター一覧を取得
 */
export async function getContributors(owner: string, repo: string) {
  const octokit = getOctokit();
  const response = await octokit.rest.repos.listContributors({
    owner,
    repo,
    per_page: 100,
  });
  return response.data;
}

/**
 * GitHubリポジトリのIssue一覧を取得（ページネーション対応）
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param since - この日時以降に更新されたIssueのみ取得（オプション）
 */
export async function getIssues(owner: string, repo: string, since?: Date) {
  const octokit = getOctokit();
  const allIssues: Awaited<ReturnType<typeof octokit.rest.issues.listForRepo>>["data"] = [];

  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: perPage,
      page,
      since: since?.toISOString(),
    });

    allIssues.push(...response.data);

    if (response.data.length < perPage) break;
    page++;
  }

  return allIssues;
}

/**
 * GitHubリポジトリのPullRequest一覧を取得（ページネーション対応）
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param since - この日時以降に更新されたPRのみ取得（オプション）
 */
export async function getPullRequests(owner: string, repo: string, since?: Date) {
  const octokit = getOctokit();
  const allPRs: Awaited<ReturnType<typeof octokit.rest.pulls.list>>["data"] = [];

  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: perPage,
      page,
    });

    // sinceが指定されている場合、それ以降のPRのみフィルタリング
    const filtered = since
      ? response.data.filter((pr) => new Date(pr.updated_at) >= since)
      : response.data;

    allPRs.push(...filtered);

    // sinceでフィルタリングした結果が空、またはページネーション終了
    if (response.data.length < perPage || (since && filtered.length < response.data.length)) {
      break;
    }
    page++;
  }

  return allPRs;
}

/**
 * GitHubリポジトリのIssue作成日の範囲を取得
 * 追跡開始日の基準として使用
 */
export async function getIssuesDateRange(owner: string, repo: string) {
  const octokit = getOctokit();

  // 最初のIssue（oldest）
  const oldestResponse = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: "all",
    sort: "created",
    direction: "asc",
    per_page: 1,
  });

  // 最新のIssue
  const newestResponse = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: "all",
    sort: "created",
    direction: "desc",
    per_page: 1,
  });

  const oldest = oldestResponse.data.filter((i) => !i.pull_request)[0];
  const newest = newestResponse.data.filter((i) => !i.pull_request)[0];

  return {
    oldestIssueDate: oldest?.created_at ?? null,
    newestIssueDate: newest?.created_at ?? null,
    totalIssues: oldestResponse.data.length > 0 ? "1+" : "0",
  };
}
