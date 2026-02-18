import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { SyncMetadataRepository } from "@/infrastructure/repositories/sync-metadata-repository";
import { EvaluationRepository } from "@/infrastructure/repositories/evaluation-repository";
import { evaluateIssueQuality } from "@/lib/evaluation/quality";
import { evaluateConsistency } from "@/lib/evaluation/consistency";
import { getLinkedPRsForIssue } from "@/lib/github/linked-prs";
import { SprintCalculator, type SprintConfig } from "@/domain/sprint";
import type { NewIssue, Issue, Evaluation } from "@/infrastructure/database/schema";

export const dynamic = "force-dynamic";

const repositoryRepo = new RepositoryRepository();
const issueRepo = new IssueRepository();
const collaboratorRepo = new CollaboratorRepository();
const syncMetadataRepo = new SyncMetadataRepository();
const evaluationRepo = new EvaluationRepository();

// SprintCalculatorのファクトリ関数
function createSprintCalculator(repository: {
  sprintStartDayOfWeek: number;
  sprintDurationWeeks: number;
  trackingStartDate: string | null;
}): SprintCalculator {
  const config: SprintConfig = {
    startDayOfWeek: repository.sprintStartDayOfWeek,
    durationWeeks: repository.sprintDurationWeeks,
    baseDate: repository.trackingStartDate
      ? new Date(repository.trackingStartDate)
      : new Date(),
  };
  return new SprintCalculator(config);
}

// 遅延関数
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 品質評価を実行する関数
async function runQualityEvaluation(
  repositoryId: number,
  options: { maxEvaluations?: number; delayMs?: number } = {}
): Promise<{ evaluated: number; errors: number; total: number }> {
  const { maxEvaluations, delayMs = 1000 } = options;

  // 品質評価がまだされていないIssueを取得
  const allIssues = await issueRepo.findByRepositoryId(repositoryId);

  // 評価データを取得して、未評価のIssueをフィルタ
  const unevaluatedIssues: { issue: Issue; evaluation: Evaluation | null }[] = [];

  for (const issue of allIssues) {
    const evaluation = await evaluationRepo.findByIssueId(issue.id);
    if (!evaluation || evaluation.qualityScore === null) {
      unevaluatedIssues.push({ issue, evaluation });
    }
  }

  const total = maxEvaluations
    ? Math.min(unevaluatedIssues.length, maxEvaluations)
    : unevaluatedIssues.length;

  console.log(`Found ${total} issues to evaluate for quality`);

  let evaluated = 0;
  let errors = 0;

  const issuesToEvaluate = unevaluatedIssues.slice(0, total);

  for (const { issue } of issuesToEvaluate) {
    try {
      console.log(`Evaluating issue #${issue.githubNumber}: ${issue.title} (${evaluated + 1}/${total})`);

      // assigneeの名前を取得
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
      console.log(`Issue #${issue.githubNumber} evaluated: ${qualityResult.grade} (${qualityResult.totalScore}点)`);

      if (evaluated < total) {
        await delay(delayMs);
      }
    } catch (error: unknown) {
      console.error(`Failed to evaluate issue #${issue.githubNumber}:`, error);
      errors++;

      if (error instanceof Error && error.message?.includes("429")) {
        console.log("Rate limit hit, waiting 60 seconds...");
        await delay(60000);
      }
    }
  }

  return { evaluated, errors, total };
}

// PR整合性評価を実行する関数
async function runConsistencyEvaluation(
  repositoryId: number,
  octokit: Octokit,
  owner: string,
  repo: string,
  options: { maxEvaluations?: number; delayMs?: number } = {}
): Promise<{ evaluated: number; errors: number; skipped: number; total: number }> {
  const { maxEvaluations, delayMs = 2000 } = options;

  // クローズ済みで整合性評価がまだされていないIssueを取得
  const allIssues = await issueRepo.findByRepositoryId(repositoryId);
  const closedIssues = allIssues.filter((issue) => issue.state === "closed");

  const unevaluatedIssues: Issue[] = [];

  for (const issue of closedIssues) {
    const evaluation = await evaluationRepo.findByIssueId(issue.id);
    if (!evaluation || evaluation.consistencyScore === null) {
      unevaluatedIssues.push(issue);
    }
  }

  const total = maxEvaluations
    ? Math.min(unevaluatedIssues.length, maxEvaluations)
    : unevaluatedIssues.length;

  console.log(`Found ${total} closed issues to evaluate for PR consistency`);

  let evaluated = 0;
  let errors = 0;
  let skipped = 0;

  const issuesToEvaluate = unevaluatedIssues.slice(0, total);

  for (const issue of issuesToEvaluate) {
    try {
      console.log(`Checking linked PRs for issue #${issue.githubNumber}: ${issue.title} (${evaluated + skipped + 1}/${total})`);

      const linkedPRs = await getLinkedPRsForIssue(octokit, owner, repo, issue.githubNumber);

      if (linkedPRs.length === 0) {
        console.log(`Issue #${issue.githubNumber} has no linked PRs, skipping`);
        skipped++;
        continue;
      }

      console.log(`Evaluating consistency for issue #${issue.githubNumber} with ${linkedPRs.length} linked PR(s)`);

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
      console.log(`Issue #${issue.githubNumber} consistency evaluated: ${consistencyResult.grade} (${consistencyResult.totalScore}点)`);

      if (evaluated + skipped < total) {
        await delay(delayMs);
      }
    } catch (error: unknown) {
      console.error(`Failed to evaluate consistency for issue #${issue.githubNumber}:`, error);
      errors++;

      if (error instanceof Error && error.message?.includes("429")) {
        console.log("Rate limit hit, waiting 60 seconds...");
        await delay(60000);
      }
    }
  }

  return { evaluated, errors, skipped, total };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const forceFullSync = body.forceFullSync === true;
    const requestedRepoId = body.repoId as string | number | undefined;

    // リポジトリを取得
    let repository;
    if (requestedRepoId) {
      const repoId = typeof requestedRepoId === "string"
        ? parseInt(requestedRepoId, 10)
        : requestedRepoId;

      if (isNaN(repoId)) {
        return NextResponse.json(
          { error: "無効なリポジトリIDです" },
          { status: 400 }
        );
      }

      repository = await repositoryRepo.findById(repoId);
      if (!repository) {
        return NextResponse.json(
          { error: "指定されたリポジトリが見つかりません" },
          { status: 404 }
        );
      }
    } else {
      // 最初のリポジトリを取得（後方互換）
      const allRepos = await repositoryRepo.findAll();
      if (allRepos.length === 0) {
        return NextResponse.json(
          { error: "設定が見つかりません" },
          { status: 404 }
        );
      }
      repository = allRepos[0];
    }

    const { id: repoId, ownerName: owner, repoName: repo, patEncrypted: githubPat } = repository;

    // SprintCalculatorを使用してスプリント情報を計算
    const sprintCalculator = createSprintCalculator({
      sprintStartDayOfWeek: repository.sprintStartDayOfWeek ?? 6,
      sprintDurationWeeks: repository.sprintDurationWeeks,
      trackingStartDate: repository.trackingStartDate,
    });
    const now = new Date();
    const currentSprint = sprintCalculator.getCurrentSprint(now);
    const currentSprintNumber = currentSprint.number.value;

    // 同期メタデータを取得
    const syncMeta = await syncMetadataRepo.findByRepositoryId(repoId);
    const needsFullSync = forceFullSync || !syncMeta;

    // Octokitクライアントを作成
    const octokit = new Octokit({ auth: githubPat });

    // 追跡対象ユーザーを取得
    const trackedUserNames = await import("@/infrastructure/repositories/tracked-collaborator-repository")
      .then((mod) => new mod.TrackedCollaboratorRepository())
      .then((repo) => repo.findTrackedUserNamesByRepositoryId(repoId));

    // コラボレーターのキャッシュ
    const collaboratorCache = new Map<string, number>();

    const getOrCreateCollaboratorId = async (username: string | null): Promise<number | null> => {
      if (!username) return null;

      if (collaboratorCache.has(username)) {
        return collaboratorCache.get(username)!;
      }

      const collaborator = await collaboratorRepo.findOrCreate(repoId, username);
      collaboratorCache.set(username, collaborator.id);
      return collaborator.id;
    };

    // 同期統計
    let syncedCount = 0;
    let skippedCount = 0;

    if (needsFullSync) {
      console.log(`Full sync triggered for sprint ${currentSprintNumber}`);

      // GitHubから全Issue取得
      let page = 1;
      const perPage = 100;

      while (true) {
        const { data: issues } = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state: "all",
          per_page: perPage,
          page,
        });

        if (issues.length === 0) break;

        for (const issue of issues) {
          if (issue.pull_request) continue;

          const creator = issue.user?.login || "unknown";
          if (trackedUserNames.length > 0 && !trackedUserNames.includes(creator)) {
            skippedCount++;
            continue;
          }

          const issueDate = new Date(issue.created_at);
          const issueSprintNumber = sprintCalculator.calculateIssueSprintNumber(issueDate).value;

          const assigneeId = await getOrCreateCollaboratorId(issue.assignee?.login || null);
          const authorId = await getOrCreateCollaboratorId(creator);

          const issueData: NewIssue = {
            repositoryId: repoId,
            githubNumber: issue.number,
            title: issue.title,
            body: issue.body || null,
            state: issue.state as "open" | "closed",
            authorCollaboratorId: authorId,
            assigneeCollaboratorId: assigneeId,
            sprintNumber: issueSprintNumber,
            githubCreatedAt: new Date(issue.created_at),
            githubClosedAt: issue.closed_at ? new Date(issue.closed_at) : null,
          };

          await issueRepo.upsert(issueData);
          syncedCount++;
        }

        if (issues.length < perPage) break;
        page++;
      }
    } else {
      console.log(`Incremental sync for sprint ${currentSprintNumber}`);

      // 差分同期
      let page = 1;
      const perPage = 100;

      while (true) {
        const { data: issues } = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state: "all",
          per_page: perPage,
          page,
          since: syncMeta?.lastSyncAt?.toISOString(),
        });

        if (issues.length === 0) break;

        for (const issue of issues) {
          if (issue.pull_request) continue;

          const creator = issue.user?.login || "unknown";
          if (trackedUserNames.length > 0 && !trackedUserNames.includes(creator)) {
            skippedCount++;
            continue;
          }

          const issueDate = new Date(issue.created_at);
          const issueSprintNumber = sprintCalculator.calculateIssueSprintNumber(issueDate).value;

          const assigneeId = await getOrCreateCollaboratorId(issue.assignee?.login || null);
          const authorId = await getOrCreateCollaboratorId(creator);

          const issueData: NewIssue = {
            repositoryId: repoId,
            githubNumber: issue.number,
            title: issue.title,
            body: issue.body || null,
            state: issue.state as "open" | "closed",
            authorCollaboratorId: authorId,
            assigneeCollaboratorId: assigneeId,
            sprintNumber: issueSprintNumber,
            githubCreatedAt: new Date(issue.created_at),
            githubClosedAt: issue.closed_at ? new Date(issue.closed_at) : null,
          };

          await issueRepo.upsert(issueData);
          syncedCount++;
        }

        if (issues.length < perPage) break;
        page++;
      }
    }

    // 同期メタデータを更新
    await syncMetadataRepo.upsert(repoId, new Date());

    // 品質評価を実行（GEMINI_API_KEYが設定されている場合のみ）
    let qualityEvaluationStats = { evaluated: 0, errors: 0, total: 0 };
    let consistencyEvaluationStats = { evaluated: 0, errors: 0, skipped: 0, total: 0 };

    if (process.env.GEMINI_API_KEY) {
      try {
        qualityEvaluationStats = await runQualityEvaluation(repoId, { delayMs: 1000 });
      } catch (error) {
        console.error("Quality evaluation error:", error);
      }

      try {
        consistencyEvaluationStats = await runConsistencyEvaluation(
          repoId,
          octokit,
          owner,
          repo,
          { delayMs: 2000 }
        );
      } catch (error) {
        console.error("Consistency evaluation error:", error);
      }
    } else {
      console.log("GEMINI_API_KEY is not set, skipping AI evaluations");
    }

    return NextResponse.json({
      success: true,
      syncType: needsFullSync ? "full" : "incremental",
      currentSprintNumber,
      stats: {
        synced: syncedCount,
        skipped: skippedCount,
        qualityTotal: qualityEvaluationStats.total,
        qualityEvaluated: qualityEvaluationStats.evaluated,
        qualityErrors: qualityEvaluationStats.errors,
        consistencyTotal: consistencyEvaluationStats.total,
        consistencyEvaluated: consistencyEvaluationStats.evaluated,
        consistencySkipped: consistencyEvaluationStats.skipped,
        consistencyErrors: consistencyEvaluationStats.errors,
      },
    });
  } catch (error) {
    console.error("Sync API Error:", error);
    return NextResponse.json(
      { error: "同期に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}

// 同期状態を確認するGET
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedRepoId = searchParams.get("repoId");

    let repository;
    if (requestedRepoId) {
      const repoId = parseInt(requestedRepoId, 10);
      if (isNaN(repoId)) {
        return NextResponse.json({ needsSync: true, reason: "invalid_repo_id" });
      }
      repository = await repositoryRepo.findById(repoId);
      if (!repository) {
        return NextResponse.json({ needsSync: true, reason: "repo_not_found" });
      }
    } else {
      const allRepos = await repositoryRepo.findAll();
      if (allRepos.length === 0) {
        return NextResponse.json({ needsSync: true, reason: "no_config" });
      }
      repository = allRepos[0];
    }

    const sprintCalculator = createSprintCalculator({
      sprintStartDayOfWeek: repository.sprintStartDayOfWeek ?? 6,
      sprintDurationWeeks: repository.sprintDurationWeeks,
      trackingStartDate: repository.trackingStartDate,
    });
    const now = new Date();
    const currentSprintNumber = sprintCalculator.calculateSprintNumber(now).value;

    const syncMeta = await syncMetadataRepo.findByRepositoryId(repository.id);

    if (!syncMeta) {
      return NextResponse.json({
        needsSync: true,
        reason: "never_synced",
        currentSprintNumber,
      });
    }

    return NextResponse.json({
      needsSync: false,
      reason: "up_to_date",
      currentSprintNumber,
      lastSync: {
        lastSyncAt: syncMeta.lastSyncAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Sync status check error:", error);
    return NextResponse.json(
      { error: "同期状態の確認に失敗しました" },
      { status: 500 }
    );
  }
}
