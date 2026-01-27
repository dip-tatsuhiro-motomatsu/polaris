# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

このリポジトリは **Specify ワークフロー** を使用しています。これは、仕様作成、計画立案、タスク生成、実装という段階を経る構造化された機能開発アプローチです。ワークフローはスラッシュコマンドで実行されます。

## 開発原則

### テスト駆動開発（TDD）必須

すべての開発において、最初にテストケースを作成してから実装を行います：

1. **Red**: 失敗するテストを書く
2. **Green**: テストを通す最小限の実装を書く
3. **Refactor**: コードを整理する

実装前にテストがない場合、実装を開始しないでください。

## Specify ワークフローコマンド

機能開発は以下の順序で実行します：

1. `/speckit.specify <機能の説明>` - 自然言語から機能仕様を作成
2. `/speckit.clarify` - 仕様の曖昧な点を解消（任意だが推奨）
3. `/speckit.plan` - アーキテクチャ決定を含む技術実装計画を生成
4. `/speckit.tasks` - 計画を依存関係順のタスクに分解
5. `/speckit.analyze` - アーティファクト間の整合性チェック（読み取り専用の分析）
6. `/speckit.implement` - tasks.md を実行して機能を構築
7. `/speckit.checklist <ドメイン>` - 要件品質チェックリストを生成（例：ux, security, api）

追加コマンド：
- `/speckit.constitution` - すべての開発を導くプロジェクト原則を作成/更新
- `/speckit.taskstoissues` - タスクをGitHub Issueに変換

## プロジェクト構造

```
.specify/
├── memory/constitution.md    # プロジェクト原則（遵守必須の制約）
├── templates/                # spec, plan, tasks, checklist のテンプレート
└── scripts/bash/             # ワークフローコマンド用ヘルパースクリプト

specs/<###-feature-name>/     # 機能ブランチごとに作成
├── spec.md                   # 機能仕様（WHAT/WHY、HOWではない）
├── plan.md                   # 技術実装計画
├── tasks.md                  # 順序付けられたタスク一覧
├── research.md               # 技術的決定とその根拠
├── data-model.md             # エンティティと関係
├── quickstart.md             # 統合シナリオ
├── contracts/                # API仕様（OpenAPI/GraphQL）
└── checklists/               # 要件品質の検証
```

## 主要な概念

### 機能ブランチ
機能は数字プレフィックス付きブランチを使用：`001-feature-name`、`002-another-feature`。ワークフロースクリプトは現在のブランチを検出して対応するspecディレクトリを特定します。

### タスク形式
tasks.md のタスクは厳格な形式に従います：
```
- [ ] T001 [P] [US1] ファイルパスを含む説明
```
- `[P]` = 並列実行可能（異なるファイル、依存関係なし）
- `[US1]` = specのユーザーストーリー1に対応

### チェックリスト
チェックリストは「要件の単体テスト」です。実装の正しさではなく、仕様の品質を検証します。項目は「Xは機能するか？」ではなく「Xは仕様化されているか？」を問います。

## 環境変数

- `SPECIFY_FEATURE` - 機能検出を上書き（非gitコンテキストで有用）

## Active Technologies
- TypeScript 5.x / Node.js 20.x (001-team-health-dashboard)
- Firebase Firestore (001-team-health-dashboard)

## Recent Changes
- 001-team-health-dashboard: Added TypeScript 5.x / Node.js 20.x
