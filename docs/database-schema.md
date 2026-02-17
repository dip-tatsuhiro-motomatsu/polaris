# データベース設計書

## 概要

Team Health Checkアプリケーションのデータベース設計。
Neon (Serverless PostgreSQL) + Drizzle ORMを使用。

## 設計方針

- **認証**: Firebase Authは将来実装予定（usersテーブルは残す）
- **Issue-PR関係**: 1:N（1つのIssueに複数PRが紐づく可能性）
- **評価更新**: 再評価しない。未評価項目のみ部分更新
- **スプリント統計**: キャッシュテーブルなし（毎回動的計算、必要に応じて追加）

## ER図

```
users
  │
  └─< repositories
           │
           ├─< collaborators
           │        │
           ├─< issues ─────────< pull_requests
           │    │                    │
           │    └── author ──────────┘
           │    └── assignee
           │
           └─< evaluations ─── issue_id
```

## テーブル定義

### 1. users（ユーザー）

将来のFirebase Auth連携用。現時点では未使用。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | UUID | PK | Firebase Auth UIDと紐付け |
| email | TEXT | UNIQUE, NOT NULL | メールアドレス |
| display_name | TEXT | | 表示名 |
| role | TEXT | NOT NULL, DEFAULT 'VIEWER' | 'ADMIN' or 'VIEWER' |
| avatar_url | TEXT | | アイコンURL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 更新日時 |

### 2. repositories（リポジトリ）

監視対象のGitHubリポジトリ設定。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGSERIAL | PK | 自動連番 |
| owner_name | TEXT | NOT NULL | GitHubオーナー名 |
| repo_name | TEXT | NOT NULL | GitHubリポジトリ名 |
| pat_encrypted | TEXT | NOT NULL | GitHub PAT（暗号化済み） |
| tracking_start_date | DATE | NOT NULL | 計測開始日（スプリント1開始日） |
| sprint_duration_weeks | INT | NOT NULL, DEFAULT 1 | スプリント周期（1 or 2週間） |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 更新日時 |

**制約:**
- `UNIQUE(owner_name, repo_name)` - 同一リポジトリの重複登録防止

### 3. collaborators（コラボレーター）

リポジトリに紐づくGitHubメンバー。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGSERIAL | PK | 自動連番 |
| repository_id | BIGINT | FK(repositories.id), NOT NULL | 属するリポジトリ |
| github_user_name | TEXT | NOT NULL | GitHubユーザー名 |
| display_name | TEXT | | アプリ内表示名 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | 更新日時 |

**制約:**
- `UNIQUE(repository_id, github_user_name)` - 同一リポジトリ内での重複防止

### 4. issues（Issue）

GitHubから同期したIssueデータ。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGSERIAL | PK | 自動連番 |
| repository_id | BIGINT | FK(repositories.id), NOT NULL | 属するリポジトリ |
| github_number | INT | NOT NULL | GitHub上のIssue番号（#123） |
| title | TEXT | NOT NULL | タイトル |
| body | TEXT | | 本文（AI解析用） |
| state | TEXT | NOT NULL | 'open' or 'closed' |
| author_collaborator_id | BIGINT | FK(collaborators.id) | 作成者 |
| assignee_collaborator_id | BIGINT | FK(collaborators.id) | 担当者（NULL可） |
| github_created_at | TIMESTAMPTZ | NOT NULL | GitHub作成日時 |
| github_closed_at | TIMESTAMPTZ | | GitHub完了日時 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | レコード作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | レコード更新日時 |

**制約:**
- `UNIQUE(repository_id, github_number)` - 同一リポジトリ内でのIssue番号重複防止

### 5. pull_requests（プルリクエスト）

GitHubから同期したPRデータ。Issueと1:N関係。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGSERIAL | PK | 自動連番 |
| repository_id | BIGINT | FK(repositories.id), NOT NULL | 属するリポジトリ |
| issue_id | BIGINT | FK(issues.id) | 紐付くIssue（NULL可、1:N） |
| github_number | INT | NOT NULL | GitHub上のPR番号 |
| title | TEXT | NOT NULL | タイトル |
| state | TEXT | NOT NULL | 'open', 'closed', 'merged' |
| author_collaborator_id | BIGINT | FK(collaborators.id) | PR作成者 |
| github_created_at | TIMESTAMPTZ | NOT NULL | GitHub作成日時 |
| github_merged_at | TIMESTAMPTZ | | GitHubマージ日時 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | レコード作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | レコード更新日時 |

**制約:**
- `UNIQUE(repository_id, github_number)` - 同一リポジトリ内でのPR番号重複防止

### 6. evaluations（評価結果）

Issueに対する評価結果。未評価項目のみ部分更新。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGSERIAL | PK | 自動連番 |
| issue_id | BIGINT | FK(issues.id), UNIQUE, NOT NULL | 評価対象Issue（1:1） |
| lead_time_score | INT | | リードタイムスコア（0-100） |
| lead_time_calculated_at | TIMESTAMPTZ | | 計算日時 |
| quality_score | INT | | Issue品質スコア（0-100） |
| quality_details | JSONB | | 品質評価詳細（4項目の内訳等） |
| quality_calculated_at | TIMESTAMPTZ | | 計算日時 |
| consistency_score | INT | | 整合性スコア（0-100） |
| consistency_details | JSONB | | 整合性評価詳細（減点理由等） |
| consistency_calculated_at | TIMESTAMPTZ | | 計算日時 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | レコード作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | レコード更新日時 |

**制約:**
- `UNIQUE(issue_id)` - 1つのIssueに対して1つの評価レコード

## インデックス

パフォーマンス向上のための追加インデックス：

```sql
-- Issue検索用
CREATE INDEX idx_issues_repository_state ON issues(repository_id, state);
CREATE INDEX idx_issues_github_created_at ON issues(github_created_at);

-- PR検索用
CREATE INDEX idx_pull_requests_repository_state ON pull_requests(repository_id, state);
CREATE INDEX idx_pull_requests_issue_id ON pull_requests(issue_id);

-- 評価検索用（未評価Issue抽出）
CREATE INDEX idx_evaluations_lead_time ON evaluations(issue_id) WHERE lead_time_score IS NULL;
CREATE INDEX idx_evaluations_quality ON evaluations(issue_id) WHERE quality_score IS NULL;
CREATE INDEX idx_evaluations_consistency ON evaluations(issue_id) WHERE consistency_score IS NULL;
```

## 評価ビジネスルール

### スコアとグレードの対応

グレードはスコアから動的に計算（DBには保存しない）。

| グレード | スコア範囲 | 説明 |
|---------|-----------|------|
| A | 81-100 | 優秀 |
| B | 61-80 | 良好 |
| C | 41-60 | 普通 |
| D | 21-40 | 要改善 |
| E | 0-20 | 要注意 |

### リードタイム評価基準

Issue作成からPRマージまでの時間で評価。

| 日数 | スコア |
|-----|-------|
| 2日以内 | 100 |
| 2日超〜3日以内 | 80 |
| 3日超〜4日以内 | 60 |
| 4日超〜5日以内 | 40 |
| 5日超 | 20 |

※ DDDのドメイン層で定義。将来的に設定変更可能。

### Issue品質評価基準

4項目×25点 = 100点満点（LLMで評価）。

| 項目 | 配点 | 評価観点 |
|-----|-----|---------|
| ユーザーストーリー | 25点 | 「誰が」「何のために」が明記されているか |
| 実装方針 | 25点 | 論理的なステップがあるか |
| 懸念点 | 25点 | リスクや注意書きが記述されているか |
| アサイン | 25点 | 担当者が正しく設定されているか |

### 整合性評価基準

100点から減点方式（LLMで評価）。

- Issueの範囲外の変更が含まれていないか
- 実装方針と実際のコードが乖離していないか

## 将来の拡張

- `users`テーブルの有効化（Firebase Auth連携）
- `sprint_statistics`テーブルの追加（パフォーマンス最適化時）
- `collaborators.user_id`の追加（collaboratorとuserの紐付け）
