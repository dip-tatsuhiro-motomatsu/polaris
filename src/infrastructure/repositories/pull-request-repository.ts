/**
 * PullRequestの永続化実装
 */

import { eq, and } from "drizzle-orm";
import { db } from "../database";
import { pullRequests, type PullRequest, type NewPullRequest } from "../database/schema";

export class PullRequestRepository {
  /**
   * PullRequestを作成する
   */
  async create(data: NewPullRequest): Promise<PullRequest> {
    const [pr] = await db.insert(pullRequests).values(data).returning();
    return pr;
  }

  /**
   * PullRequestをupsertする（存在すれば更新、なければ挿入）
   */
  async upsert(data: NewPullRequest): Promise<PullRequest> {
    const [pr] = await db
      .insert(pullRequests)
      .values(data)
      .onConflictDoUpdate({
        target: [pullRequests.repositoryId, pullRequests.githubNumber],
        set: {
          title: data.title,
          state: data.state,
          issueId: data.issueId,
          authorCollaboratorId: data.authorCollaboratorId,
          githubMergedAt: data.githubMergedAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return pr;
  }

  /**
   * 複数のPullRequestを一括upsertする
   */
  async upsertMany(dataList: NewPullRequest[]): Promise<PullRequest[]> {
    if (dataList.length === 0) return [];

    const result = await db
      .insert(pullRequests)
      .values(dataList)
      .onConflictDoUpdate({
        target: [pullRequests.repositoryId, pullRequests.githubNumber],
        set: {
          title: pullRequests.title,
          state: pullRequests.state,
          issueId: pullRequests.issueId,
          authorCollaboratorId: pullRequests.authorCollaboratorId,
          githubMergedAt: pullRequests.githubMergedAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  /**
   * PullRequestをIDで取得する
   */
  async findById(id: number): Promise<PullRequest | null> {
    const [pr] = await db
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.id, id))
      .limit(1);
    return pr ?? null;
  }

  /**
   * リポジトリIDでPullRequest一覧を取得する
   */
  async findByRepositoryId(repositoryId: number): Promise<PullRequest[]> {
    return db
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.repositoryId, repositoryId));
  }

  /**
   * リポジトリIDとgithubNumberでPullRequestを取得する
   */
  async findByGithubNumber(
    repositoryId: number,
    githubNumber: number
  ): Promise<PullRequest | null> {
    const [pr] = await db
      .select()
      .from(pullRequests)
      .where(
        and(
          eq(pullRequests.repositoryId, repositoryId),
          eq(pullRequests.githubNumber, githubNumber)
        )
      )
      .limit(1);
    return pr ?? null;
  }

  /**
   * IssueIDでリンクされたPullRequestを取得する
   */
  async findByIssueId(issueId: number): Promise<PullRequest[]> {
    return db
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.issueId, issueId));
  }

  /**
   * PullRequestを更新する
   */
  async update(id: number, data: Partial<NewPullRequest>): Promise<PullRequest | null> {
    const [pr] = await db
      .update(pullRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pullRequests.id, id))
      .returning();
    return pr ?? null;
  }

  /**
   * PullRequestをIssueに紐付ける
   */
  async linkToIssue(id: number, issueId: number): Promise<PullRequest | null> {
    return this.update(id, { issueId });
  }

  /**
   * PullRequestを削除する
   */
  async delete(id: number): Promise<boolean> {
    const result = await db.delete(pullRequests).where(eq(pullRequests.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * リポジトリIDで全てのPullRequestを削除する
   */
  async deleteByRepositoryId(repositoryId: number): Promise<number> {
    const result = await db
      .delete(pullRequests)
      .where(eq(pullRequests.repositoryId, repositoryId));
    return result.rowCount ?? 0;
  }
}
