/**
 * 未評価のIssueを全て評価するワンショットスクリプト
 * レート制限対応: 429エラー時は待機してリトライ
 *
 * 実行方法:
 * npm run fill-evaluations
 */

// 環境変数を最初に読み込む（.envと.env.local両方）
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

// 動的インポートで環境変数読み込み後にモジュールを取得
async function main() {
  const { Octokit } = await import("@octokit/rest");
  const { RepositoryRepository } = await import("@/infrastructure/repositories/repository-repository");
  const { IssueRepository } = await import("@/infrastructure/repositories/issue-repository");
  const { PullRequestRepository } = await import("@/infrastructure/repositories/pull-request-repository");
  const { CollaboratorRepository } = await import("@/infrastructure/repositories/collaborator-repository");
  const { EvaluationRepository } = await import("@/infrastructure/repositories/evaluation-repository");
  const { evaluateIssueQuality } = await import("@/lib/evaluation/quality");
  const { evaluateConsistency } = await import("@/lib/evaluation/consistency");
  const { calculateCompletionHours, evaluateByHours } = await import("@/lib/evaluation/speed");
  const { getLinkedPRsForIssue, getPRDetails } = await import("@/lib/github/linked-prs");
  const schema = await import("@/infrastructure/database/schema");
  type Issue = typeof schema.Issue;
  type Evaluation = typeof schema.Evaluation;

  const repositoryRepo = new RepositoryRepository();
  const issueRepo = new IssueRepository();
  const prRepo = new PullRequestRepository();
  const collaboratorRepo = new CollaboratorRepository();
  const evaluationRepo = new EvaluationRepository();

  // 設定
  const INITIAL_DELAY_MS = 2000; // 通常の待機時間
  const RATE_LIMIT_DELAY_MS = 60000; // レート制限時の待機時間（60秒）
  const MAX_RETRIES = 5;

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function withRateLimitRetry<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T | null> {
    let retries = 0;

    while (retries < MAX_RETRIES) {
      try {
        return await fn();
      } catch (error: unknown) {
        const isRateLimit =
          error instanceof Error &&
          (error.message.includes("429") ||
            error.message.includes("rate") ||
            error.message.includes("quota") ||
            error.message.includes("Resource has been exhausted"));

        if (isRateLimit) {
          retries++;
          const waitTime = RATE_LIMIT_DELAY_MS * retries; // 指数バックオフ
          console.log(
            `\n⏳ [${context}] レート制限検出。${waitTime / 1000}秒待機します... (リトライ ${retries}/${MAX_RETRIES})`
          );
          await delay(waitTime);
        } else {
          console.error(`\n❌ [${context}] エラー:`, error);
          return null;
        }
      }
    }

    console.error(`\n❌ [${context}] 最大リトライ回数に達しました`);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function fillLeadTimeScores(issues: any[]): Promise<number> {
    console.log("\n📊 リードタイム評価を開始...");

    let evaluated = 0;

    for (const issue of issues) {
      if (issue.state !== "closed" || !issue.githubClosedAt) {
        continue;
      }

      const existingEval = await evaluationRepo.findByIssueId(issue.id);
      if (existingEval && existingEval.leadTimeScore !== null) {
        continue;
      }

      const hours = calculateCompletionHours(issue.githubCreatedAt, issue.githubClosedAt);
      const speedResult = evaluateByHours(hours);

      await evaluationRepo.saveLeadTimeEvaluation({
        issueId: issue.id,
        score: speedResult.score,
        grade: speedResult.grade,
      });

      evaluated++;
      console.log(
        `  ✓ Issue #${issue.githubNumber}: ${speedResult.grade} (${Math.round(hours)}時間)`
      );
    }

    return evaluated;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function fillQualityScores(issues: any[]): Promise<{ evaluated: number; errors: number }> {
    console.log("\n🔍 品質評価を開始...");

    let evaluated = 0;
    let errors = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unevaluatedIssues: { issue: any; evaluation: any }[] = [];

    for (const issue of issues) {
      const evaluation = await evaluationRepo.findByIssueId(issue.id);
      if (!evaluation || evaluation.qualityScore === null) {
        unevaluatedIssues.push({ issue, evaluation });
      }
    }

    console.log(`  未評価: ${unevaluatedIssues.length}件`);

    for (const { issue } of unevaluatedIssues) {
      const result = await withRateLimitRetry(async () => {
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

        return qualityResult;
      }, `Quality Issue #${issue.githubNumber}`);

      if (result) {
        evaluated++;
        console.log(
          `  ✓ Issue #${issue.githubNumber}: ${result.grade} (${result.totalScore}点) - ${issue.title.substring(0, 40)}...`
        );
      } else {
        errors++;
      }

      // 通常の待機
      await delay(INITIAL_DELAY_MS);
    }

    return { evaluated, errors };
  }

  async function fillConsistencyScores(
    repository: { id: number; ownerName: string; repoName: string },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    issues: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokit: any
  ): Promise<{ evaluated: number; errors: number; skipped: number }> {
    console.log("\n🔗 整合性評価を開始...");

    let evaluated = 0;
    let errors = 0;
    let skipped = 0;

    const closedIssues = issues.filter((issue) => issue.state === "closed");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unevaluatedIssues: any[] = [];

    for (const issue of closedIssues) {
      const evaluation = await evaluationRepo.findByIssueId(issue.id);
      if (!evaluation || evaluation.consistencyScore === null) {
        unevaluatedIssues.push(issue);
      }
    }

    console.log(`  未評価: ${unevaluatedIssues.length}件`);

    for (const issue of unevaluatedIssues) {
      // 1. PRテーブルからissueIdでリンクされたPRを検索
      const dbLinkedPRs = await prRepo.findByIssueId(issue.id);
      let linkedPRs: Awaited<ReturnType<typeof getLinkedPRsForIssue>> = [];

      if (dbLinkedPRs.length > 0) {
        for (const dbPr of dbLinkedPRs) {
          try {
            const prDetails = await getPRDetails(
              octokit,
              repository.ownerName,
              repository.repoName,
              dbPr.githubNumber
            );
            if (prDetails) {
              linkedPRs.push(prDetails);
            }
          } catch (err) {
            console.log(`    ⚠ PR #${dbPr.githubNumber}の詳細取得失敗`);
          }
        }
      }

      // 2. フォールバック: GitHub APIでlinked PRsを検索
      if (linkedPRs.length === 0) {
        linkedPRs = await getLinkedPRsForIssue(
          octokit,
          repository.ownerName,
          repository.repoName,
          issue.githubNumber
        );
      }

      if (linkedPRs.length === 0) {
        console.log(`  ⏭ Issue #${issue.githubNumber}: リンクされたPRなし`);
        skipped++;
        continue;
      }

      const result = await withRateLimitRetry(async () => {
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

        return consistencyResult;
      }, `Consistency Issue #${issue.githubNumber}`);

      if (result) {
        evaluated++;
        console.log(
          `  ✓ Issue #${issue.githubNumber}: ${result.grade} (${result.totalScore}点) - ${linkedPRs.length}個のPR`
        );
      } else {
        errors++;
      }

      // 通常の待機
      await delay(INITIAL_DELAY_MS);
    }

    return { evaluated, errors, skipped };
  }

  console.log("🚀 未評価Issue一括評価スクリプトを開始します...\n");

  // GitHub PAT確認
  const githubPat = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!githubPat) {
    console.error("❌ GITHUB_PERSONAL_ACCESS_TOKEN が設定されていません");
    process.exit(1);
  }

  // リポジトリ取得
  const allRepos = await repositoryRepo.findAll();
  if (allRepos.length === 0) {
    console.error("❌ リポジトリが設定されていません");
    process.exit(1);
  }
  const repository = allRepos[0];
  console.log(`📁 リポジトリ: ${repository.ownerName}/${repository.repoName}`);

  // 全Issue取得
  const allIssues = await issueRepo.findByRepositoryId(repository.id);
  console.log(`📋 Issue総数: ${allIssues.length}件`);

  const octokit = new Octokit({ auth: githubPat });

  // 1. リードタイム評価
  const leadTimeCount = await fillLeadTimeScores(allIssues);
  console.log(`\n✅ リードタイム評価完了: ${leadTimeCount}件`);

  // 2. 品質評価
  const qualityResult = await fillQualityScores(allIssues);
  console.log(`\n✅ 品質評価完了: ${qualityResult.evaluated}件 (エラー: ${qualityResult.errors}件)`);

  // 3. 整合性評価
  const consistencyResult = await fillConsistencyScores(
    {
      id: repository.id,
      ownerName: repository.ownerName,
      repoName: repository.repoName,
    },
    allIssues,
    octokit
  );
  console.log(
    `\n✅ 整合性評価完了: ${consistencyResult.evaluated}件 (スキップ: ${consistencyResult.skipped}件, エラー: ${consistencyResult.errors}件)`
  );

  console.log("\n🎉 全ての評価が完了しました！");
}

main().catch((error) => {
  console.error("❌ スクリプトエラー:", error);
  process.exit(1);
});
