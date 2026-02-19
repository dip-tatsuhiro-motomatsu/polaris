import { NextRequest, NextResponse } from "next/server";
import { SyncIssuesUseCase } from "@/application/use-cases/sync-issues";
import { SyncPullRequestsUseCase } from "@/application/use-cases/sync-pull-requests";

export const dynamic = "force-dynamic";

/**
 * POST /api/repositories/[id]/sync
 * GitHubからIssue・PRを同期
 */
export async function POST(
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

    // リクエストボディからsinceを取得（オプション）
    let since: Date | undefined;
    try {
      const body = await request.json();
      if (body.since) {
        since = new Date(body.since);
      }
    } catch {
      // bodyが空の場合は無視
    }

    // Issue同期
    const syncIssuesUseCase = new SyncIssuesUseCase();
    const issuesResult = await syncIssuesUseCase.execute({
      repositoryId,
      since,
    });

    // PR同期
    const syncPRsUseCase = new SyncPullRequestsUseCase();
    const prsResult = await syncPRsUseCase.execute({
      repositoryId,
      since,
    });

    return NextResponse.json({
      issuesSynced: issuesResult.success ? issuesResult.syncedCount : 0,
      issuesError: issuesResult.success ? undefined : issuesResult.error,
      prsSynced: prsResult.success ? prsResult.syncedCount : 0,
      prsError: prsResult.success ? undefined : prsResult.error,
    });
  } catch (error) {
    console.error("Error syncing repository:", error);
    return NextResponse.json(
      { error: "同期に失敗しました" },
      { status: 500 }
    );
  }
}
