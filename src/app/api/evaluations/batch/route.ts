import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { EvaluationRepository } from "@/infrastructure/repositories/evaluation-repository";
import { evaluateIssueQuality } from "@/lib/evaluation/quality";
import { evaluateConsistency } from "@/lib/evaluation/consistency";
import { getLinkedPRsForIssue } from "@/lib/github/linked-prs";
import type { Issue, Evaluation } from "@/infrastructure/database/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const repositoryRepo = new RepositoryRepository();
const issueRepo = new IssueRepository();
const collaboratorRepo = new CollaboratorRepository();
const evaluationRepo = new EvaluationRepository();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BatchRequest {
  repoId?: number;
  type: "quality" | "consistency";
  limit?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchRequest = await request.json();
    const { type, limit = 10 } = body;
    const maxLimit = Math.min(limit, 20);

    if (!type || !["quality", "consistency"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'quality' or 'consistency'" },
        { status: 400 }
      );
    }

    // リポジトリを取得
    let repository;
    if (body.repoId) {
      repository = await repositoryRepo.findById(body.repoId);
      if (!repository) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 }
        );
      }
    } else {
      const allRepos = await repositoryRepo.findAll();
      if (allRepos.length === 0) {
        return NextResponse.json(
          { error: "No repository configured" },
          { status: 404 }
        );
      }
      repository = allRepos[0];
    }

    const repoId = repository.id;

    if (type === "quality") {
      const result = await runQualityBatch(repoId, maxLimit);
      return NextResponse.json(result);
    } else {
      const githubPat = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!githubPat) {
        return NextResponse.json(
          { error: "GitHub PATが環境変数に設定されていません" },
          { status: 500 }
        );
      }
      const result = await runConsistencyBatch(
        {
          id: repository.id,
          ownerName: repository.ownerName,
          repoName: repository.repoName,
          githubPat,
        },
        maxLimit
      );
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error("Batch evaluation error:", error);
    return NextResponse.json(
      { error: "Batch evaluation failed", details: String(error) },
      { status: 500 }
    );
  }
}

async function runQualityBatch(
  repositoryId: number,
  limit: number
): Promise<{ evaluated: number; errors: number; remaining: number }> {
  const allIssues = await issueRepo.findByRepositoryId(repositoryId);

  const unevaluatedIssues: { issue: Issue; evaluation: Evaluation | null }[] = [];

  for (const issue of allIssues) {
    const evaluation = await evaluationRepo.findByIssueId(issue.id);
    if (!evaluation || evaluation.qualityScore === null) {
      unevaluatedIssues.push({ issue, evaluation });
    }
  }

  const issuesToEvaluate = unevaluatedIssues.slice(0, limit);
  const remaining = unevaluatedIssues.length - issuesToEvaluate.length;

  let evaluated = 0;
  let errors = 0;

  for (const { issue } of issuesToEvaluate) {
    try {
      console.log(`[Batch] Evaluating quality for issue #${issue.githubNumber}: ${issue.title}`);

      let assigneeName: string | null = null;
      if (issue.assigneeCollaboratorId) {
        const assignee = await collaboratorRepo.findById(issue.assigneeCollaboratorId);
        assigneeName = assignee?.githubUserName || null;
      }

      const qualityResult = await evaluateIssueQuality({
        number: issue.githubNumber,
        title: issue.title,
        body: issue.body,
        assignee: assigneeName,
      });

      await evaluationRepo.saveQualityEvaluation({
        issueId: issue.id,
        score: qualityResult.totalScore,
        grade: qualityResult.grade,
        details: {
          categories: qualityResult.categories,
          overallFeedback: qualityResult.overallFeedback,
          improvementSuggestions: qualityResult.improvementSuggestions,
        },
      });

      evaluated++;
      console.log(`[Batch] Issue #${issue.githubNumber} evaluated: ${qualityResult.grade} (${qualityResult.totalScore}pts)`);

      if (evaluated < issuesToEvaluate.length) {
        await delay(1000);
      }
    } catch (error: unknown) {
      console.error(`[Batch] Failed to evaluate issue #${issue.githubNumber}:`, error);
      errors++;

      if (error instanceof Error && error.message?.includes("429")) {
        console.log("[Batch] Rate limit hit, stopping batch");
        break;
      }
    }
  }

  return { evaluated, errors, remaining: remaining + (issuesToEvaluate.length - evaluated) };
}

async function runConsistencyBatch(
  repository: { id: number; ownerName: string; repoName: string; githubPat: string },
  limit: number
): Promise<{ evaluated: number; errors: number; skipped: number; remaining: number }> {
  const repositoryId = repository.id;
  const octokit = new Octokit({ auth: repository.githubPat });

  const allIssues = await issueRepo.findByRepositoryId(repositoryId);
  const closedIssues = allIssues.filter((issue) => issue.state === "closed");

  const unevaluatedIssues: Issue[] = [];

  for (const issue of closedIssues) {
    const evaluation = await evaluationRepo.findByIssueId(issue.id);
    if (!evaluation || evaluation.consistencyScore === null) {
      unevaluatedIssues.push(issue);
    }
  }

  const issuesToEvaluate = unevaluatedIssues.slice(0, limit);
  const remaining = unevaluatedIssues.length - issuesToEvaluate.length;

  let evaluated = 0;
  let errors = 0;
  let skipped = 0;

  for (const issue of issuesToEvaluate) {
    try {
      console.log(`[Batch] Checking linked PRs for issue #${issue.githubNumber}: ${issue.title}`);

      const linkedPRs = await getLinkedPRsForIssue(
        octokit,
        repository.ownerName,
        repository.repoName,
        issue.githubNumber
      );

      if (linkedPRs.length === 0) {
        console.log(`[Batch] Issue #${issue.githubNumber} has no linked PRs, skipping`);
        skipped++;
        continue;
      }

      console.log(`[Batch] Evaluating consistency for issue #${issue.githubNumber} with ${linkedPRs.length} linked PR(s)`);

      const consistencyResult = await evaluateConsistency(
        {
          number: issue.githubNumber,
          title: issue.title,
          body: issue.body,
        },
        linkedPRs
      );

      await evaluationRepo.saveConsistencyEvaluation({
        issueId: issue.id,
        score: consistencyResult.totalScore,
        grade: consistencyResult.grade,
        details: {
          linkedPRs: consistencyResult.linkedPRs,
          categories: consistencyResult.categories,
          overallFeedback: consistencyResult.overallFeedback,
          issueImprovementSuggestions: consistencyResult.issueImprovementSuggestions,
        },
      });

      evaluated++;
      console.log(`[Batch] Issue #${issue.githubNumber} consistency evaluated: ${consistencyResult.grade} (${consistencyResult.totalScore}pts)`);

      if (evaluated + skipped < issuesToEvaluate.length) {
        await delay(2000);
      }
    } catch (error: unknown) {
      console.error(`[Batch] Failed to evaluate consistency for issue #${issue.githubNumber}:`, error);
      errors++;

      if (error instanceof Error && error.message?.includes("429")) {
        console.log("[Batch] Rate limit hit, stopping batch");
        break;
      }
    }
  }

  return {
    evaluated,
    errors,
    skipped,
    remaining: remaining + (issuesToEvaluate.length - evaluated - skipped),
  };
}
