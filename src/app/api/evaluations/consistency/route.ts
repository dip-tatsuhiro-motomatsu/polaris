import { NextRequest, NextResponse } from "next/server";
import { ConsistencyEvaluator } from "@/domain/evaluation/services";
import { getLinkedPRsForIssue } from "@/lib/github/linked-prs";
import { getOctokit } from "@/lib/github/client";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { EvaluationRepository } from "@/infrastructure/repositories/evaluation-repository";
import { db } from "@/infrastructure/database";
import { repositories } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";
import type { ConsistencyDetails } from "@/infrastructure/database/schema";

export const dynamic = "force-dynamic";

interface EvaluatedResult {
  issueId: number;
  issueNumber: number;
  totalScore: number;
  grade: string;
  linkedPRs: { number: number; title: string; url: string }[];
  overallFeedback: string;
}

interface SkippedResult {
  issueId: number;
  issueNumber: number;
  reason: string;
}

/**
 * POST /api/evaluations/consistency
 * Issue-PR整合性をAIで評価
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

    // リポジトリ情報を取得
    const [repo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, repositoryId))
      .limit(1);

    if (!repo) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    const owner = repo.ownerName;
    const repoName = repo.repoName;

    if (!owner || !repoName) {
      return NextResponse.json(
        { error: "リポジトリ情報が不完全です", message: "Repository info incomplete" },
        { status: 400 }
      );
    }

    const issueRepository = new IssueRepository();
    const evaluationRepository = new EvaluationRepository();

    // 評価対象のIssueを取得（クローズされたもののみ）
    let issues = await issueRepository.findByRepositoryId(repositoryId);
    issues = issues.filter((issue) => issue.state === "closed");

    if (issues.length === 0) {
      return NextResponse.json(
        { error: "クローズされたIssueが見つかりません", message: "No closed issues found" },
        { status: 404 }
      );
    }

    // 特定のIssueIDが指定されている場合はフィルタ
    if (issueIds && Array.isArray(issueIds) && issueIds.length > 0) {
      issues = issues.filter((issue) => issueIds.includes(issue.id));
    }

    const octokit = getOctokit();
    const results: EvaluatedResult[] = [];
    const skippedIssues: SkippedResult[] = [];

    // ドメインサービスを使用して評価
    const evaluator = new ConsistencyEvaluator();

    for (const issue of issues) {
      try {
        // リンクされたPRを取得
        const linkedPRs = await getLinkedPRsForIssue(
          octokit,
          owner,
          repoName,
          issue.githubNumber
        );

        if (linkedPRs.length === 0) {
          skippedIssues.push({
            issueId: issue.id,
            issueNumber: issue.githubNumber,
            reason: "リンクされたPRがありません",
          });
          continue;
        }

        // ドメインサービスで整合性評価を実行
        const evaluation = await evaluator.evaluate(
          {
            number: issue.githubNumber,
            title: issue.title,
            body: issue.body,
          },
          linkedPRs
        );

        // Neonに保存
        const details: ConsistencyDetails = {
          linkedPRs: evaluation.linkedPRs,
          categories: evaluation.categories,
          overallFeedback: evaluation.overallFeedback,
          issueImprovementSuggestions: evaluation.issueImprovementSuggestions,
        };

        await evaluationRepository.saveConsistencyEvaluation({
          issueId: issue.id,
          score: evaluation.totalScore.value,
          grade: evaluation.grade.value,
          details,
        });

        results.push({
          issueId: issue.id,
          issueNumber: issue.githubNumber,
          totalScore: evaluation.totalScore.value,
          grade: evaluation.grade.value,
          linkedPRs: evaluation.linkedPRs,
          overallFeedback: evaluation.overallFeedback,
        });
      } catch (evalError) {
        console.error(`Error evaluating consistency for issue ${issue.id}:`, evalError);
        skippedIssues.push({
          issueId: issue.id,
          issueNumber: issue.githubNumber,
          reason: "評価中にエラーが発生しました",
        });
      }
    }

    return NextResponse.json({
      evaluated: results.length,
      skipped: skippedIssues.length,
      results,
      skippedIssues,
    });
  } catch (error) {
    console.error("Error evaluating consistency:", error);
    return NextResponse.json(
      { error: "整合性評価に失敗しました", message: "Failed to evaluate consistency" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/evaluations/consistency
 * 特定のIssueの整合性評価を取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get("repositoryId");
    const issueId = searchParams.get("issueId");

    if (!repositoryId) {
      return NextResponse.json(
        { error: "repositoryIdは必須です", message: "repositoryId is required" },
        { status: 400 }
      );
    }

    const issueRepository = new IssueRepository();
    const evaluationRepository = new EvaluationRepository();

    if (issueId) {
      // 特定のIssueの評価を取得
      const issue = await issueRepository.findById(Number(issueId));
      if (!issue) {
        return NextResponse.json(
          { error: "Issueが見つかりません", message: "Issue not found" },
          { status: 404 }
        );
      }

      const evaluation = await evaluationRepository.findByIssueId(issue.id);

      return NextResponse.json({
        issueId: issue.id,
        issueNumber: issue.githubNumber,
        consistencyEvaluation: evaluation
          ? {
              totalScore: evaluation.consistencyScore,
              grade: evaluation.consistencyGrade,
              ...evaluation.consistencyDetails,
              evaluatedAt: evaluation.consistencyCalculatedAt?.toISOString(),
            }
          : null,
      });
    } else {
      // 全Issueの評価を取得
      const issues = await issueRepository.findByRepositoryId(Number(repositoryId));
      const evaluations = await Promise.all(
        issues.map(async (issue) => {
          const evaluation = await evaluationRepository.findByIssueId(issue.id);
          return {
            issueId: issue.id,
            issueNumber: issue.githubNumber,
            consistencyEvaluation: evaluation
              ? {
                  totalScore: evaluation.consistencyScore,
                  grade: evaluation.consistencyGrade,
                  ...evaluation.consistencyDetails,
                  evaluatedAt: evaluation.consistencyCalculatedAt?.toISOString(),
                }
              : null,
          };
        })
      );

      return NextResponse.json({ evaluations });
    }
  } catch (error) {
    console.error("Error getting consistency evaluation:", error);
    return NextResponse.json(
      { error: "整合性評価の取得に失敗しました", message: "Failed to get consistency evaluation" },
      { status: 500 }
    );
  }
}
