import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { SPEED_CRITERIA } from "@/config/evaluation-criteria";
import { evaluateIssueQuality } from "@/lib/evaluation/quality";
import { evaluateConsistency } from "@/lib/evaluation/consistency";
import { isAIConfigured } from "@/lib/ai";
import { getLinkedPRsForIssue } from "@/lib/github/linked-prs";
import type { Grade } from "@/types/evaluation";
import type { RepositoryConfig, SyncMetadata, StoredIssue } from "@/types/settings";

export const dynamic = "force-dynamic";

// 完了時間から評価を取得
function getGradeFromHours(hours: number): { grade: Grade; score: number; message: string } {
  for (const criterion of SPEED_CRITERIA) {
    if (hours <= criterion.maxHours) {
      return {
        grade: criterion.grade,
        score: criterion.score,
        message: criterion.message,
      };
    }
  }
  const last = SPEED_CRITERIA[SPEED_CRITERIA.length - 1];
  return { grade: last.grade, score: last.score, message: last.message };
}

// スプリント開始日を計算
function getSprintStartDate(date: Date, startDayOfWeek: number): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = (dayOfWeek - startDayOfWeek + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// スプリント番号を計算
function getSprintNumber(
  issueDate: Date,
  baseSprint: Date,
  durationWeeks: number
): number {
  const diffDays = Math.floor(
    (getSprintStartDate(issueDate, baseSprint.getDay()).getTime() - baseSprint.getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return Math.floor(diffDays / (durationWeeks * 7)) + 1;
}

// GitHub IssueをStoredIssue形式に変換（評価フィールドは含まない）
// 品質評価・整合性評価は別途実行し、既存の評価を上書きしないようにする
function convertToStoredIssue(
  issue: {
    number: number;
    title: string;
    body?: string | null;
    state: string;
    created_at: string;
    closed_at: string | null;
    user: { login: string } | null;
    assignee: { login: string } | null;
    html_url: string;
  },
  sprintNumber: number
): Omit<StoredIssue, "qualityEvaluation" | "consistencyEvaluation"> {
  const createdAt = new Date(issue.created_at);
  const closedAt = issue.closed_at ? new Date(issue.closed_at) : null;

  let completionHours: number | null = null;
  let grade: Grade | null = null;
  let score: number | null = null;
  let message: string | null = null;

  if (closedAt) {
    const diffMs = closedAt.getTime() - createdAt.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    completionHours = Math.round(diffHours * 10) / 10;
    const evaluation = getGradeFromHours(diffHours);
    grade = evaluation.grade;
    score = evaluation.score;
    message = evaluation.message;
  }

  return {
    number: issue.number,
    title: issue.title,
    body: issue.body || null,
    state: issue.state as "open" | "closed",
    createdAt: issue.created_at,
    closedAt: issue.closed_at,
    completionHours,
    grade,
    score,
    message,
    creator: issue.user?.login || "unknown",
    assignee: issue.assignee?.login || null,
    url: issue.html_url,
    sprintNumber,
    isArchived: false,
    updatedAt: new Date().toISOString(),
  };
}

// 新規Issueに品質評価フィールドを初期化する関数
async function initializeQualityEvaluationField(
  issuesRef: FirebaseFirestore.CollectionReference
): Promise<number> {
  // qualityEvaluationフィールドが存在しないドキュメントを取得
  // Firestoreでは存在しないフィールドはnullと等しくないため、
  // 全ドキュメントを取得してフィルタリングする必要がある
  const snapshot = await issuesRef.get();

  let initialized = 0;
  const batch = issuesRef.firestore.batch();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    // qualityEvaluationフィールドが存在しない場合のみnullを設定
    if (!("qualityEvaluation" in data)) {
      batch.update(doc.ref, { qualityEvaluation: null });
      initialized++;
    }
  }

  if (initialized > 0) {
    await batch.commit();
  }

  return initialized;
}

// 遅延関数
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 品質評価を実行する関数
async function runQualityEvaluation(
  issuesRef: FirebaseFirestore.CollectionReference,
  options: { maxEvaluations?: number; delayMs?: number } = {}
): Promise<{ evaluated: number; errors: number; initialized: number; total: number }> {
  const { maxEvaluations, delayMs = 1000 } = options; // デフォルト1秒の待機

  // まず、qualityEvaluationフィールドが存在しないドキュメントを初期化
  const initialized = await initializeQualityEvaluationField(issuesRef);
  console.log(`Initialized ${initialized} issues with qualityEvaluation: null`);

  // 品質評価がまだされていないIssueを取得
  let query = issuesRef.where("qualityEvaluation", "==", null);
  if (maxEvaluations) {
    query = query.limit(maxEvaluations);
  }
  const unevaluatedSnapshot = await query.get();
  const total = unevaluatedSnapshot.size;

  console.log(`Found ${total} issues to evaluate`);

  let evaluated = 0;
  let errors = 0;

  for (const doc of unevaluatedSnapshot.docs) {
    const issueData = doc.data() as StoredIssue;

    try {
      console.log(`Evaluating issue #${issueData.number}: ${issueData.title} (${evaluated + 1}/${total})`);

      const evaluation = await evaluateIssueQuality({
        number: issueData.number,
        title: issueData.title,
        body: issueData.body,
        assignee: issueData.assignee,
      });

      await doc.ref.update({
        qualityEvaluation: evaluation,
        updatedAt: new Date().toISOString(),
      });

      evaluated++;
      console.log(`Issue #${issueData.number} evaluated: ${evaluation.grade} (${evaluation.totalScore}点)`);

      // API制限を避けるため、次の評価まで待機（最後の1件は待機不要）
      if (evaluated < total) {
        await delay(delayMs);
      }
    } catch (error: unknown) {
      console.error(`Failed to evaluate issue #${issueData.number}:`, error);
      errors++;

      // レート制限エラーの場合は長めに待機してリトライ
      if (error instanceof Error && error.message?.includes("429")) {
        console.log("Rate limit hit, waiting 60 seconds...");
        await delay(60000);
      }
    }
  }

  return { evaluated, errors, initialized, total };
}

// 新規IssueにPR整合性評価フィールドを初期化する関数
async function initializeConsistencyEvaluationField(
  issuesRef: FirebaseFirestore.CollectionReference
): Promise<number> {
  const snapshot = await issuesRef.get();

  let initialized = 0;
  const batch = issuesRef.firestore.batch();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    // consistencyEvaluationフィールドが存在しない場合のみnullを設定
    if (!("consistencyEvaluation" in data)) {
      batch.update(doc.ref, { consistencyEvaluation: null });
      initialized++;
    }
  }

  if (initialized > 0) {
    await batch.commit();
  }

  return initialized;
}

// PR整合性評価を実行する関数
async function runConsistencyEvaluation(
  issuesRef: FirebaseFirestore.CollectionReference,
  octokit: Octokit,
  owner: string,
  repo: string,
  options: { maxEvaluations?: number; delayMs?: number } = {}
): Promise<{ evaluated: number; errors: number; skipped: number; initialized: number; total: number }> {
  const { maxEvaluations, delayMs = 2000 } = options; // PRの取得があるため長めの待機

  // まず、consistencyEvaluationフィールドが存在しないドキュメントを初期化
  const initialized = await initializeConsistencyEvaluationField(issuesRef);
  console.log(`Initialized ${initialized} issues with consistencyEvaluation: null`);

  // PR整合性評価がまだされていない「クローズ済み」Issueを取得
  // クローズされていないIssueはPRがマージされていない可能性が高いためスキップ
  let query = issuesRef
    .where("consistencyEvaluation", "==", null)
    .where("state", "==", "closed");
  if (maxEvaluations) {
    query = query.limit(maxEvaluations);
  }
  const unevaluatedSnapshot = await query.get();
  const total = unevaluatedSnapshot.size;

  console.log(`Found ${total} closed issues to evaluate for PR consistency`);

  let evaluated = 0;
  let errors = 0;
  let skipped = 0;

  for (const doc of unevaluatedSnapshot.docs) {
    const issueData = doc.data() as StoredIssue;

    try {
      console.log(`Checking linked PRs for issue #${issueData.number}: ${issueData.title} (${evaluated + skipped + 1}/${total})`);

      // リンクされたPRを取得
      const linkedPRs = await getLinkedPRsForIssue(octokit, owner, repo, issueData.number);

      if (linkedPRs.length === 0) {
        console.log(`Issue #${issueData.number} has no linked PRs, skipping`);
        skipped++;
        continue;
      }

      console.log(`Evaluating consistency for issue #${issueData.number} with ${linkedPRs.length} linked PR(s)`);

      const evaluation = await evaluateConsistency(
        {
          number: issueData.number,
          title: issueData.title,
          body: issueData.body,
        },
        linkedPRs
      );

      await doc.ref.update({
        consistencyEvaluation: evaluation,
        updatedAt: new Date().toISOString(),
      });

      evaluated++;
      console.log(`Issue #${issueData.number} consistency evaluated: ${evaluation.grade} (${evaluation.totalScore}点)`);

      // API制限を避けるため、次の評価まで待機
      if (evaluated + skipped < total) {
        await delay(delayMs);
      }
    } catch (error: unknown) {
      console.error(`Failed to evaluate consistency for issue #${issueData.number}:`, error);
      errors++;

      // レート制限エラーの場合は長めに待機
      if (error instanceof Error && error.message?.includes("429")) {
        console.log("Rate limit hit, waiting 60 seconds...");
        await delay(60000);
      }
    }
  }

  return { evaluated, errors, skipped, initialized, total };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const forceFullSync = body.forceFullSync === true;
    const requestedRepoId = body.repoId as string | undefined;

    const db = getAdminFirestore();

    // 設定を取得
    let repoDoc;
    if (requestedRepoId) {
      // 指定されたリポジトリを取得
      const doc = await db.collection("repositories").doc(requestedRepoId).get();
      if (!doc.exists) {
        return NextResponse.json(
          { error: "指定されたリポジトリが見つかりません" },
          { status: 404 }
        );
      }
      repoDoc = doc;
    } else {
      // 後方互換: 最初のアクティブなリポジトリを取得
      const repoSnapshot = await db
        .collection("repositories")
        .where("isActive", "==", true)
        .limit(1)
        .get();

      if (repoSnapshot.empty) {
        return NextResponse.json(
          { error: "設定が見つかりません" },
          { status: 404 }
        );
      }
      repoDoc = repoSnapshot.docs[0];
    }

    const repoId = repoDoc.id;
    const configData = repoDoc.data()!;
    const config: RepositoryConfig = {
      id: repoId,
      owner: configData.owner,
      repo: configData.repo,
      githubPat: configData.githubPat,
      sprint: {
        startDayOfWeek: configData.sprint?.startDayOfWeek ?? 6,
        durationWeeks: configData.sprint?.durationWeeks ?? 1,
        baseDate: configData.sprint?.baseDate || new Date().toISOString(),
      },
      trackedUsers: configData.trackedUsers || [],
      isActive: configData.isActive ?? true,
      createdAt: configData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: configData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };

    const { owner, repo, githubPat, sprint, trackedUsers } = config;

    // 現在のスプリント情報を計算
    const now = new Date();
    const currentSprintStart = getSprintStartDate(now, sprint.startDayOfWeek);
    const baseDate = new Date(sprint.baseDate);
    const baseSprint = getSprintStartDate(baseDate, sprint.startDayOfWeek);
    const currentSprintNumber = getSprintNumber(now, baseSprint, sprint.durationWeeks);

    // 同期メタデータを取得
    const syncMetaRef = db.collection("repositories").doc(repoId).collection("syncMetadata").doc("latest");
    const syncMetaDoc = await syncMetaRef.get();
    const syncMeta = syncMetaDoc.exists ? (syncMetaDoc.data() as SyncMetadata) : null;

    const isNewSprint = !syncMeta || syncMeta.lastSyncSprintNumber !== currentSprintNumber;
    const needsFullSync = forceFullSync || isNewSprint || !syncMeta;

    // Octokitクライアントを作成
    const octokit = new Octokit({ auth: githubPat });

    // 同期統計
    let syncedCount = 0;
    let archivedCount = 0;
    let skippedCount = 0;

    // issuesコレクションへの参照
    const issuesRef = db.collection("repositories").doc(repoId).collection("issues");

    if (needsFullSync) {
      console.log(`Full sync triggered for sprint ${currentSprintNumber}`);

      // 新スプリントの場合、前スプリントのclosedをアーカイブ
      if (isNewSprint && syncMeta) {
        const archivedSnapshot = await issuesRef
          .where("state", "==", "closed")
          .where("isArchived", "==", false)
          .where("sprintNumber", "<", currentSprintNumber)
          .get();

        const archiveBatch = db.batch();
        archivedSnapshot.docs.forEach((doc) => {
          archiveBatch.update(doc.ref, { isArchived: true, updatedAt: new Date().toISOString() });
          archivedCount++;
        });
        await archiveBatch.commit();
      }

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

        const batch = db.batch();

        for (const issue of issues) {
          if (issue.pull_request) continue;

          const creator = issue.user?.login || "unknown";
          if (trackedUsers.length > 0 && !trackedUsers.includes(creator)) {
            skippedCount++;
            continue;
          }

          const issueDate = new Date(issue.created_at);
          const issueSprintNumber = getSprintNumber(issueDate, baseSprint, sprint.durationWeeks);

          // 過去スプリントのclosedはアーカイブ済みとして保存
          const isArchived = issueSprintNumber < currentSprintNumber && issue.state === "closed";

          const storedIssue = convertToStoredIssue(issue, issueSprintNumber);
          storedIssue.isArchived = isArchived;

          const issueDocRef = issuesRef.doc(issue.number.toString());
          batch.set(issueDocRef, storedIssue, { merge: true });
          syncedCount++;
        }

        await batch.commit();

        if (issues.length < perPage) break;
        page++;
      }
    } else {
      console.log(`Incremental sync for sprint ${currentSprintNumber}`);

      // 差分同期: アーカイブされていないIssueのみ更新
      const nonArchivedSnapshot = await issuesRef.where("isArchived", "==", false).get();
      const existingIssueNumbers = new Set(
        nonArchivedSnapshot.docs.map((doc) => parseInt(doc.id, 10))
      );

      // GitHubからopen Issueを取得
      let page = 1;
      const perPage = 100;
      const processedNumbers = new Set<number>();

      while (true) {
        const { data: issues } = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state: "all",
          per_page: perPage,
          page,
          since: syncMeta?.lastSyncAt,
        });

        if (issues.length === 0) break;

        const batch = db.batch();

        for (const issue of issues) {
          if (issue.pull_request) continue;

          const creator = issue.user?.login || "unknown";
          if (trackedUsers.length > 0 && !trackedUsers.includes(creator)) {
            skippedCount++;
            continue;
          }

          const issueDate = new Date(issue.created_at);
          const issueSprintNumber = getSprintNumber(issueDate, baseSprint, sprint.durationWeeks);

          // 過去スプリントのclosedはスキップ（既にアーカイブ済みのはず）
          if (issueSprintNumber < currentSprintNumber && issue.state === "closed") {
            if (!existingIssueNumbers.has(issue.number)) {
              // 新規の過去closedはアーカイブとして保存
              const storedIssue = convertToStoredIssue(issue, issueSprintNumber);
              storedIssue.isArchived = true;
              const issueDocRef = issuesRef.doc(issue.number.toString());
              batch.set(issueDocRef, storedIssue, { merge: true });
              syncedCount++;
            }
            continue;
          }

          const storedIssue = convertToStoredIssue(issue, issueSprintNumber);
          const issueDocRef = issuesRef.doc(issue.number.toString());
          batch.set(issueDocRef, storedIssue, { merge: true });
          processedNumbers.add(issue.number);
          syncedCount++;
        }

        await batch.commit();

        if (issues.length < perPage) break;
        page++;
      }
    }

    // 同期メタデータを更新
    await syncMetaRef.set({
      lastSyncAt: new Date().toISOString(),
      lastSyncSprintNumber: currentSprintNumber,
      lastSyncSprintStart: currentSprintStart.toISOString(),
    });

    // 品質評価を実行（AIプロバイダーのAPIキーが設定されている場合のみ）
    let qualityEvaluationStats = { evaluated: 0, errors: 0, initialized: 0, total: 0 };
    let consistencyEvaluationStats = { evaluated: 0, errors: 0, skipped: 0, initialized: 0, total: 0 };

    if (isAIConfigured()) {
      try {
        // 全ての未評価Issueを品質評価（制限なし、1秒間隔）
        qualityEvaluationStats = await runQualityEvaluation(issuesRef, { delayMs: 1000 });
      } catch (error) {
        console.error("Quality evaluation error:", error);
      }

      try {
        // 全ての未評価クローズ済みIssueをPR整合性評価（制限なし、2秒間隔）
        consistencyEvaluationStats = await runConsistencyEvaluation(
          issuesRef,
          octokit,
          owner,
          repo,
          { delayMs: 2000 }
        );
      } catch (error) {
        console.error("Consistency evaluation error:", error);
      }
    } else {
      console.log("AI provider API key is not set, skipping AI evaluations");
    }

    return NextResponse.json({
      success: true,
      syncType: needsFullSync ? "full" : "incremental",
      currentSprintNumber,
      stats: {
        synced: syncedCount,
        archived: archivedCount,
        skipped: skippedCount,
        qualityTotal: qualityEvaluationStats.total,
        qualityInitialized: qualityEvaluationStats.initialized,
        qualityEvaluated: qualityEvaluationStats.evaluated,
        qualityErrors: qualityEvaluationStats.errors,
        consistencyTotal: consistencyEvaluationStats.total,
        consistencyInitialized: consistencyEvaluationStats.initialized,
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

    const db = getAdminFirestore();

    let repoDoc;
    if (requestedRepoId) {
      const doc = await db.collection("repositories").doc(requestedRepoId).get();
      if (!doc.exists) {
        return NextResponse.json({ needsSync: true, reason: "repo_not_found" });
      }
      repoDoc = doc;
    } else {
      const repoSnapshot = await db
        .collection("repositories")
        .where("isActive", "==", true)
        .limit(1)
        .get();

      if (repoSnapshot.empty) {
        return NextResponse.json({ needsSync: true, reason: "no_config" });
      }
      repoDoc = repoSnapshot.docs[0];
    }

    const repoId = repoDoc.id;
    const configData = repoDoc.data()!;

    const sprint = {
      startDayOfWeek: configData.sprint?.startDayOfWeek ?? 6,
      durationWeeks: configData.sprint?.durationWeeks ?? 1,
      baseDate: configData.sprint?.baseDate || new Date().toISOString(),
    };

    // 現在のスプリント情報
    const now = new Date();
    const baseDate = new Date(sprint.baseDate);
    const baseSprint = getSprintStartDate(baseDate, sprint.startDayOfWeek);
    const currentSprintNumber = getSprintNumber(now, baseSprint, sprint.durationWeeks);

    // 同期メタデータを取得
    const syncMetaRef = db.collection("repositories").doc(repoId).collection("syncMetadata").doc("latest");
    const syncMetaDoc = await syncMetaRef.get();

    if (!syncMetaDoc.exists) {
      return NextResponse.json({
        needsSync: true,
        reason: "never_synced",
        currentSprintNumber,
      });
    }

    const syncMeta = syncMetaDoc.data() as SyncMetadata;
    const isNewSprint = syncMeta.lastSyncSprintNumber !== currentSprintNumber;

    return NextResponse.json({
      needsSync: isNewSprint,
      reason: isNewSprint ? "new_sprint" : "up_to_date",
      currentSprintNumber,
      lastSync: syncMeta,
    });
  } catch (error) {
    console.error("Sync status check error:", error);
    return NextResponse.json(
      { error: "同期状態の確認に失敗しました" },
      { status: 500 }
    );
  }
}
