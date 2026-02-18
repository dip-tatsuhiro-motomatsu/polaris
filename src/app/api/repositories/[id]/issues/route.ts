import { NextRequest, NextResponse } from "next/server";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
};

const repositoryRepo = new RepositoryRepository();
const issueRepo = new IssueRepository();

/**
 * GET /api/repositories/[id]/issues
 * Issue一覧を取得
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

    const { searchParams } = new URL(request.url);

    const state = (searchParams.get("state") || "all") as "open" | "closed" | "all";
    const sprintStart = searchParams.get("sprintStart");
    const sprintEnd = searchParams.get("sprintEnd");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // リポジトリ存在確認
    const repository = await repositoryRepo.findById(repositoryId);
    if (!repository) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    // Issue一覧を取得
    const { issues, total } = await issueRepo.findByRepositoryIdWithEvaluations(repositoryId, {
      state,
      sprintStart: sprintStart ? new Date(sprintStart) : undefined,
      sprintEnd: sprintEnd ? new Date(sprintEnd) : undefined,
      limit,
      offset,
    });

    // レスポンス形式に変換
    const formattedIssues = issues.map((issue) => ({
      id: issue.id,
      number: issue.githubNumber,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      createdAt: issue.githubCreatedAt,
      closedAt: issue.githubClosedAt,
      assignee: issue.assignee?.githubUserName || null,
      labels: [], // TODO: labelsテーブルが追加されたら対応
      githubId: issue.id, // Neonでは内部IDを使用
      speedEvaluation: issue.evaluation?.leadTimeScore != null
        ? {
            score: issue.evaluation.leadTimeScore,
            calculatedAt: issue.evaluation.leadTimeCalculatedAt,
          }
        : null,
      qualityEvaluation: issue.evaluation?.qualityScore != null
        ? {
            totalScore: issue.evaluation.qualityScore,
            grade: issue.evaluation.qualityGrade,
            ...issue.evaluation.qualityDetails,
            evaluatedAt: issue.evaluation.qualityCalculatedAt,
          }
        : null,
      consistencyEvaluation: issue.evaluation?.consistencyScore != null
        ? {
            totalScore: issue.evaluation.consistencyScore,
            grade: issue.evaluation.consistencyGrade,
            ...issue.evaluation.consistencyDetails,
            evaluatedAt: issue.evaluation.consistencyCalculatedAt,
          }
        : null,
      syncedAt: issue.updatedAt,
    }));

    return NextResponse.json({
      issues: formattedIssues,
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
