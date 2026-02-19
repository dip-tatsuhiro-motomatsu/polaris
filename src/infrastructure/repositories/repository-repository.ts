/**
 * リポジトリの永続化実装
 */

import { eq, and } from "drizzle-orm";
import { db } from "../database";
import { repositories, type Repository, type NewRepository } from "../database/schema";

export class RepositoryRepository {
  /**
   * リポジトリを作成する
   */
  async create(data: NewRepository): Promise<Repository> {
    const [repository] = await db.insert(repositories).values(data).returning();
    return repository;
  }

  /**
   * リポジトリをIDで取得する
   */
  async findById(id: number): Promise<Repository | null> {
    const [repository] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1);
    return repository ?? null;
  }

  /**
   * リポジトリをオーナー名とリポジトリ名で取得する
   */
  async findByOwnerAndRepo(ownerName: string, repoName: string): Promise<Repository | null> {
    const [repository] = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.ownerName, ownerName),
          eq(repositories.repoName, repoName)
        )
      )
      .limit(1);
    return repository ?? null;
  }

  /**
   * 全てのリポジトリを取得する
   */
  async findAll(): Promise<Repository[]> {
    return db.select().from(repositories);
  }

  /**
   * リポジトリを更新する
   */
  async update(id: number, data: Partial<NewRepository>): Promise<Repository | null> {
    const [repository] = await db
      .update(repositories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(repositories.id, id))
      .returning();
    return repository ?? null;
  }

  /**
   * リポジトリを削除する
   */
  async delete(id: number): Promise<boolean> {
    const result = await db.delete(repositories).where(eq(repositories.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}
