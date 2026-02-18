import { NextRequest, NextResponse } from "next/server";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { evaluateIssueSpeed } from "@/lib/evaluation/speed";
import type { Issue, IssueState } from "@/types/issue";

export const dynamic = "force-dynamic";

const repositoryRepo = new RepositoryRepository();
const issueRepo = new IssueRepository();

/**
 * POST /api/evaluations/speed
 * Issue完了速度を評価
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repositoryId, issueIds } = body;

    if (!repositoryId) {
      return NextResponse.json(
        { error: "repositoryIdは必須です", message: "repositoryId is required" },
        { status: 400 }
      );
    }

    const repoId = parseInt(repositoryId, 10);
    if (isNaN(repoId)) {
      return NextResponse.json(
        { error: "無効なリポジトリIDです", message: "Invalid repository ID" },
        { status: 400 }
      );
    }

    // リポジトリ存在確認
    const repository = await repositoryRepo.findById(repoId);
    if (!repository) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    // クローズ済みのIssueを取得
    const allIssues = await issueRepo.findByRepositoryId(repoId);
    let closedIssues = allIssues.filter((issue) => issue.state === "closed");

    // 特定のIssueIDが指定されている場合はフィルタ
    if (issueIds && Array.isArray(issueIds) && issueIds.length > 0) {
      const issueIdSet = new Set(issueIds.map((id: string | number) =>
        typeof id === "string" ? parseInt(id, 10) : id
      ));
      closedIssues = closedIssues.filter((issue) => issueIdSet.has(issue.id));
    }

    // 評価を実行し、結果を保存
    const results: Array<{
      issueId: number;
      issueNumber: number;
      score: number;
      grade: string;
      message: string;
    }> = [];

    for (const dbIssue of closedIssues) {
      // IssueをAPI型に変換
      const issue: Issue = {
        id: dbIssue.id.toString(),
        number: dbIssue.githubNumber,
        title: dbIssue.title,
        body: dbIssue.body || "",
        state: dbIssue.state as IssueState,
        createdAt: dbIssue.githubCreatedAt,
        closedAt: dbIssue.githubClosedAt,
        assignee: null, // 評価には使用しない
        labels: [],
        githubId: dbIssue.id,
        speedEvaluation: null,
        qualityEvaluation: null,
        syncedAt: dbIssue.updatedAt,
      };

      const evaluation = evaluateIssueSpeed(issue);

      if (evaluation) {
        // EvaluationRepositoryにはspeed用のメソッドがないため、leadTimeScoreとして扱う
        // 必要に応じてEvaluationRepositoryにsaveLeadTimeEvaluationを追加可能
        // 今回は評価結果のみ返す

        results.push({
          issueId: dbIssue.id,
          issueNumber: dbIssue.githubNumber,
          score: evaluation.score,
          grade: evaluation.grade,
          message: evaluation.message,
        });
      }
    }

    return NextResponse.json({
      evaluated: results.length,
      results,
    });
  } catch (error) {
    console.error("Error evaluating speed:", error);
    return NextResponse.json(
      { error: "Failed to evaluate speed" },
      { status: 500 }
    );
  }
}
