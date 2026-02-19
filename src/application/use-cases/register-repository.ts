/**
 * リポジトリ登録ユースケース
 */

import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import type { Repository } from "@/infrastructure/database/schema";

export interface RegisterRepositoryInput {
  ownerName: string;
  repoName: string;
  trackingStartDate?: string;
  sprintDurationWeeks?: number;
}

export interface RegisterRepositoryOutput {
  success: boolean;
  repository?: Repository;
  error?: string;
}

export class RegisterRepositoryUseCase {
  private repositoryRepository: RepositoryRepository;

  constructor(repositoryRepository?: RepositoryRepository) {
    this.repositoryRepository = repositoryRepository ?? new RepositoryRepository();
  }

  async execute(input: RegisterRepositoryInput): Promise<RegisterRepositoryOutput> {
    // バリデーション
    if (!input.ownerName || !input.repoName) {
      return { success: false, error: "オーナー名とリポジトリ名は必須です" };
    }

    const sprintDurationWeeks = input.sprintDurationWeeks ?? 1;
    if (sprintDurationWeeks !== 1 && sprintDurationWeeks !== 2) {
      return { success: false, error: "スプリント周期は1または2週間である必要があります" };
    }

    // 重複チェック
    const existing = await this.repositoryRepository.findByOwnerAndRepo(
      input.ownerName,
      input.repoName
    );

    if (existing) {
      return { success: false, error: "このリポジトリは既に登録されています" };
    }

    // 登録
    const repository = await this.repositoryRepository.create({
      ownerName: input.ownerName,
      repoName: input.repoName,
      trackingStartDate: input.trackingStartDate,
      sprintDurationWeeks,
    });

    return { success: true, repository };
  }
}
