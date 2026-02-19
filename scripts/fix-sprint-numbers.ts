/**
 * スプリント番号修正スクリプト
 *
 * 既存データのsprint_numberを、追跡ユーザーの最古Issue作成日を基準に再計算する。
 *
 * 実行方法: npx tsx scripts/fix-sprint-numbers.ts
 */

import * as dotenv from "dotenv";
// Load .env first, then .env.local (later values override earlier)
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { db } from "../src/infrastructure/database";
import { repositories, issues } from "../src/infrastructure/database/schema";
import { SprintCalculator, type SprintConfig } from "../src/domain/sprint";
import { eq, sql } from "drizzle-orm";

async function fixSprintNumbers() {
  console.log("Starting sprint number fix...\n");

  // 全リポジトリを取得
  const allRepos = await db.select().from(repositories);

  for (const repo of allRepos) {
    console.log(`Processing repository: ${repo.ownerName}/${repo.repoName}`);

    // 全Issueを取得
    const allIssues = await db
      .select()
      .from(issues)
      .where(sql`"repository_id" = ${repo.id}`);

    if (allIssues.length === 0) {
      console.log("  No issues found, skipping\n");
      continue;
    }

    // 最古のIssue作成日を検出
    let oldestDate: Date | null = null;
    for (const issue of allIssues) {
      if (!oldestDate || issue.githubCreatedAt < oldestDate) {
        oldestDate = issue.githubCreatedAt;
      }
    }

    if (!oldestDate) {
      console.log("  Could not determine oldest date, skipping\n");
      continue;
    }

    const dateString = oldestDate.toISOString().split("T")[0];
    console.log(`  Oldest issue date: ${dateString}`);
    console.log(`  Current tracking_start_date: ${repo.trackingStartDate ?? "null"}`);

    // tracking_start_dateを更新
    await db
      .update(repositories)
      .set({ trackingStartDate: dateString })
      .where(eq(repositories.id, repo.id));
    console.log(`  Updated tracking_start_date to: ${dateString}`);

    // SprintCalculatorを作成
    const config: SprintConfig = {
      startDayOfWeek: repo.sprintStartDayOfWeek ?? 6,
      durationWeeks: repo.sprintDurationWeeks,
      baseDate: oldestDate,
    };
    const calculator = new SprintCalculator(config);

    // 全Issueのスプリント番号を再計算
    let updatedCount = 0;
    for (const issue of allIssues) {
      const oldSprintNumber = issue.sprintNumber;
      const newSprintNumber = calculator.calculateIssueSprintNumber(issue.githubCreatedAt).value;

      if (oldSprintNumber !== newSprintNumber) {
        await db
          .update(issues)
          .set({ sprintNumber: newSprintNumber })
          .where(eq(issues.id, issue.id));
        updatedCount++;
      }
    }

    console.log(`  Updated ${updatedCount}/${allIssues.length} issues\n`);
  }

  console.log("Done!");
  process.exit(0);
}

fixSprintNumbers().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
