/**
 * 評価結果の永続化実装
 */

import { eq } from "drizzle-orm";
import { db } from "../database";
import {
  evaluations,
  type Evaluation,
  type QualityDetails,
  type ConsistencyDetails,
} from "../database/schema";

export interface SaveQualityEvaluationInput {
  issueId: number;
  score: number;
  grade: string;
  details: QualityDetails;
}

export interface SaveConsistencyEvaluationInput {
  issueId: number;
  score: number;
  grade: string;
  details: ConsistencyDetails;
}

export interface SaveLeadTimeEvaluationInput {
  issueId: number;
  score: number;
  grade: string;
}

export class EvaluationRepository {
  /**
   * 評価レコードを作成または取得する
   */
  private async ensureEvaluationRecord(issueId: number): Promise<Evaluation> {
    const [existing] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.issueId, issueId))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(evaluations)
      .values({ issueId })
      .returning();
    return created;
  }

  /**
   * 品質評価を保存する
   */
  async saveQualityEvaluation(input: SaveQualityEvaluationInput): Promise<Evaluation> {
    await this.ensureEvaluationRecord(input.issueId);

    const [updated] = await db
      .update(evaluations)
      .set({
        qualityScore: input.score,
        qualityGrade: input.grade,
        qualityDetails: input.details,
        qualityCalculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(evaluations.issueId, input.issueId))
      .returning();

    return updated;
  }

  /**
   * 整合性評価を保存する
   */
  async saveConsistencyEvaluation(input: SaveConsistencyEvaluationInput): Promise<Evaluation> {
    await this.ensureEvaluationRecord(input.issueId);

    const [updated] = await db
      .update(evaluations)
      .set({
        consistencyScore: input.score,
        consistencyGrade: input.grade,
        consistencyDetails: input.details,
        consistencyCalculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(evaluations.issueId, input.issueId))
      .returning();

    return updated;
  }

  /**
   * リードタイム評価を保存する
   */
  async saveLeadTimeEvaluation(input: SaveLeadTimeEvaluationInput): Promise<Evaluation> {
    await this.ensureEvaluationRecord(input.issueId);

    const [updated] = await db
      .update(evaluations)
      .set({
        leadTimeScore: input.score,
        leadTimeGrade: input.grade,
        leadTimeCalculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(evaluations.issueId, input.issueId))
      .returning();

    return updated;
  }

  /**
   * IssueIDで評価を取得する
   */
  async findByIssueId(issueId: number): Promise<Evaluation | null> {
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.issueId, issueId))
      .limit(1);
    return evaluation ?? null;
  }

  /**
   * 評価IDで取得する
   */
  async findById(id: number): Promise<Evaluation | null> {
    const [evaluation] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, id))
      .limit(1);
    return evaluation ?? null;
  }

  /**
   * 評価を削除する
   */
  async deleteByIssueId(issueId: number): Promise<boolean> {
    const result = await db
      .delete(evaluations)
      .where(eq(evaluations.issueId, issueId));
    return (result.rowCount ?? 0) > 0;
  }
}
