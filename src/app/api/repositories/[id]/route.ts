import { NextRequest, NextResponse } from "next/server";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { SyncMetadataRepository } from "@/infrastructure/repositories/sync-metadata-repository";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

const repositoryRepo = new RepositoryRepository();
const issueRepo = new IssueRepository();
const syncMetadataRepo = new SyncMetadataRepository();

/**
 * GET /api/repositories/[id]
 * リポジトリ詳細を取得
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repositoryId = parseInt(id, 10);

    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "無効なリポジトリIDです", message: "Invalid repository ID" },
        { status: 400 }
      );
    }

    const repository = await repositoryRepo.findById(repositoryId);

    if (!repository) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    // Issue数を取得
    const issues = await issueRepo.findByRepositoryId(repositoryId);
    const issueCount = issues.length;

    // 最終同期日時を取得
    const syncMeta = await syncMetadataRepo.findByRepositoryId(repositoryId);

    return NextResponse.json({
      id: repository.id,
      owner: repository.ownerName,
      name: repository.repoName,
      url: `https://github.com/${repository.ownerName}/${repository.repoName}`,
      lastSyncedAt: syncMeta?.lastSyncAt || null,
      issueCount,
      prCount: 0, // TODO: PR数を取得
      createdAt: repository.createdAt,
      updatedAt: repository.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching repository:", error);
    return NextResponse.json(
      { error: "Failed to fetch repository" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/repositories/[id]
 * リポジトリを削除（カスケード削除によりissues等も削除される）
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repositoryId = parseInt(id, 10);

    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "無効なリポジトリIDです", message: "Invalid repository ID" },
        { status: 400 }
      );
    }

    const repository = await repositoryRepo.findById(repositoryId);

    if (!repository) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    // カスケード削除（DBレベルで設定済み）
    await repositoryRepo.delete(repositoryId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting repository:", error);
    return NextResponse.json(
      { error: "Failed to delete repository" },
      { status: 500 }
    );
  }
}
