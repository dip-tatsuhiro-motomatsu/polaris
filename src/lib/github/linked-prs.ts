/**
 * GitHub APIを使用してIssueにリンクされたPRを取得する機能
 */

import { Octokit } from "@octokit/rest";
import type { LinkedPR } from "@/types/evaluation";

/**
 * IssueにリンクされたPRを取得
 * - タイムラインイベントから "cross-referenced" イベントを探す
 * - PR本文に "Closes #123", "Fixes #123" などがあるものを検出
 */
export async function getLinkedPRsForIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<LinkedPR[]> {
  const linkedPRs: LinkedPR[] = [];

  try {
    // タイムラインイベントを取得してクロスリファレンスを探す
    const { data: events } = await octokit.rest.issues.listEventsForTimeline({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    // クロスリファレンスイベントからPRを抽出
    const prNumbers = new Set<number>();

    for (const event of events) {
      // cross-referenced イベント（PRからIssueが参照された場合）
      if (event.event === "cross-referenced") {
        const crossRefEvent = event as {
          source?: {
            issue?: {
              number: number;
              pull_request?: { url: string };
            };
          };
        };

        if (crossRefEvent.source?.issue?.pull_request) {
          prNumbers.add(crossRefEvent.source.issue.number);
        }
      }

      // connected イベント（PRがIssueにリンクされた場合）
      if (event.event === "connected") {
        // connectedイベントには直接PR番号が含まれないことがあるため、
        // 別途PRを検索する必要がある場合がある
      }
    }

    // 各PRの詳細情報を取得
    for (const prNumber of Array.from(prNumbers)) {
      try {
        const prInfo = await getPRDetails(octokit, owner, repo, prNumber);
        if (prInfo) {
          // クロスリファレンスされていれば関連PRとして扱う
          // （PRの本文にCloses/Fixes等のキーワードがなくても追加）
          linkedPRs.push(prInfo);
        }
      } catch (error) {
        console.error(`Failed to get PR #${prNumber} details:`, error);
      }
    }

    return linkedPRs;
  } catch (error) {
    console.error(`Failed to get linked PRs for issue #${issueNumber}:`, error);
    return [];
  }
}

/**
 * PRの詳細情報を取得（diff含む）
 */
async function getPRDetails(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<LinkedPR | null> {
  try {
    // PR基本情報を取得
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // マージされていないPRはスキップ
    if (!pr.merged_at) {
      return null;
    }

    // 変更ファイル一覧を取得
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    // diffの概要を生成（全体のdiffは大きすぎるため、ファイルごとの変更概要を作成）
    const diffSummary = files
      .map((file) => {
        const status = file.status === "added" ? "[新規]" :
                       file.status === "removed" ? "[削除]" :
                       file.status === "renamed" ? "[名前変更]" : "[変更]";
        return `${status} ${file.filename} (+${file.additions}/-${file.deletions})`;
      })
      .join("\n");

    // パッチ情報を含める（ただし長すぎる場合は切り詰め）
    const maxPatchLength = 5000; // トークン数を抑えるため
    let fullPatch = files
      .filter((file) => file.patch) // パッチがあるファイルのみ
      .map((file) => `--- ${file.filename} ---\n${file.patch}`)
      .join("\n\n");

    if (fullPatch.length > maxPatchLength) {
      fullPatch = fullPatch.substring(0, maxPatchLength) + "\n... (省略)";
    }

    return {
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      body: pr.body,
      diff: fullPatch || diffSummary,
      changedFiles: files.map((f) => f.filename),
      additions: pr.additions,
      deletions: pr.deletions,
      mergedAt: pr.merged_at,
    };
  } catch (error) {
    console.error(`Failed to get PR #${prNumber} details:`, error);
    return null;
  }
}

/**
 * クローズされたIssueに対してリンクされたマージ済みPRがあるかチェック
 */
export async function hasLinkedMergedPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<boolean> {
  const linkedPRs = await getLinkedPRsForIssue(octokit, owner, repo, issueNumber);
  return linkedPRs.length > 0;
}
