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
            <CardTitle>リポジトリ管理</CardTitle>
            <CardDescription>
              GitHubリポジトリを登録し、Issue/PRデータを同期
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/repositories">リポジトリ一覧へ</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>チームサマリー</CardTitle>
            <CardDescription>
              3軸評価の平均スコア、グレード分布を確認
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/summary">サマリーを見る</Link>
            </Button>
          </CardContent>
        </Card>

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
                <span className="font-semibold">A (100点)</span>: 2日以内完了
              </p>
              <p>
                <span className="font-semibold">B (80点)</span>: 3日以内完了
              </p>
              <p>
                <span className="font-semibold">C (60点)</span>: 4日以内完了
              </p>
              <p>
                <span className="font-semibold">D (40点)</span>: 5日以内完了
              </p>
              <p>
                <span className="font-semibold">E (20点)</span>: 5日超
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
