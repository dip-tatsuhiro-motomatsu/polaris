import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { parseGitHubUrl, getRepositoryInfo } from "@/lib/github/client";
import type { Repository } from "@/types/repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/repositories
 * リポジトリ一覧を取得
 */
export async function GET() {
  try {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection("repositories")
      .orderBy("createdAt", "desc")
      .get();

    const repositories: Repository[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
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
    });

    return NextResponse.json({ repositories });
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/repositories
 * リポジトリを登録
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    // URLバリデーション
    if (!url) {
      return NextResponse.json(
        { error: "URLは必須です", message: "URL is required" },
        { status: 400 }
      );
    }

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return NextResponse.json(
        {
          error: "有効なGitHub URLを入力してください",
          message: "Invalid GitHub URL",
        },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    // 重複チェック
    const existingQuery = await db
      .collection("repositories")
      .where("owner", "==", parsed.owner)
      .where("name", "==", parsed.repo)
      .get();

    if (!existingQuery.empty) {
      return NextResponse.json(
        {
          error: "このリポジトリは既に登録されています",
          message: "Repository already exists",
        },
        { status: 409 }
      );
    }

    // GitHubからリポジトリ情報を取得
    let githubRepo;
    try {
      githubRepo = await getRepositoryInfo(parsed.owner, parsed.repo);
    } catch (error) {
      console.error("GitHub API error:", error);
      return NextResponse.json(
        {
          error: "GitHubリポジトリが見つかりません",
          message: "Repository not found on GitHub",
        },
        { status: 404 }
      );
    }

    // Firestoreに保存
    const now = new Date();
    const repositoryData = {
      owner: parsed.owner,
      name: parsed.repo,
      url: githubRepo.html_url,
      githubId: githubRepo.id,
      lastSyncedAt: null,
      issueCount: 0,
      prCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection("repositories").add(repositoryData);

    const repository: Repository = {
      id: docRef.id,
      ...repositoryData,
    };

    return NextResponse.json(repository, { status: 201 });
  } catch (error) {
    console.error("Error creating repository:", error);
    return NextResponse.json(
      { error: "Failed to create repository" },
      { status: 500 }
    );
  }
}
