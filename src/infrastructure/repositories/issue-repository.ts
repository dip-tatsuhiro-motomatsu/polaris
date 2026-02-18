/**
 * Issueの永続化実装
 */

import { eq, and } from "drizzle-orm";
import { db } from "../database";
import { issues, type Issue, type NewIssue } from "../database/schema";

export class IssueRepository {
  /**
   * Issueを作成する
   */
  async create(data: NewIssue): Promise<Issue> {
    const [issue] = await db.insert(issues).values(data).returning();
    return issue;
  }

  /**
   * Issueをupsertする（存在すれば更新、なければ挿入）
   */
  async upsert(data: NewIssue): Promise<Issue> {
    const [issue] = await db
      .insert(issues)
      .values(data)
      .onConflictDoUpdate({
        target: [issues.repositoryId, issues.githubNumber],
        set: {
          title: data.title,
          body: data.body,
          state: data.state,
          authorCollaboratorId: data.authorCollaboratorId,
          assigneeCollaboratorId: data.assigneeCollaboratorId,
          sprintNumber: data.sprintNumber,
          githubClosedAt: data.githubClosedAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return issue;
  }

  /**
   * 複数のIssueを一括upsertする
   */
  async upsertMany(dataList: NewIssue[]): Promise<Issue[]> {
    if (dataList.length === 0) return [];

    const result = await db
      .insert(issues)
      .values(dataList)
      .onConflictDoUpdate({
        target: [issues.repositoryId, issues.githubNumber],
        set: {
          title: issues.title,
          body: issues.body,
          state: issues.state,
          authorCollaboratorId: issues.authorCollaboratorId,
          assigneeCollaboratorId: issues.assigneeCollaboratorId,
          sprintNumber: issues.sprintNumber,
          githubClosedAt: issues.githubClosedAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  /**
   * IssueをIDで取得する
   */
  async findById(id: number): Promise<Issue | null> {
    const [issue] = await db
      .select()
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1);
    return issue ?? null;
  }

  /**
   * リポジトリIDでIssue一覧を取得する
   */
  async findByRepositoryId(repositoryId: number): Promise<Issue[]> {
    return db.select().from(issues).where(eq(issues.repositoryId, repositoryId));
  }

  /**
   * リポジトリIDとスプリント番号でIssue一覧を取得する
   */
  async findBySprintNumber(
    repositoryId: number,
    sprintNumber: number
  ): Promise<Issue[]> {
    return db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.repositoryId, repositoryId),
          eq(issues.sprintNumber, sprintNumber)
        )
      );
  }

  /**
   * リポジトリIDとgithubNumberでIssueを取得する
   */
  async findByGithubNumber(
    repositoryId: number,
    githubNumber: number
  ): Promise<Issue | null> {
    const [issue] = await db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.repositoryId, repositoryId),
          eq(issues.githubNumber, githubNumber)
        )
      )
      .limit(1);
    return issue ?? null;
  }

  /**
   * Issueを更新する
   */
  async update(id: number, data: Partial<NewIssue>): Promise<Issue | null> {
    const [issue] = await db
      .update(issues)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(issues.id, id))
      .returning();
    return issue ?? null;
  }

  /**
   * Issueを削除する
   */
  async delete(id: number): Promise<boolean> {
    const result = await db.delete(issues).where(eq(issues.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * リポジトリIDで全てのIssueを削除する
   */
  async deleteByRepositoryId(repositoryId: number): Promise<number> {
    const result = await db
      .delete(issues)
      .where(eq(issues.repositoryId, repositoryId));
    return result.rowCount ?? 0;
  }
}
