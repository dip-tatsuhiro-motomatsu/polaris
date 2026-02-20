/**
 * Octokitを使用したGitHubクライアント実装
 */

import { Octokit } from "@octokit/rest";
import type {
  IGitHubClient,
  GitHubRepositoryInfo,
  GitHubContributor,
  GitHubIssue,
  GitHubPullRequest,
  GitHubClientConfig,
} from "./types";

/**
 * Octokitを使用したGitHubクライアント実装
 */
export class OctokitGitHubClient implements IGitHubClient {
  private octokit: Octokit;

  constructor(config?: GitHubClientConfig) {
    const token = config?.token ?? process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!token) {
      throw new Error("GitHub token is required. Set GITHUB_PERSONAL_ACCESS_TOKEN or pass token in config.");
    }
    this.octokit = new Octokit({ auth: token });
  }

  /**
   * リポジトリ情報を取得
   */
  async getRepositoryInfo(owner: string, repo: string): Promise<GitHubRepositoryInfo> {
    const response = await this.octokit.rest.repos.get({ owner, repo });
    const data = response.data;

    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      private: data.private,
    };
  }

  /**
   * コントリビューター一覧を取得
   */
  async getContributors(owner: string, repo: string): Promise<GitHubContributor[]> {
    const response = await this.octokit.rest.repos.listContributors({
      owner,
      repo,
      per_page: 100,
    });

    return response.data.map((contributor) => ({
      id: contributor.id ?? 0,
      login: contributor.login ?? "",
      avatarUrl: contributor.avatar_url ?? "",
      contributions: contributor.contributions ?? 0,
    }));
  }

  /**
   * Issue一覧を取得（ページネーション対応）
   */
  async getIssues(owner: string, repo: string, since?: Date): Promise<GitHubIssue[]> {
    const allIssues: GitHubIssue[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: "all",
        sort: "updated",
        direction: "desc",
        per_page: perPage,
        page,
        since: since?.toISOString(),
      });

      const issues = response.data.map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        state: issue.state as "open" | "closed",
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        user: issue.user ? { id: issue.user.id, login: issue.user.login } : null,
        assignee: issue.assignee ? { id: issue.assignee.id, login: issue.assignee.login } : null,
        isPullRequest: !!issue.pull_request,
      }));

      allIssues.push(...issues);

      if (response.data.length < perPage) break;
      page++;
    }

    return allIssues;
  }

  /**
   * PR一覧を取得（ページネーション対応）
   */
  async getPullRequests(owner: string, repo: string, since?: Date): Promise<GitHubPullRequest[]> {
    const allPRs: GitHubPullRequest[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: "all",
        sort: "updated",
        direction: "desc",
        per_page: perPage,
        page,
      });

      const prs = response.data
        .filter((pr) => !since || new Date(pr.updated_at) >= since)
        .map((pr) => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          body: pr.body ?? null,
          state: pr.state as "open" | "closed",
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          mergedAt: pr.merged_at,
          closedAt: pr.closed_at,
          user: pr.user ? { id: pr.user.id, login: pr.user.login } : null,
          head: { ref: pr.head.ref, sha: pr.head.sha },
          base: { ref: pr.base.ref, sha: pr.base.sha },
        }));

      allPRs.push(...prs);

      // sinceでフィルタリングした結果が元より少ない、またはページネーション終了
      if (response.data.length < perPage || (since && prs.length < response.data.length)) {
        break;
      }
      page++;
    }

    return allPRs;
  }

  /**
   * PRにリンクされたIssue番号を取得（GraphQL API使用）
   */
  async getLinkedIssuesForPR(owner: string, repo: string, prNumber: number): Promise<number[]> {
    const query = `
      query($owner: String!, $repo: String!, $pr: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $pr) {
            closingIssuesReferences(first: 10) {
              nodes {
                number
              }
            }
          }
        }
      }
    `;

    interface GraphQLResponse {
      repository: {
        pullRequest: {
          closingIssuesReferences: {
            nodes: Array<{ number: number }>;
          };
        };
      };
    }

    const result = await this.octokit.graphql<GraphQLResponse>(query, {
      owner,
      repo,
      pr: prNumber,
    });

    return result.repository.pullRequest.closingIssuesReferences.nodes.map(
      (node) => node.number
    );
  }
}

/**
 * GitHubクライアントのシングルトンインスタンス
 */
let gitHubClientInstance: IGitHubClient | null = null;

/**
 * GitHubクライアントを取得（シングルトン）
 */
export function getGitHubClient(): IGitHubClient {
  if (!gitHubClientInstance) {
    gitHubClientInstance = new OctokitGitHubClient();
  }
  return gitHubClientInstance;
}

/**
 * GitHubクライアントを設定（テスト用）
 */
export function setGitHubClient(client: IGitHubClient): void {
  gitHubClientInstance = client;
}

/**
 * GitHubクライアントをリセット（テスト用）
 */
export function resetGitHubClient(): void {
  gitHubClientInstance = null;
}
