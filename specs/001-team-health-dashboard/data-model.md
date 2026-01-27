# データモデル: チーム健全性ダッシュボード

**日付**: 2026-01-23
**ストレージ**: Firebase Firestore

## エンティティ関係図

```
┌─────────────────┐
│   Repository    │
│─────────────────│
│ id (auto)       │
│ owner           │
│ name            │
│ url             │
│ lastSyncedAt    │
│ issueCount      │
│ prCount         │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐      ┌─────────────────┐
│     Issue       │      │  PullRequest    │
│─────────────────│      │─────────────────│
│ id (auto)       │      │ id (auto)       │
│ number          │◄────►│ number          │
│ title           │      │ title           │
│ body            │      │ body            │
│ state           │      │ linkedIssues[]  │
│ createdAt       │      │ consistencyEval │
│ closedAt        │      └─────────────────┘
│ assignee        │
│ speedEval       │
│ qualityEval     │
└─────────────────┘

┌─────────────────┐
│EvaluationConfig │
│─────────────────│
│ speedCriteria[] │
│ qualityItems[]  │
└─────────────────┘
```

## Firestore コレクション構造

### repositories（コレクション）

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | auto | Firestoreドキュメント ID |
| owner | string | ✅ | GitHubオーナー名（ユーザー/組織） |
| name | string | ✅ | リポジトリ名 |
| url | string | ✅ | リポジトリURL |
| githubId | number | ✅ | GitHub内部ID（一意性確保） |
| lastSyncedAt | Timestamp | - | 最終同期日時 |
| issueCount | number | - | Issue総数（キャッシュ） |
| prCount | number | - | PR総数（キャッシュ） |
| createdAt | Timestamp | ✅ | 登録日時 |
| updatedAt | Timestamp | ✅ | 更新日時 |

**インデックス**:
- `githubId` (一意)
- `owner, name` (複合)

---

### repositories/{repositoryId}/issues（サブコレクション）

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | auto | Firestoreドキュメント ID |
| number | number | ✅ | Issue番号 |
| title | string | ✅ | タイトル |
| body | string | - | 本文（Markdown） |
| state | string | ✅ | 'open' / 'closed' |
| createdAt | Timestamp | ✅ | 作成日時 |
| closedAt | Timestamp | - | クローズ日時（openならnull） |
| assignee | string | - | アサインされたユーザー名 |
| labels | string[] | - | ラベル一覧 |
| githubId | number | ✅ | GitHub内部ID |
| speedEvaluation | EvaluationResult | - | 完了速度評価 |
| qualityEvaluation | EvaluationResult | - | 記述品質評価 |
| syncedAt | Timestamp | ✅ | 同期日時 |

**インデックス**:
- `number` (一意、リポジトリ内)
- `state, createdAt` (複合: オープンIssue取得用)
- `closedAt` (クローズ済みIssue取得用)

---

### repositories/{repositoryId}/pullRequests（サブコレクション）

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | auto | Firestoreドキュメント ID |
| number | number | ✅ | PR番号 |
| title | string | ✅ | タイトル |
| body | string | - | 本文（Markdown） |
| state | string | ✅ | 'open' / 'closed' / 'merged' |
| linkedIssueNumbers | number[] | - | リンクされたIssue番号 |
| githubId | number | ✅ | GitHub内部ID |
| consistencyEvaluation | EvaluationResult | - | Issue-PR整合性評価 |
| syncedAt | Timestamp | ✅ | 同期日時 |

**インデックス**:
- `number` (一意、リポジトリ内)
- `linkedIssueNumbers` (配列クエリ用)

---

### 埋め込み型: EvaluationResult

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| score | number | ✅ | 点数（0-120） |
| grade | string | ✅ | 評価ランク（'S' / 'A' / 'B' / 'C'） |
| message | string | ✅ | フィードバックメッセージ |
| details | object | - | 詳細（評価軸ごとの内訳） |
| evaluatedAt | Timestamp | ✅ | 評価実行日時 |

---

### evaluationSettings（コレクション）

評価基準を動的に管理する場合に使用。初期はTypeScript定数で管理し、将来的にFirestoreへ移行可能。

#### speedCriteria（ドキュメント）

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| criteria | SpeedCriterion[] | ✅ | 速度評価基準の配列 |

**SpeedCriterion 構造**:
```typescript
{
  maxHours: number,    // この時間以下なら該当（例: 24）
  score: number,       // 点数（例: 120）
  grade: string,       // ランク（例: 'S'）
  message: string      // メッセージ
}
```

#### qualityCriteria（ドキュメント）

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| checkItems | QualityCheckItem[] | ✅ | 品質チェック項目の配列 |

**QualityCheckItem 構造**:
```typescript
{
  id: string,          // 項目ID（例: 'user-story'）
  label: string,       // 表示ラベル
  weight: number,      // 重み（合計100）
  description: string  // 評価説明
}
```

---

## TypeScript型定義

```typescript
// types/repository.ts
export interface Repository {
  id: string;
  owner: string;
  name: string;
  url: string;
  githubId: number;
  lastSyncedAt: Date | null;
  issueCount: number;
  prCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// types/issue.ts
export interface Issue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  createdAt: Date;
  closedAt: Date | null;
  assignee: string | null;
  labels: string[];
  githubId: number;
  speedEvaluation: EvaluationResult | null;
  qualityEvaluation: EvaluationResult | null;
  syncedAt: Date;
}

// types/pullRequest.ts
export interface PullRequest {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  linkedIssueNumbers: number[];
  githubId: number;
  consistencyEvaluation: EvaluationResult | null;
  syncedAt: Date;
}

// types/evaluation.ts
export interface EvaluationResult {
  score: number;
  grade: 'S' | 'A' | 'B' | 'C';
  message: string;
  details?: Record<string, unknown>;
  evaluatedAt: Date;
}

export interface SpeedCriterion {
  maxHours: number;
  score: number;
  grade: 'S' | 'A' | 'B' | 'C';
  message: string;
}

export interface QualityCheckItem {
  id: string;
  label: string;
  weight: number;
  description: string;
}
```

---

## バリデーションルール

### Repository
- `url`: 有効なGitHub URLパターン（`https://github.com/{owner}/{repo}`）
- `owner`, `name`: 空文字禁止

### Issue / PullRequest
- `number`: 正の整数
- `state`: enum値のみ許可

### EvaluationResult
- `score`: 0 <= score <= 120
- `grade`: 'S' | 'A' | 'B' | 'C' のみ

---

## Firestore セキュリティルール（概要）

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 認証済みユーザーのみアクセス可能
    match /repositories/{repositoryId} {
      allow read, write: if request.auth != null;

      match /issues/{issueId} {
        allow read, write: if request.auth != null;
      }

      match /pullRequests/{prId} {
        allow read, write: if request.auth != null;
      }
    }

    match /evaluationSettings/{document} {
      allow read: if request.auth != null;
      allow write: if false; // 管理者のみ（Admin SDKで操作）
    }
  }
}
```
