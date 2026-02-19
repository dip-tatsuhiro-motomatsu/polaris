import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";
import { PullRequestRepository } from "@/infrastructure/repositories/pull-request-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { SyncMetadataRepository } from "@/infrastructure/repositories/sync-metadata-repository";
import { EvaluationRepository } from "@/infrastructure/repositories/evaluation-repository";
import { SprintCalculator, type SprintConfig } from "@/domain/sprint";
import { calculateCompletionHours, evaluateByHours } from "@/lib/evaluation/speed";
import { getLinkedIssuesForPR } from "@/lib/github/client";
import type { NewIssue, NewPullRequest } from "@/infrastructure/database/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const repositoryRepo = new RepositoryRepository();
const issueRepo = new IssueRepository();
const prRepo = new PullRequestRepository();
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

    const { id: repoId, ownerName: owner, repoName: repo } = repository;

    // 環境変数からGitHub PATを取得
    const githubPat = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!githubPat) {
      return NextResponse.json(
        { error: "GitHub PATが環境変数に設定されていません" },
        { status: 500 }
      );
    }

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
    let syncedPrCount = 0;
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

      // Full sync: PR取得
      let prPage = 1;
      while (true) {
        const { data: prs } = await octokit.rest.pulls.list({
          owner,
          repo,
          state: "all",
          per_page: perPage,
          page: prPage,
          sort: "updated",
          direction: "desc",
        });

        if (prs.length === 0) break;

        for (const pr of prs) {
          const author = pr.user?.login || "unknown";
          if (trackedUserNames.length > 0 && !trackedUserNames.includes(author)) {
            continue;
          }

          const authorId = await getOrCreateCollaboratorId(author);

          // リンクされたIssueを検索（PR bodyから #123 形式を抽出）
          let linkedIssueId: number | null = null;
          if (pr.body) {
            const issueMatch = pr.body.match(/#(\d+)/);
            if (issueMatch) {
              const issueNumber = parseInt(issueMatch[1], 10);
              const linkedIssue = await issueRepo.findByGithubNumber(repoId, issueNumber);
              linkedIssueId = linkedIssue?.id || null;
            }
          }

          const prData: NewPullRequest = {
            repositoryId: repoId,
            githubNumber: pr.number,
            title: pr.title,
            state: pr.merged_at ? "merged" : pr.state,
            authorCollaboratorId: authorId,
            issueId: linkedIssueId,
            githubCreatedAt: new Date(pr.created_at),
            githubMergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          };

          await prRepo.upsert(prData);
          syncedPrCount++;
        }

        if (prs.length < perPage) break;
        prPage++;
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

      // Incremental sync: PR取得
      // PRは初回同期も含めて全件取得する（PRの数はIssueより少ないため）
      let prPage = 1;
      console.log(`PR sync started. trackedUserNames: ${JSON.stringify(trackedUserNames)}`);

      while (true) {
        const { data: prs } = await octokit.rest.pulls.list({
          owner,
          repo,
          state: "all",
          per_page: perPage,
          page: prPage,
          sort: "updated",
          direction: "desc",
        });

        console.log(`PR page ${prPage}: fetched ${prs.length} PRs`);
        if (prs.length === 0) break;

        for (const pr of prs) {
          const author = pr.user?.login || "unknown";
          console.log(`PR #${pr.number} by ${author}`);

          if (trackedUserNames.length > 0 && !trackedUserNames.includes(author)) {
            console.log(`  -> Skipped: author not in trackedUserNames`);
            continue;
          }

          const authorId = await getOrCreateCollaboratorId(author);

          // 1. GraphQL APIでlinked issuesを取得（優先：UIでリンクされたIssue）
          let linkedIssueId: number | null = null;
          try {
            const linkedIssueNumbers = await getLinkedIssuesForPR(owner, repo, pr.number);
            if (linkedIssueNumbers.length > 0) {
              const linkedIssue = await issueRepo.findByGithubNumber(repoId, linkedIssueNumbers[0]);
              linkedIssueId = linkedIssue?.id || null;
            }
          } catch {
            // GraphQL失敗時は無視（フォールバックへ）
          }

          // 2. フォールバック: PR本文から #N を抽出
          if (!linkedIssueId && pr.body) {
            const issueMatch = pr.body.match(/#(\d+)/);
            if (issueMatch) {
              const issueNumber = parseInt(issueMatch[1], 10);
              const linkedIssue = await issueRepo.findByGithubNumber(repoId, issueNumber);
              linkedIssueId = linkedIssue?.id || null;
            }
          }

          const prData: NewPullRequest = {
            repositoryId: repoId,
            githubNumber: pr.number,
            title: pr.title,
            state: pr.merged_at ? "merged" : pr.state,
            authorCollaboratorId: authorId,
            issueId: linkedIssueId,
            githubCreatedAt: new Date(pr.created_at),
            githubMergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          };

          await prRepo.upsert(prData);
          syncedPrCount++;
        }

        if (prs.length < perPage) break;
        prPage++;
      }
    }

    // 同期メタデータを更新
    await syncMetadataRepo.upsert(repoId, new Date());

    // リードタイム評価を計算・保存（クローズ済みで未評価のIssueのみ）
    const allIssues = await issueRepo.findByRepositoryId(repoId);
    let leadTimeEvaluatedCount = 0;

    for (const issue of allIssues) {
      if (issue.state === "closed" && issue.githubClosedAt) {
        const existingEval = await evaluationRepo.findByIssueId(issue.id);
        if (!existingEval || existingEval.leadTimeScore === null) {
          const hours = calculateCompletionHours(issue.githubCreatedAt, issue.githubClosedAt);
          const speedResult = evaluateByHours(hours);
          await evaluationRepo.saveLeadTimeEvaluation({
            issueId: issue.id,
            score: speedResult.score,
            grade: speedResult.grade,
          });
          leadTimeEvaluatedCount++;
        }
      }
    }
    console.log(`Lead time evaluated: ${leadTimeEvaluatedCount} issues`);

    // 未評価件数をカウント
    let unevaluatedQualityCount = 0;
    let unevaluatedConsistencyCount = 0;

    for (const issue of allIssues) {
      const evaluation = await evaluationRepo.findByIssueId(issue.id);
      if (!evaluation || evaluation.qualityScore === null) {
        unevaluatedQualityCount++;
      }
      if (issue.state === "closed" && (!evaluation || evaluation.consistencyScore === null)) {
        unevaluatedConsistencyCount++;
      }
    }

    return NextResponse.json({
      success: true,
      syncType: needsFullSync ? "full" : "incremental",
      currentSprintNumber,
      stats: {
        synced: syncedCount,
        syncedPrs: syncedPrCount,
        skipped: skippedCount,
        leadTimeEvaluated: leadTimeEvaluatedCount,
      },
      pendingEvaluations: {
        quality: unevaluatedQualityCount,
        consistency: unevaluatedConsistencyCount,
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
