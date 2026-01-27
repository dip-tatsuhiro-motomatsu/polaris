import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { RepositoryConfig } from "@/types/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/repository
 * リポジトリ設定を取得
 */
export async function GET() {
  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection("repositories").get();

    const repositories: RepositoryConfig[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      repositories.push({
        id: doc.id,
        owner: data.owner,
        repo: data.repo,
        displayName: data.displayName,
        githubPat: data.githubPat,
        sprint: {
          startDayOfWeek: data.sprint?.startDayOfWeek ?? 6,
          durationWeeks: data.sprint?.durationWeeks ?? 1,
          baseDate: data.sprint?.baseDate || new Date().toISOString(),
        },
        trackedUsers: data.trackedUsers || [],
        isActive: data.isActive ?? true,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      });
    });

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
      displayName,
      githubPat,
      sprint,
      trackedUsers,
      isActive,
    } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner と repo は必須です" },
        { status: 400 }
      );
    }

    if (!githubPat) {
      return NextResponse.json(
        { error: "GitHub Personal Access Token は必須です" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const now = new Date();

    const data = {
      owner,
      repo,
      displayName: displayName || `${owner}/${repo}`,
      githubPat,
      sprint: {
        startDayOfWeek: sprint?.startDayOfWeek ?? 6,
        durationWeeks: sprint?.durationWeeks ?? 1,
        baseDate: sprint?.baseDate || now.toISOString(),
      },
      trackedUsers: trackedUsers || [],
      isActive: isActive ?? true,
      updatedAt: now,
    };

    let docId = id;

    if (id) {
      // 更新
      await db.collection("repositories").doc(id).update(data);
    } else {
      // 新規作成
      const docRef = await db.collection("repositories").add({
        ...data,
        createdAt: now,
      });
      docId = docRef.id;
    }

    return NextResponse.json({
      success: true,
      id: docId,
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

    const db = getAdminFirestore();
    await db.collection("repositories").doc(id).delete();

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
