export interface Repository {
  id: string;
  owner: string;
  name: string;
  url: string;
  githubId: number;
  lastSyncedAt: Date | null;
  issueCount: number;
  prCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRepositoryInput {
  url: string;
}

export interface RepositoryWithStats extends Repository {
  openIssueCount: number;
  closedIssueCount: number;
  openPrCount: number;
  mergedPrCount: number;
}
