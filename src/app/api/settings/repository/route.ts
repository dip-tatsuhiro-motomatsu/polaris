import { NextRequest, NextResponse } from "next/server";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { TrackedCollaboratorRepository } from "@/infrastructure/repositories/tracked-collaborator-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import type { NewRepository } from "@/infrastructure/database/schema";

export const dynamic = "force-dynamic";

const repositoryRepo = new RepositoryRepository();
const trackedCollaboratorRepo = new TrackedCollaboratorRepository();
const collaboratorRepo = new CollaboratorRepository();

/**
 * GET /api/settings/repository
 * リポジトリ設定を取得
 */
export async function GET() {
  try {
    const allRepositories = await repositoryRepo.findAll();

    const repositories = await Promise.all(
      allRepositories.map(async (repo) => {
        const trackedUserNames = await trackedCollaboratorRepo.findTrackedUserNamesByRepositoryId(repo.id);

        return {
          id: repo.id.toString(),
          owner: repo.ownerName,
          repo: repo.repoName,
          displayName: `${repo.ownerName}/${repo.repoName}`,
          sprint: {
            startDayOfWeek: repo.sprintStartDayOfWeek,
            durationWeeks: repo.sprintDurationWeeks,
            baseDate: repo.trackingStartDate || new Date().toISOString(),
          },
          trackedUsers: trackedUserNames,
          isActive: true, // Neonスキーマでは削除するとなくなるので常にtrue
          createdAt: repo.createdAt.toISOString(),
          updatedAt: repo.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ repositories });
  } catch (error) {
    console.error("Error fetching repository settings:", error);
    return NextResponse.json(
      { error: "設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/repository
 * リポジトリ設定を作成/更新
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      owner,
      repo,
      sprint,
      trackedUsers,
    } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner と repo は必須です" },
        { status: 400 }
      );
    }

    let repoId: number;

    if (id) {
      // 更新
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        return NextResponse.json(
          { error: "無効なリポジトリIDです" },
          { status: 400 }
        );
      }

      const existing = await repositoryRepo.findById(numericId);
      if (!existing) {
        return NextResponse.json(
          { error: "リポジトリが見つかりません" },
          { status: 404 }
        );
      }

      await repositoryRepo.update(numericId, {
        ownerName: owner,
        repoName: repo,
        sprintStartDayOfWeek: sprint?.startDayOfWeek ?? 6,
        sprintDurationWeeks: sprint?.durationWeeks ?? 1,
        trackingStartDate: sprint?.baseDate || null,
      });

      repoId = numericId;
    } else {
      // 新規作成
      const newRepoData: NewRepository = {
        ownerName: owner,
        repoName: repo,
        sprintStartDayOfWeek: sprint?.startDayOfWeek ?? 6,
        sprintDurationWeeks: sprint?.durationWeeks ?? 1,
        trackingStartDate: sprint?.baseDate || null,
      };

      const newRepo = await repositoryRepo.create(newRepoData);
      repoId = newRepo.id;
    }

    // 追跡対象ユーザーを更新
    if (trackedUsers && Array.isArray(trackedUsers)) {
      // 既存の追跡対象を削除
      await trackedCollaboratorRepo.deleteByRepositoryId(repoId);

      // 新しい追跡対象を追加
      for (const username of trackedUsers) {
        // コラボレーターを取得または作成
        const collaborator = await collaboratorRepo.findOrCreate(repoId, username);

        // 追跡対象に追加
        await trackedCollaboratorRepo.create({
          repositoryId: repoId,
          collaboratorId: collaborator.id,
        });
      }
    }

    return NextResponse.json({
      success: true,
      id: repoId.toString(),
      message: id ? "設定を更新しました" : "設定を作成しました",
    });
  } catch (error) {
    console.error("Error saving repository settings:", error);
    return NextResponse.json(
      { error: "設定の保存に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/repository
 * リポジトリ設定を削除
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id は必須です" },
        { status: 400 }
      );
    }

    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json(
        { error: "無効なリポジトリIDです" },
        { status: 400 }
      );
    }

    const deleted = await repositoryRepo.delete(numericId);

    if (!deleted) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "設定を削除しました",
    });
  } catch (error) {
    console.error("Error deleting repository settings:", error);
    return NextResponse.json(
      { error: "設定の削除に失敗しました" },
      { status: 500 }
    );
  }
}
