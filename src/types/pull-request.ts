import { EvaluationResult } from "./evaluation";

export type PullRequestState = "open" | "closed" | "merged";

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  body: string;
  state: PullRequestState;
  linkedIssueNumbers: number[];
  githubId: number;
  consistencyEvaluation: EvaluationResult | null;
  createdAt: Date;
  mergedAt: Date | null;
  closedAt: Date | null;
  author: string | null;
  syncedAt: Date;
}

export interface PullRequestListParams {
  repositoryId: string;
  state?: PullRequestState | "all";
  sprintStart?: Date;
  sprintEnd?: Date;
  limit?: number;
  offset?: number;
}

export interface PullRequestListResponse {
  pullRequests: PullRequest[];
  total: number;
  hasMore: boolean;
}
