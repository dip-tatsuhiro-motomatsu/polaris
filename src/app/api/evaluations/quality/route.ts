import { NextRequest, NextResponse } from "next/server";
import { QualityEvaluator } from "@/domain/evaluation/services";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { EvaluationRepository } from "@/infrastructure/repositories/evaluation-repository";
import type { QualityDetails } from "@/infrastructure/database/schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/evaluations/quality
 * Issue記述品質をAIで評価
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

    const issueRepository = new IssueRepository();
    const evaluationRepository = new EvaluationRepository();

    // 評価対象のIssueを取得
    let issues = await issueRepository.findByRepositoryId(repositoryId);

    if (issues.length === 0) {
      return NextResponse.json(
        { error: "Issueが見つかりません", message: "No issues found" },
        { status: 404 }
      );
    }

    // 特定のIssueIDが指定されている場合はフィルタ
    if (issueIds && Array.isArray(issueIds) && issueIds.length > 0) {
      issues = issues.filter((issue) => issueIds.includes(issue.id));
    }

    // ドメインサービスを使用して評価を実行
    const evaluator = new QualityEvaluator();
    const results: Array<{
      issueId: number;
      issueNumber: number;
      totalScore: number;
      grade: string;
      overallFeedback: string;
    }> = [];

    for (const issue of issues) {
      try {
        // ドメインサービスで評価
        const evaluation = await evaluator.evaluate({
          number: issue.githubNumber,
          title: issue.title,
          body: issue.body,
          assignee: null, // TODO: assigneeの取得
        });

        // Neonに保存
        const details: QualityDetails = {
          categories: evaluation.categories,
          overallFeedback: evaluation.overallFeedback,
          improvementSuggestions: evaluation.improvementSuggestions,
        };

        await evaluationRepository.saveQualityEvaluation({
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
          overallFeedback: evaluation.overallFeedback,
        });
      } catch (evalError) {
        console.error(`Error evaluating issue ${issue.id}:`, evalError);
        // 個別のIssue評価エラーは続行
      }
    }

    return NextResponse.json({
      evaluated: results.length,
      results,
    });
  } catch (error) {
    console.error("Error evaluating quality:", error);
    return NextResponse.json(
      { error: "品質評価に失敗しました", message: "Failed to evaluate quality" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/evaluations/quality
 * 特定のIssueの品質評価を取得
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
        qualityEvaluation: evaluation
          ? {
              totalScore: evaluation.qualityScore,
              grade: evaluation.qualityGrade,
              ...evaluation.qualityDetails,
              evaluatedAt: evaluation.qualityCalculatedAt?.toISOString(),
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
            qualityEvaluation: evaluation
              ? {
                  totalScore: evaluation.qualityScore,
                  grade: evaluation.qualityGrade,
                  ...evaluation.qualityDetails,
                  evaluatedAt: evaluation.qualityCalculatedAt?.toISOString(),
                }
              : null,
          };
        })
      );

      return NextResponse.json({ evaluations });
    }
  } catch (error) {
    console.error("Error getting quality evaluation:", error);
    return NextResponse.json(
      { error: "品質評価の取得に失敗しました", message: "Failed to get quality evaluation" },
      { status: 500 }
    );
  }
}
