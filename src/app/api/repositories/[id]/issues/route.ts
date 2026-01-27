import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { Issue } from "@/types/issue";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/repositories/[id]/issues
 * Issue一覧を取得
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: repositoryId } = await params;
    const { searchParams } = new URL(request.url);

    const state = searchParams.get("state") || "all";
    const sprintStart = searchParams.get("sprintStart");
    const sprintEnd = searchParams.get("sprintEnd");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const db = getAdminFirestore();

    // リポジトリ存在確認
    const repoDoc = await db.collection("repositories").doc(repositoryId).get();
    if (!repoDoc.exists) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    // クエリ構築
    let query = db
      .collection("repositories")
      .doc(repositoryId)
      .collection("issues")
      .orderBy("createdAt", "desc");

    // stateフィルタ
    if (state !== "all") {
      query = query.where("state", "==", state);
    }

    // 全件取得（Firestore制限のため、クライアントサイドでスプリントフィルタリング）
    const snapshot = await query.get();

    let issues: Issue[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        number: data.number,
        title: data.title,
        body: data.body,
        state: data.state,
        createdAt: data.createdAt?.toDate() || new Date(),
        closedAt: data.closedAt?.toDate() || null,
        assignee: data.assignee,
        labels: data.labels || [],
        githubId: data.githubId,
        speedEvaluation: data.speedEvaluation || null,
        qualityEvaluation: data.qualityEvaluation || null,
        syncedAt: data.syncedAt?.toDate() || new Date(),
      };
    });

    // スプリント期間フィルタリング
    if (sprintStart) {
      const startDate = new Date(sprintStart);
      issues = issues.filter((issue) => issue.createdAt >= startDate);
    }
    if (sprintEnd) {
      const endDate = new Date(sprintEnd);
      endDate.setHours(23, 59, 59, 999);
      issues = issues.filter((issue) => issue.createdAt <= endDate);
    }

    const total = issues.length;

    // ページネーション
    const paginatedIssues = issues.slice(offset, offset + limit);

    return NextResponse.json({
      issues: paginatedIssues,
      total,
      hasMore: offset + limit < total,
      filter: {
        sprintStart: sprintStart || null,
        sprintEnd: sprintEnd || null,
      },
    });
  } catch (error) {
    console.error("Error fetching issues:", error);
    return NextResponse.json(
      { error: "Failed to fetch issues" },
      { status: 500 }
    );
  }
}
