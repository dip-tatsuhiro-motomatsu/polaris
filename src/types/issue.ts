import { EvaluationResult } from "./evaluation";

export type IssueState = "open" | "closed";

export interface Issue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: IssueState;
  createdAt: Date;
  closedAt: Date | null;
  assignee: string | null;
  labels: string[];
  githubId: number;
  speedEvaluation: EvaluationResult | null;
  qualityEvaluation: EvaluationResult | null;
  syncedAt: Date;
}

export interface IssueListParams {
  repositoryId: string;
  state?: IssueState | "all";
  sprintStart?: Date;
  sprintEnd?: Date;
  limit?: number;
  offset?: number;
}

export interface IssueListResponse {
  issues: Issue[];
  total: number;
  hasMore: boolean;
  filter: {
    sprintStart: Date | null;
    sprintEnd: Date | null;
  };
}
