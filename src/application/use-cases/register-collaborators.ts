/**
 * コラボレーター登録ユースケース
 *
 * GitHubからコントリビューターを取得し、コラボレーターとしてDBに登録する。
 */

import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { CollaboratorRepository } from "@/infrastructure/repositories/collaborator-repository";
import { getContributors } from "@/lib/github/client";
import type { Collaborator, NewCollaborator } from "@/infrastructure/database/schema";

export interface RegisterCollaboratorsInput {
  repositoryId: number;
  /** 指定された場合、このユーザーのみ登録する */
  selectedGithubUsers?: string[];
}

export interface RegisterCollaboratorsOutput {
  success: boolean;
  collaborators?: Collaborator[];
  error?: string;
}

export class RegisterCollaboratorsUseCase {
  private repositoryRepository: RepositoryRepository;
  private collaboratorRepository: CollaboratorRepository;

  constructor(
    repositoryRepository?: RepositoryRepository,
    collaboratorRepository?: CollaboratorRepository
  ) {
    this.repositoryRepository = repositoryRepository ?? new RepositoryRepository();
    this.collaboratorRepository = collaboratorRepository ?? new CollaboratorRepository();
  }

  async execute(input: RegisterCollaboratorsInput): Promise<RegisterCollaboratorsOutput> {
    // リポジトリの存在確認
    const repository = await this.repositoryRepository.findById(input.repositoryId);
    if (!repository) {
      return { success: false, error: "リポジトリが見つかりません" };
    }

    // GitHubからコントリビューター取得
    let githubContributors;
    try {
      githubContributors = await getContributors(repository.ownerName, repository.repoName);
    } catch {
      return { success: false, error: "GitHubからのコントリビューター取得に失敗しました" };
    }

    // selectedGithubUsersでフィルタリング
    let targetContributors = githubContributors.filter((c) => c.login != null);
    if (input.selectedGithubUsers && input.selectedGithubUsers.length > 0) {
      const selectedSet = new Set(input.selectedGithubUsers);
      targetContributors = targetContributors.filter((c) => c.login && selectedSet.has(c.login));
    }

    // 既存のコラボレーター取得
    const existingCollaborators = await this.collaboratorRepository.findByRepositoryId(
      input.repositoryId
    );
    const existingUserNames = new Set(existingCollaborators.map((c) => c.githubUserName));

    // 新規登録が必要なコントリビューターを抽出
    const newContributors = targetContributors.filter(
      (c) => c.login && !existingUserNames.has(c.login)
    );

    // 新規コラボレーターを登録
    let newCollaborators: Collaborator[] = [];
    if (newContributors.length > 0) {
      const newCollaboratorData: NewCollaborator[] = newContributors
        .filter((c): c is typeof c & { login: string } => c.login != null)
        .map((c) => ({
          repositoryId: input.repositoryId,
          githubUserName: c.login,
          displayName: c.login,
        }));
      newCollaborators = await this.collaboratorRepository.createMany(newCollaboratorData);
    }

    // 既存 + 新規のコラボレーターを返す
    const allCollaborators = [
      ...existingCollaborators.filter((c) =>
        input.selectedGithubUsers
          ? input.selectedGithubUsers.includes(c.githubUserName)
          : true
      ),
      ...newCollaborators,
    ];

    return {
      success: true,
      collaborators: allCollaborators,
    };
  }
}
