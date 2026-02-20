"use client";

import Link from "next/link";
import { RepositorySelector } from "./RepositorySelector";

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold">
            Polaris
          </Link>
          <RepositorySelector />
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            スプリント毎の評価
          </Link>
          <Link
            href="/history"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            評価の推移
          </Link>
          <Link
            href="/settings"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            設定
          </Link>
        </nav>
      </div>
    </header>
  );
}
