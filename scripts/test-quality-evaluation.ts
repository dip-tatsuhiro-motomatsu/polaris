/**
 * 品質評価機能のテストスクリプト
 * 実行方法: npx tsx scripts/test-quality-evaluation.ts
 */

import { config } from "dotenv";
// .env.local を優先、なければ .env を読み込む
config({ path: ".env.local" });
config({ path: ".env" });

import { GeminiClient } from "../src/lib/ai/gemini-client";
import { evaluateIssueQuality } from "../src/lib/evaluation/quality";

async function testGeminiConnection() {
  console.log("=".repeat(60));
  console.log("1. Gemini API 接続テスト");
  console.log("=".repeat(60));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY が設定されていません");
    console.log("   .env.local に GEMINI_API_KEY=your_api_key を追加してください");
    return false;
  }

  console.log("✅ GEMINI_API_KEY が設定されています");

  try {
    const client = new GeminiClient(apiKey);
    const response = await client.generate({
      messages: [{ role: "user", content: "Hello, this is a test. Reply with 'OK'." }],
      maxTokens: 50,
    });

    console.log("✅ Gemini API 接続成功");
    console.log(`   レスポンス: ${response.content.trim()}`);
    return true;
  } catch (error) {
    console.error("❌ Gemini API 接続失敗:", error);
    return false;
  }
}

async function testQualityEvaluation() {
  console.log("\n" + "=".repeat(60));
  console.log("2. 品質評価機能テスト");
  console.log("=".repeat(60));

  const sampleIssue = {
    number: 999,
    title: "ユーザー登録機能の実装",
    body: `## 背景
現在、アプリケーションにはユーザー登録機能がありません。
ユーザーが自分のアカウントを作成できるようにする必要があります。

## 目的
- ユーザーが自分でアカウントを作成できるようにする
- メールアドレスとパスワードでの認証を実装

## 実装要件
- メールアドレス入力フィールド
- パスワード入力フィールド（8文字以上）
- 確認用パスワード入力フィールド
- 登録ボタン

## 受け入れ条件
- [ ] メールアドレスの形式バリデーション
- [ ] パスワードの長さチェック（8文字以上）
- [ ] パスワード確認の一致チェック
- [ ] 登録成功時にダッシュボードへリダイレクト
- [ ] エラー時にエラーメッセージを表示`,
    assignee: "test-user",
  };

  console.log(`\nテストIssue: #${sampleIssue.number} ${sampleIssue.title}`);
  console.log("-".repeat(60));

  try {
    console.log("評価中...");
    const evaluation = await evaluateIssueQuality(sampleIssue);

    console.log("\n✅ 品質評価成功!");
    console.log(`\n総合スコア: ${evaluation.totalScore}点 (グレード: ${evaluation.grade})`);

    console.log("\nカテゴリ別スコア:");
    for (const category of evaluation.categories) {
      console.log(`  - ${category.categoryName}: ${category.score}/${category.maxScore}点`);
      console.log(`    フィードバック: ${category.feedback}`);
    }

    console.log(`\n全体フィードバック: ${evaluation.overallFeedback}`);

    console.log("\n改善提案:");
    for (const suggestion of evaluation.improvementSuggestions) {
      console.log(`  - ${suggestion}`);
    }

    return true;
  } catch (error) {
    console.error("❌ 品質評価失敗:", error);
    return false;
  }
}

async function main() {
  console.log("品質評価機能テスト開始\n");

  const geminiOk = await testGeminiConnection();
  if (!geminiOk) {
    console.log("\n❌ Gemini API接続テストに失敗したため、テストを中断します");
    process.exit(1);
  }

  const qualityOk = await testQualityEvaluation();
  if (!qualityOk) {
    console.log("\n❌ 品質評価テストに失敗しました");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ すべてのテストが成功しました!");
  console.log("=".repeat(60));
}

main().catch(console.error);
