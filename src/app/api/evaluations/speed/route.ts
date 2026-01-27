import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { evaluateIssueSpeed } from "@/lib/evaluation/speed";
import type { Issue } from "@/types/issue";

export const dynamic = "force-dynamic";

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

    const db = getAdminFirestore();

    // リポジトリ存在確認
    const repoDoc = await db.collection("repositories").doc(repositoryId).get();
    if (!repoDoc.exists) {
      return NextResponse.json(
        { error: "リポジトリが見つかりません", message: "Repository not found" },
        { status: 404 }
      );
    }

    // 評価対象のIssueを取得
    const issuesQuery = db
      .collection("repositories")
      .doc(repositoryId)
      .collection("issues")
      .where("state", "==", "closed");

    const snapshot = await issuesQuery.get();

    let issues: Issue[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        number: data.number,
        title: data.title,
        body: data.body,
        state: data.state,
        createdAt: data.createdAt?.toDate() || new Date(),
        closedAt: data.closedAt?.toDate() || null,
        assignee: data.assignee,
        labels: data.labels || [],
        githubId: data.githubId,
        speedEvaluation: data.speedEvaluation || null,
        qualityEvaluation: data.qualityEvaluation || null,
        syncedAt: data.syncedAt?.toDate() || new Date(),
      };
    });

    // 特定のIssueIDが指定されている場合はフィルタ
    if (issueIds && Array.isArray(issueIds) && issueIds.length > 0) {
      issues = issues.filter((issue) => issueIds.includes(issue.id));
    }

    // 評価を実行し、結果を保存
    const results: Array<{
      issueId: string;
      issueNumber: number;
      score: number;
      grade: string;
      message: string;
    }> = [];

    const batch = db.batch();

    for (const issue of issues) {
      const evaluation = evaluateIssueSpeed(issue);

      if (evaluation) {
        // Firestoreに保存
        const issueRef = db
          .collection("repositories")
          .doc(repositoryId)
          .collection("issues")
          .doc(issue.id);

        batch.update(issueRef, {
          speedEvaluation: {
            score: evaluation.score,
            grade: evaluation.grade,
            message: evaluation.message,
            details: evaluation.details,
            evaluatedAt: evaluation.evaluatedAt,
          },
        });

        results.push({
          issueId: issue.id,
          issueNumber: issue.number,
          score: evaluation.score,
          grade: evaluation.grade,
          message: evaluation.message,
        });
      }
    }

    await batch.commit();

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
