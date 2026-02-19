# 実装計画: チーム健全性ダッシュボード

**ブランチ**: `001-team-health-dashboard` | **日付**: 2026-01-23 | **仕様**: [spec.md](./spec.md)
**入力**: `/specs/001-team-health-dashboard/spec.md` からの機能仕様

## サマリー

大学1年生向け開発研修において、GitHubリポジトリのIssue/PRデータを収集し、3つの評価軸（完了速度、記述品質、Issue-PR整合性）でチームの健全性を可視化するダッシュボードを構築する。Next.js App Router + TypeScript + Firebase構成で、shadcn/ui + Tailwind CSSによるモダンなUIを提供する。

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20.x
**Framework**: Next.js 14+ (App Router)
**Primary Dependencies**:
- shadcn/ui（UIコンポーネント）
- Tailwind CSS（スタイリング）
- Firebase SDK（Firestore, Authentication）
- Octokit（GitHub API クライアント）
- OpenAI SDK（AI評価用、抽象化レイヤー経由）

**Storage**: Firebase Firestore
**Testing**: Vitest + React Testing Library + Playwright（E2E）
**Target Platform**: Web（モダンブラウザ）
**Project Type**: Web application (Next.js フルスタック)
**Performance Goals**: ダッシュボード表示 < 3秒、評価計算 < 1秒
**Constraints**: GitHub API レート制限（5000 req/hour）、Firebase無料枠考慮
**Scale/Scope**: 1チーム（〜10名）、1リポジトリ、〜100 Issues/Sprint

## Constitution Check

*GATE: Phase 0リサーチ前に確認必須。Phase 1設計後に再確認。*

プロジェクトのconstitutionはまだテンプレート状態のため、以下の原則をこのプロジェクトで適用：

| 原則 | 状態 | 備考 |
|------|------|------|
| テスト駆動開発（TDD） | ✅ 準拠 | CLAUDE.mdで必須と定義済み |
| 設定ファイルでの評価基準管理 | ✅ 準拠 | FR-007で要件化済み |
| AI抽象化レイヤー | ✅ 準拠 | FR-008で要件化済み |

## Project Structure

### ドキュメント（この機能）

```text
specs/001-team-health-dashboard/
├── plan.md              # このファイル
├── research.md          # Phase 0 出力
├── data-model.md        # Phase 1 出力
├── quickstart.md        # Phase 1 出力
├── contracts/           # Phase 1 出力
│   └── api.yaml         # OpenAPI仕様
└── tasks.md             # Phase 2 出力（/speckit.tasks で生成）
```

### ソースコード（リポジトリルート）

```text
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # ダッシュボードホーム
│   ├── repositories/
│   │   ├── page.tsx              # リポジトリ一覧
│   │   └── [id]/
│   │       ├── page.tsx          # リポジトリ詳細
│   │       └── issues/
│   │           └── page.tsx      # Issue一覧・評価
│   ├── summary/
│   │   └── page.tsx              # チームサマリー
│   └── api/
│       ├── repositories/
│       │   └── route.ts          # リポジトリCRUD
│       ├── github/
│       │   └── sync/
│       │       └── route.ts      # GitHub同期
│       └── evaluations/
│           └── route.ts          # 評価API
│
├── components/
│   ├── ui/                       # shadcn/ui コンポーネント
│   ├── dashboard/
│   │   ├── RepositoryCard.tsx
│   │   ├── IssueTable.tsx
│   │   ├── EvaluationBadge.tsx
│   │   └── SummaryChart.tsx
│   └── forms/
│       └── RepositoryForm.tsx
│
├── lib/
│   ├── firebase/
│   │   ├── client.ts             # Firebaseクライアント初期化
│   │   └── admin.ts              # Firebase Admin SDK
│   ├── github/
│   │   ├── client.ts             # Octokit設定
│   │   └── sync.ts               # Issue/PR同期ロジック
│   ├── ai/
│   │   ├── interface.ts          # AI抽象化インターフェース
│   │   ├── openai.ts             # OpenAI実装
│   │   └── evaluator.ts          # Issue評価ロジック
│   └── evaluation/
│       ├── speed.ts              # 完了速度評価
│       ├── quality.ts            # 記述品質評価
│       └── consistency.ts        # Issue-PR整合性評価
│
├── config/
│   └── evaluation-criteria.ts    # 評価基準設定
│
├── types/
│   ├── repository.ts
│   ├── issue.ts
│   ├── evaluation.ts
│   └── github.ts
│
└── hooks/
    ├── useRepository.ts
    ├── useIssues.ts
    └── useEvaluation.ts

tests/
├── unit/
│   ├── evaluation/
│   │   ├── speed.test.ts
│   │   ├── quality.test.ts
│   │   └── consistency.test.ts
│   └── lib/
│       └── github/
│           └── sync.test.ts
├── integration/
│   ├── api/
│   │   └── repositories.test.ts
│   └── firebase/
│       └── firestore.test.ts
└── e2e/
    ├── repository-registration.spec.ts
    └── dashboard-display.spec.ts
```

**Structure Decision**: Next.js App Router構造を採用。`src/`ディレクトリにすべてのソースを配置し、`app/`でルーティング、`components/`でUI、`lib/`でビジネスロジック、`config/`で設定を分離。

## Complexity Tracking

| 検討事項 | 決定 | 理由 |
|----------|------|------|
| AI抽象化レイヤー | 採用 | 将来的なLLMプロバイダー変更に対応（FR-008） |
| 設定ファイル分離 | 採用 | 評価基準の柔軟な変更（FR-007） |
| Firebase選択 | 採用 | ユーザー指定のスタック、リアルタイム対応容易 |

## 技術選定の根拠

### Next.js App Router
- サーバーコンポーネントによるパフォーマンス最適化
- API RoutesでバックエンドAPIを同一プロジェクトで管理
- shadcn/uiとの親和性が高い

### Firebase Firestore
- ユーザー指定のスタック
- リアルタイムリスナーでダッシュボード更新が容易
- 認証（Firebase Auth）との統合がシームレス

### shadcn/ui + Tailwind CSS
- ユーザー指定のスタック
- コンポーネントのカスタマイズ性が高い
- アクセシビリティ対応済み

### AI抽象化（OpenAI SDK）
- FR-008要件に準拠
- インターフェースを定義し、将来的にClaude等への切り替えを容易に
