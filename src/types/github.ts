export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  html_url: string;
  description: string | null;
  open_issues_count: number;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  updated_at: string;
  assignee: {
    login: string;
  } | null;
  labels: Array<{
    name: string;
  }>;
  pull_request?: object;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
  } | null;
}

export interface SyncResult {
  issuesSynced: number;
  prsSynced: number;
  isFullSync: boolean;
  lastSyncedAt: Date;
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
}
