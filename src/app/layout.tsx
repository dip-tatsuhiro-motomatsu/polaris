import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { RepositoryProvider } from "@/contexts/RepositoryContext";

export const metadata: Metadata = {
  title: "チーム健全性ダッシュボード",
  description:
    "GitHubリポジトリのIssue/PRを分析し、チームの健全性を可視化するダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen bg-background">
        <RepositoryProvider>
          <Header />
          <main className="container mx-auto px-4 py-8">{children}</main>
        </RepositoryProvider>
      </body>
    </html>
  );
}
