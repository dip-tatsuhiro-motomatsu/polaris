/**
 * コラボレーターの永続化実装
 */

import { eq, and } from "drizzle-orm";
import { db } from "../database";
import { collaborators, type Collaborator, type NewCollaborator } from "../database/schema";

export class CollaboratorRepository {
  /**
   * コラボレーターを作成する
   */
  async create(data: NewCollaborator): Promise<Collaborator> {
    const [collaborator] = await db.insert(collaborators).values(data).returning();
    return collaborator;
  }

  /**
   * 複数のコラボレーターを一括作成する
   */
  async createMany(dataList: NewCollaborator[]): Promise<Collaborator[]> {
    if (dataList.length === 0) return [];
    const result = await db.insert(collaborators).values(dataList).returning();
    return result;
  }

  /**
   * コラボレーターをIDで取得する
   */
  async findById(id: number): Promise<Collaborator | null> {
    const [collaborator] = await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.id, id))
      .limit(1);
    return collaborator ?? null;
  }

  /**
   * リポジトリIDでコラボレーター一覧を取得する
   */
  async findByRepositoryId(repositoryId: number): Promise<Collaborator[]> {
    return db
      .select()
      .from(collaborators)
      .where(eq(collaborators.repositoryId, repositoryId));
  }

  /**
   * リポジトリIDとGitHubユーザー名でコラボレーターを取得する
   */
  async findByRepositoryAndGithubUser(
    repositoryId: number,
    githubUserName: string
  ): Promise<Collaborator | null> {
    const [collaborator] = await db
      .select()
      .from(collaborators)
      .where(
        and(
          eq(collaborators.repositoryId, repositoryId),
          eq(collaborators.githubUserName, githubUserName)
        )
      )
      .limit(1);
    return collaborator ?? null;
  }

  /**
   * コラボレーターを更新する
   */
  async update(id: number, data: Partial<NewCollaborator>): Promise<Collaborator | null> {
    const [collaborator] = await db
      .update(collaborators)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(collaborators.id, id))
      .returning();
    return collaborator ?? null;
  }

  /**
   * コラボレーターを削除する
   */
  async delete(id: number): Promise<boolean> {
    const result = await db.delete(collaborators).where(eq(collaborators.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * リポジトリIDで全てのコラボレーターを削除する
   */
  async deleteByRepositoryId(repositoryId: number): Promise<number> {
    const result = await db
      .delete(collaborators)
      .where(eq(collaborators.repositoryId, repositoryId));
    return result.rowCount ?? 0;
  }
}
