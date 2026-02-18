/**
 * 同期メタデータの永続化実装
 */

import { eq } from "drizzle-orm";
import { db } from "../database";
import {
  syncMetadata,
  type SyncMetadata,
  type NewSyncMetadata,
} from "../database/schema";

export class SyncMetadataRepository {
  /**
   * 同期メタデータを作成する
   */
  async create(data: NewSyncMetadata): Promise<SyncMetadata> {
    const [metadata] = await db
      .insert(syncMetadata)
      .values(data)
      .returning();
    return metadata;
  }

  /**
   * リポジトリIDで同期メタデータを取得する
   */
  async findByRepositoryId(repositoryId: number): Promise<SyncMetadata | null> {
    const [metadata] = await db
      .select()
      .from(syncMetadata)
      .where(eq(syncMetadata.repositoryId, repositoryId))
      .limit(1);
    return metadata ?? null;
  }

  /**
   * 同期メタデータを更新する（なければ作成）
   */
  async upsert(repositoryId: number, lastSyncAt: Date): Promise<SyncMetadata> {
    const existing = await this.findByRepositoryId(repositoryId);

    if (existing) {
      const [updated] = await db
        .update(syncMetadata)
        .set({
          lastSyncAt,
          updatedAt: new Date(),
        })
        .where(eq(syncMetadata.repositoryId, repositoryId))
        .returning();
      return updated;
    }

    return this.create({
      repositoryId,
      lastSyncAt,
    });
  }

  /**
   * 最終同期日時を更新する
   */
  async updateLastSyncAt(repositoryId: number, lastSyncAt: Date): Promise<SyncMetadata | null> {
    const [metadata] = await db
      .update(syncMetadata)
      .set({
        lastSyncAt,
        updatedAt: new Date(),
      })
      .where(eq(syncMetadata.repositoryId, repositoryId))
      .returning();
    return metadata ?? null;
  }

  /**
   * 同期メタデータを削除する
   */
  async deleteByRepositoryId(repositoryId: number): Promise<boolean> {
    const result = await db
      .delete(syncMetadata)
      .where(eq(syncMetadata.repositoryId, repositoryId));
    return (result.rowCount ?? 0) > 0;
  }
}
