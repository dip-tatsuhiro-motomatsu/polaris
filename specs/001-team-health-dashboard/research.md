# リサーチ: チーム健全性ダッシュボード

**日付**: 2026-01-23
**目的**: 技術選定の根拠と実装方針の決定

## 1. GitHub API連携

### 決定
Octokit（GitHub公式SDKのTypeScript版）を使用

### 根拠
- TypeScriptの型定義が完備
- GitHub REST API v3 と GraphQL API 両方をサポート
- 認証（Personal Access Token、OAuth App、GitHub App）の柔軟な対応
- Next.js環境との親和性が高い

### 検討した代替案
| 代替案 | 却下理由 |
|--------|----------|
| 直接fetch | 型定義がない、エラーハンドリングが煩雑 |
| GraphQL単体 | 学習コストが高い、REST APIで十分なケースも多い |

### 実装方針
```typescript
// lib/github/client.ts
import { Octokit } from '@octokit/rest';

export const createGitHubClient = (token: string) => {
  return new Octokit({ auth: token });
};
```

### レート制限対策
- 認証済みリクエスト: 5,000 req/hour
- キャッシュ戦略: Firestoreに同期データを保存し、差分更新
- バックオフ: 429エラー時は指数バックオフで再試行

---

## 2. Firebase Firestore データ設計

### 決定
NoSQLドキュメント構造でリポジトリ・Issue・PRを管理

### 根拠
- ユーザー指定のスタック
- リアルタイム更新が容易（onSnapshot）
- スケール時の柔軟性
- Next.js SSR/CSR両方で利用可能

### コレクション設計
```
repositories/
  {repositoryId}/
    - owner: string
    - name: string
    - url: string
    - lastSyncedAt: Timestamp
    - issueCount: number
    - prCount: number

    issues/
      {issueId}/
        - number: number
        - title: string
        - body: string
        - state: 'open' | 'closed'
        - createdAt: Timestamp
        - closedAt: Timestamp | null
        - assignee: string | null
        - speedEvaluation: EvaluationResult
        - qualityEvaluation: EvaluationResult

    pullRequests/
      {prId}/
        - number: number
        - title: string
        - body: string
        - linkedIssueNumbers: number[]
        - consistencyEvaluation: EvaluationResult

evaluationSettings/
  speedCriteria/
    - criteria: SpeedCriterion[]
  qualityCriteria/
    - checkItems: QualityCheckItem[]
```

---

## 3. AI評価の抽象化レイヤー

### 決定
インターフェースを定義し、OpenAI実装をデフォルトとする

### 根拠
- FR-008「AI連携部分は抽象化レイヤーを介して実装」への準拠
- 将来的なLLMプロバイダー切り替え（Claude, Gemini等）への対応
- テスト時のモック差し替えが容易

### インターフェース設計
```typescript
// lib/ai/interface.ts
export interface AIEvaluator {
  evaluateIssueQuality(issue: Issue): Promise<QualityEvaluation>;
  evaluateConsistency(issue: Issue, pr: PullRequest): Promise<ConsistencyEvaluation>;
}

// lib/ai/openai.ts
export class OpenAIEvaluator implements AIEvaluator {
  // OpenAI API実装
}

// lib/ai/mock.ts (テスト用)
export class MockEvaluator implements AIEvaluator {
  // 固定値を返すモック
}
```

### プロンプト設計方針
- 評価項目を明示的に列挙
- JSON形式で構造化された出力を要求
- 評価理由を必須フィールドとして含める

---

## 4. 評価基準の設定ファイル管理

### 決定
TypeScript定数ファイルで管理、将来的にFirestore移行も可能な設計

### 根拠
- FR-007「評価基準は設定ファイルで管理」への準拠
- 型安全性の確保
- デプロイ時の変更が容易

### 設定ファイル構造
```typescript
// config/evaluation-criteria.ts
export const SPEED_CRITERIA: SpeedCriterion[] = [
  { maxHours: 24, score: 120, grade: 'S', message: '小さな単位で開発できています！素晴らしい。' },
  { maxHours: 72, score: 100, grade: 'A', message: '非常に健全な開発スピードです。' },
  { maxHours: 120, score: 70, grade: 'B', message: '少しタスクが肥大化しているかも？分担を検討。' },
  { maxHours: Infinity, score: 40, grade: 'C', message: '何か詰まっているはず。メンターに相談しよう。' },
];

export const QUALITY_CHECK_ITEMS: QualityCheckItem[] = [
  { id: 'user-story', label: 'ユーザーストーリーの有無と質', weight: 30 },
  { id: 'implementation', label: '実装方針の記載', weight: 25 },
  { id: 'concerns', label: '懸念点の記載', weight: 25 },
  { id: 'assignee', label: 'assigneeの設定', weight: 20 },
];
```

---

## 5. 認証方式

### 決定
Firebase Authentication + GitHub OAuth

### 根拠
- メンターのみがダッシュボードにアクセスする想定
- GitHub OAuthでリポジトリアクセス権を取得
- Firebaseの認証ルールで簡潔にアクセス制御

### フロー
1. ユーザーがGitHubでログイン
2. Firebase Authでセッション管理
3. GitHub Access TokenをFirestoreに暗号化保存
4. API呼び出し時にトークンを復号して使用

---

## 6. テスト戦略

### 決定
Vitest（ユニット/統合） + Playwright（E2E）

### 根拠
- VitestはVite互換で高速、Next.js 14+との相性が良い
- React Testing Libraryでコンポーネントテスト
- PlaywrightでE2Eテスト（ブラウザ自動操作）

### TDD適用範囲
| レイヤー | テスト種別 | TDD必須 |
|----------|-----------|---------|
| 評価ロジック | ユニット | ✅ 必須 |
| API Routes | 統合 | ✅ 必須 |
| UIコンポーネント | コンポーネント | 推奨 |
| ユーザーフロー | E2E | 主要フローのみ |

---

## 未解決事項

なし - すべての技術選定が完了

## 次のステップ

1. data-model.md でFirestoreのスキーマを詳細定義
2. contracts/ でAPI仕様を定義
3. quickstart.md で開発環境セットアップ手順を記載
