import { getOctokit } from "./client";
import type {
  GitHubIssue,
  GitHubPullRequest,
  SyncResult,
} from "@/types/github";
import type { Issue } from "@/types/issue";
import type { PullRequest } from "@/types/pull-request";

/**
 * GitHubのIssueをアプリ内Issue型に変換
 */
export function convertGitHubIssueToIssue(
  ghIssue: GitHubIssue
): Omit<Issue, "id"> {
  return {
    number: ghIssue.number,
    title: ghIssue.title,
    body: ghIssue.body || "",
    state: ghIssue.state,
    createdAt: new Date(ghIssue.created_at),
    closedAt: ghIssue.closed_at ? new Date(ghIssue.closed_at) : null,
    assignee: ghIssue.assignee?.login || null,
    labels: ghIssue.labels.map((l) => l.name),
    githubId: ghIssue.id,
    speedEvaluation: null,
    qualityEvaluation: null,
    syncedAt: new Date(),
  };
}

/**
 * GitHubのPRをアプリ内PullRequest型に変換
 */
export function convertGitHubPRToPullRequest(
  ghPR: GitHubPullRequest
): Omit<PullRequest, "id"> {
  const linkedIssueNumbers = extractLinkedIssueNumbers(ghPR.body || "");

  return {
    number: ghPR.number,
    title: ghPR.title,
    body: ghPR.body || "",
    state: ghPR.merged_at ? "merged" : ghPR.state,
    linkedIssueNumbers,
    githubId: ghPR.id,
    consistencyEvaluation: null,
    createdAt: new Date(ghPR.created_at),
    mergedAt: ghPR.merged_at ? new Date(ghPR.merged_at) : null,
    closedAt: ghPR.closed_at ? new Date(ghPR.closed_at) : null,
    author: ghPR.user?.login || null,
    syncedAt: new Date(),
  };
}

/**
 * PR本文からリンクされたIssue番号を抽出
 */
export function extractLinkedIssueNumbers(body: string): number[] {
  const patterns = [
    /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi,
    /#(\d+)/g,
  ];

  const numbers = new Set<number>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      numbers.add(parseInt(match[1], 10));
    }
  }

  return Array.from(numbers);
}

/**
 * GitHubからIssueを取得
 * @param owner リポジトリオーナー
 * @param repo リポジトリ名
 * @param since 差分同期の基準日時（省略時は全件取得）
 */
export async function fetchIssues(
  owner: string,
  repo: string,
  since?: Date
): Promise<Omit<Issue, "id">[]> {
  const octokit = getOctokit();
  const issues: Omit<Issue, "id">[] = [];

  // ページネーション対応で全件取得
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "all",
      per_page: perPage,
      page,
      sort: "updated",
      direction: "desc",
      ...(since && { since: since.toISOString() }),
    });

    // PRを除外（GitHubのissues APIはPRも含む）
    const issueData = response.data.filter(
      (item) => !item.pull_request
    ) as GitHubIssue[];

    issues.push(...issueData.map(convertGitHubIssueToIssue));

    // 次のページがない場合は終了
    if (response.data.length < perPage) {
      break;
    }

    page++;
  }

  return issues;
}

/**
 * GitHubからPull Requestを取得
 * @param owner リポジトリオーナー
 * @param repo リポジトリ名
 * @param since 差分同期の基準日時（省略時は全件取得）
 */
export async function fetchPullRequests(
  owner: string,
  repo: string,
  since?: Date
): Promise<Omit<PullRequest, "id">[]> {
  const octokit = getOctokit();
  const pullRequests: Omit<PullRequest, "id">[] = [];

  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      per_page: perPage,
      page,
      sort: "updated",
      direction: "desc",
    });

    // sinceでフィルタリング（PRにはsinceパラメータがないため手動で）
    let prData = response.data as GitHubPullRequest[];

    if (since) {
      prData = prData.filter(
        (pr) => new Date(pr.updated_at) >= since
      );
    }

    pullRequests.push(...prData.map(convertGitHubPRToPullRequest));

    // 次のページがない場合は終了
    if (response.data.length < perPage) {
      break;
    }

    // since指定時、古いPRは取得しない
    if (since && prData.length < response.data.length) {
      break;
    }

    page++;
  }

  return pullRequests;
}

/**
 * リポジトリの同期を実行
 */
export async function syncRepository(
  owner: string,
  repo: string,
  lastSyncedAt: Date | null,
  fullSync: boolean = false
): Promise<{
  issues: Omit<Issue, "id">[];
  pullRequests: Omit<PullRequest, "id">[];
  result: SyncResult;
}> {
  const since = fullSync ? undefined : lastSyncedAt || undefined;
  const isFullSync = !since;

  const [issues, pullRequests] = await Promise.all([
    fetchIssues(owner, repo, since),
    fetchPullRequests(owner, repo, since),
  ]);

  const result: SyncResult = {
    issuesSynced: issues.length,
    prsSynced: pullRequests.length,
    isFullSync,
    lastSyncedAt: new Date(),
  };

  return { issues, pullRequests, result };
}
