import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { syncRepository } from "@/lib/github/sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/github/sync
 * GitHubからデータを同期（差分同期対応）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repositoryId, fullSync = false } = body;

    if (!repositoryId) {
      return NextResponse.json(
        { error: "repositoryIdは必須です", message: "repositoryId is required" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const repoDoc = await db.collection("repositories").doc(repositoryId).get();

    if (!repoDoc.exists) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    const repoData = repoDoc.data()!;
    const lastSyncedAt = repoData.lastSyncedAt?.toDate() || null;

    // GitHub同期を実行
    const { issues, pullRequests, result } = await syncRepository(
      repoData.owner,
      repoData.name,
      lastSyncedAt,
      fullSync
    );

    // Firestoreに保存
    const batch = db.batch();

    // Issues保存
    for (const issue of issues) {
      // 既存のIssueを確認（githubIdで検索）
      const existingQuery = await db
        .collection("repositories")
        .doc(repositoryId)
        .collection("issues")
        .where("githubId", "==", issue.githubId)
        .limit(1)
        .get();

      if (existingQuery.empty) {
        // 新規作成
        const newDocRef = db
          .collection("repositories")
          .doc(repositoryId)
          .collection("issues")
          .doc();
        batch.set(newDocRef, issue);
      } else {
        // 更新（評価結果は保持）
        const existingDoc = existingQuery.docs[0];
        const existingData = existingDoc.data();
        batch.update(existingDoc.ref, {
          ...issue,
          speedEvaluation: existingData.speedEvaluation,
          qualityEvaluation: existingData.qualityEvaluation,
        });
      }
    }

    // Pull Requests保存
    for (const pr of pullRequests) {
      const existingQuery = await db
        .collection("repositories")
        .doc(repositoryId)
        .collection("pullRequests")
        .where("githubId", "==", pr.githubId)
        .limit(1)
        .get();

      if (existingQuery.empty) {
        const newDocRef = db
          .collection("repositories")
          .doc(repositoryId)
          .collection("pullRequests")
          .doc();
        batch.set(newDocRef, pr);
      } else {
        const existingDoc = existingQuery.docs[0];
        const existingData = existingDoc.data();
        batch.update(existingDoc.ref, {
          ...pr,
          consistencyEvaluation: existingData.consistencyEvaluation,
        });
      }
    }

    // リポジトリ情報を更新
    const issuesCountSnapshot = await db
      .collection("repositories")
      .doc(repositoryId)
      .collection("issues")
      .count()
      .get();

    const prsCountSnapshot = await db
      .collection("repositories")
      .doc(repositoryId)
      .collection("pullRequests")
      .count()
      .get();

    batch.update(repoDoc.ref, {
      lastSyncedAt: result.lastSyncedAt,
      issueCount: issuesCountSnapshot.data().count + issues.length,
      prCount: prsCountSnapshot.data().count + pullRequests.length,
      updatedAt: new Date(),
    });

    await batch.commit();

    return NextResponse.json({
      issuesSynced: result.issuesSynced,
      prsSynced: result.prsSynced,
      isFullSync: result.isFullSync,
      lastSyncedAt: result.lastSyncedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error syncing repository:", error);

    // GitHub APIレート制限チェック
    if (error instanceof Error && error.message.includes("rate limit")) {
      return NextResponse.json(
        {
          error: "GitHub APIレート制限に達しました",
          message: "GitHub API rate limit exceeded",
          retryAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to sync repository" },
      { status: 500 }
    );
  }
}
