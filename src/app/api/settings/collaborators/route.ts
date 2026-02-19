import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import type { Collaborator } from "@/types/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/collaborators
 * リポジトリのコラボレーターを取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner, repo は必須です" },
        { status: 400 }
      );
    }

    const pat = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!pat) {
      return NextResponse.json(
        { error: "GitHub PATが環境変数に設定されていません" },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: pat });

    // コラボレーターを取得
    const collaborators: Collaborator[] = [];

    try {
      // まずコラボレーターを試す
      const { data: collabData } = await octokit.rest.repos.listCollaborators({
        owner,
        repo,
        per_page: 100,
      });

      for (const collab of collabData) {
        collaborators.push({
          username: collab.login,
          avatarUrl: collab.avatar_url,
          isTracked: false,
        });
      }
    } catch (collabError) {
      // コラボレーター取得に失敗した場合（権限不足など）、
      // コントリビューターから取得を試みる
      console.warn("Failed to fetch collaborators, trying contributors:", collabError);

      try {
        const { data: contribData } = await octokit.rest.repos.listContributors({
          owner,
          repo,
          per_page: 100,
        });

        for (const contrib of contribData) {
          if (contrib.login) {
            collaborators.push({
              username: contrib.login,
              avatarUrl: contrib.avatar_url || null,
              isTracked: false,
            });
          }
        }
      } catch (contribError) {
        console.warn("Failed to fetch contributors, trying issue authors:", contribError);

        // それも失敗した場合、Issueの作成者から取得
        const { data: issues } = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state: "all",
          per_page: 100,
        });

        const userMap = new Map<string, Collaborator>();
        for (const issue of issues) {
          if (issue.user && !userMap.has(issue.user.login)) {
            userMap.set(issue.user.login, {
              username: issue.user.login,
              avatarUrl: issue.user.avatar_url,
              isTracked: false,
            });
          }
        }
        collaborators.push(...Array.from(userMap.values()));
      }
    }

    // ユーザー名でソート
    collaborators.sort((a, b) => a.username.localeCompare(b.username));

    return NextResponse.json({
      collaborators,
      count: collaborators.length,
    });
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    return NextResponse.json(
      { error: "コラボレーターの取得に失敗しました。PATとリポジトリ情報を確認してください。" },
      { status: 500 }
    );
  }
}
