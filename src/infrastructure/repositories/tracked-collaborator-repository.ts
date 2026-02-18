/**
 * 追跡対象コラボレーターの永続化実装
 */

import { eq, and } from "drizzle-orm";
import { db } from "../database";
import {
  trackedCollaborators,
  collaborators,
  type TrackedCollaborator,
  type NewTrackedCollaborator,
  type Collaborator,
} from "../database/schema";

export class TrackedCollaboratorRepository {
  /**
   * 追跡対象コラボレーターを追加する
   */
  async create(data: NewTrackedCollaborator): Promise<TrackedCollaborator> {
    const [tracked] = await db
      .insert(trackedCollaborators)
      .values(data)
      .returning();
    return tracked;
  }

  /**
   * 複数の追跡対象コラボレーターを一括追加する
   */
  async createMany(dataList: NewTrackedCollaborator[]): Promise<TrackedCollaborator[]> {
    if (dataList.length === 0) return [];
    const result = await db
      .insert(trackedCollaborators)
      .values(dataList)
      .returning();
    return result;
  }

  /**
   * リポジトリIDで追跡対象コラボレーターを取得する
   */
  async findByRepositoryId(repositoryId: number): Promise<TrackedCollaborator[]> {
    return db
      .select()
      .from(trackedCollaborators)
      .where(eq(trackedCollaborators.repositoryId, repositoryId));
  }

  /**
   * リポジトリIDで追跡対象コラボレーターの詳細情報を取得する
   * （collaboratorsテーブルとJOIN）
   */
  async findWithCollaboratorsByRepositoryId(
    repositoryId: number
  ): Promise<(TrackedCollaborator & { collaborator: Collaborator })[]> {
    const result = await db
      .select({
        tracked: trackedCollaborators,
        collaborator: collaborators,
      })
      .from(trackedCollaborators)
      .innerJoin(
        collaborators,
        eq(trackedCollaborators.collaboratorId, collaborators.id)
      )
      .where(eq(trackedCollaborators.repositoryId, repositoryId));

    return result.map((row) => ({
      ...row.tracked,
      collaborator: row.collaborator,
    }));
  }

  /**
   * リポジトリIDで追跡対象のGitHubユーザー名一覧を取得する
   */
  async findTrackedUserNamesByRepositoryId(repositoryId: number): Promise<string[]> {
    const result = await db
      .select({ githubUserName: collaborators.githubUserName })
      .from(trackedCollaborators)
      .innerJoin(
        collaborators,
        eq(trackedCollaborators.collaboratorId, collaborators.id)
      )
      .where(eq(trackedCollaborators.repositoryId, repositoryId));

    return result.map((row) => row.githubUserName);
  }

  /**
   * 追跡対象かどうかを確認する
   */
  async isTracked(repositoryId: number, collaboratorId: number): Promise<boolean> {
    const [tracked] = await db
      .select()
      .from(trackedCollaborators)
      .where(
        and(
          eq(trackedCollaborators.repositoryId, repositoryId),
          eq(trackedCollaborators.collaboratorId, collaboratorId)
        )
      )
      .limit(1);
    return !!tracked;
  }

  /**
   * 追跡対象から削除する
   */
  async delete(repositoryId: number, collaboratorId: number): Promise<boolean> {
    const result = await db
      .delete(trackedCollaborators)
      .where(
        and(
          eq(trackedCollaborators.repositoryId, repositoryId),
          eq(trackedCollaborators.collaboratorId, collaboratorId)
        )
      );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * リポジトリIDで全ての追跡対象を削除する
   */
  async deleteByRepositoryId(repositoryId: number): Promise<number> {
    const result = await db
      .delete(trackedCollaborators)
      .where(eq(trackedCollaborators.repositoryId, repositoryId));
    return result.rowCount ?? 0;
  }

  /**
   * 追跡対象を置き換える（既存を削除して新規作成）
   */
  async replaceByRepositoryId(
    repositoryId: number,
    collaboratorIds: number[]
  ): Promise<TrackedCollaborator[]> {
    // 既存を削除
    await this.deleteByRepositoryId(repositoryId);

    // 新規作成
    if (collaboratorIds.length === 0) return [];

    const dataList: NewTrackedCollaborator[] = collaboratorIds.map((collaboratorId) => ({
      repositoryId,
      collaboratorId,
    }));

    return this.createMany(dataList);
  }
}
