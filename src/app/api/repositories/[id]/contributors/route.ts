import { NextRequest, NextResponse } from "next/server";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { getContributors, getIssuesDateRange } from "@/lib/github/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/repositories/[id]/contributors
 * GitHubからコントリビューター一覧を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const repositoryId = parseInt(id, 10);

    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "無効なリポジトリIDです" },
        { status: 400 }
      );
    }

    const repositoryRepository = new RepositoryRepository();
    const repository = await repositoryRepository.findById(repositoryId);

    if (!repository) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません" },
        { status: 404 }
      );
    }

    // GitHubからコントリビューター一覧を取得
    const contributors = await getContributors(
      repository.ownerName,
      repository.repoName
    );

    // Issue作成日の範囲も取得（追跡開始日の基準として）
    const issuesDateRange = await getIssuesDateRange(
      repository.ownerName,
      repository.repoName
    );

    return NextResponse.json({
      contributors: contributors.map((c) => ({
        login: c.login,
        avatarUrl: c.avatar_url,
        contributions: c.contributions,
      })),
      issuesDateRange,
    });
  } catch (error) {
    console.error("Error fetching contributors:", error);
    return NextResponse.json(
      { error: "コントリビューターの取得に失敗しました" },
      { status: 500 }
    );
  }
}
