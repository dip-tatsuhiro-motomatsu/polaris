import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { Repository } from "@/types/repository";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/repositories/[id]
 * リポジトリ詳細を取得
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getAdminFirestore();
    const doc = await db.collection("repositories").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;
    const repository: Repository = {
      id: doc.id,
      owner: data.owner,
      name: data.name,
      url: data.url,
      githubId: data.githubId,
      lastSyncedAt: data.lastSyncedAt?.toDate() || null,
      issueCount: data.issueCount || 0,
      prCount: data.prCount || 0,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    };

    return NextResponse.json(repository);
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
 * リポジトリを削除
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getAdminFirestore();
    const docRef = db.collection("repositories").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    // サブコレクション（issues, pullRequests）も削除
    const batch = db.batch();

    // Issues削除
    const issuesSnapshot = await docRef.collection("issues").get();
    issuesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Pull Requests削除
    const prsSnapshot = await docRef.collection("pullRequests").get();
    prsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // リポジトリ本体削除
    batch.delete(docRef);

    await batch.commit();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting repository:", error);
    return NextResponse.json(
      { error: "Failed to delete repository" },
      { status: 500 }
    );
  }
}
