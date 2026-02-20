import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RepositoryRepository } from "@/infrastructure/repositories/repository-repository";
import { IssueRepository } from "@/infrastructure/repositories/issue-repository";

const repositoryRepo = new RepositoryRepository();
const issueRepo = new IssueRepository();

export default async function Home() {
  // Neonからリポジトリとissue数を取得
  let repoCount = 0;
  let issueCount = 0;

  try {
    const repos = await repositoryRepo.findAll();
    repoCount = repos.length;

    if (repos.length > 0) {
      const issues = await issueRepo.findByRepositoryId(repos[0].id);
      issueCount = issues.length;
    }
  } catch (error) {
    console.error("Database connection error:", error);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">チーム健全性ダッシュボード</h1>
        <p className="text-muted-foreground mt-2">
          GitHubリポジトリのIssue/PRを分析し、チームの開発健全性を可視化します
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>登録リポジトリ数</CardDescription>
            <CardTitle className="text-4xl">{repoCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Issue数</CardDescription>
            <CardTitle className="text-4xl">{issueCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        <Card>
          <CardHeader>
            <CardTitle>評価基準</CardTitle>
            <CardDescription>
              完了速度・記述品質・整合性の評価基準
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">A (100点)</span>
              </p>
              <p>
                <span className="font-semibold">B (80点)</span>
              </p>
              <p>
                <span className="font-semibold">C (60点)</span>
              </p>
              <p>
                <span className="font-semibold">D (40点)</span>
              </p>
              <p>
                <span className="font-semibold">E (20点)</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
