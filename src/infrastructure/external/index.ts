/**
 * 外部リソース抽象レイヤー
 * DB、AI、GitHubなどの外部サービスとの接点を抽象化
 */

// AIサービス
export {
  type IAIService,
  type AIServiceOptions,
  type AIServiceConfig,
  VercelAIService,
  getAIService,
  setAIService,
  resetAIService,
} from "./ai";

// GitHubクライアント
export {
  type IGitHubClient,
  type GitHubRepositoryInfo,
  type GitHubContributor,
  type GitHubIssue,
  type GitHubPullRequest,
  type GitHubUser,
  type GitHubPRBranch,
  type GitHubClientConfig,
  OctokitGitHubClient,
  getGitHubClient,
  setGitHubClient,
  resetGitHubClient,
} from "./github";
