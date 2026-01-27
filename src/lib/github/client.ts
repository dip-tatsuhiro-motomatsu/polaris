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
