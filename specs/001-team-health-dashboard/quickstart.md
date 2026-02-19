# クイックスタート: チーム健全性ダッシュボード

**日付**: 2026-01-23
**目的**: 開発環境のセットアップと動作確認手順

## 前提条件

- Node.js 20.x 以上
- pnpm（推奨）または npm
- Firebaseプロジェクト（Firestore有効化済み）
- GitHubアカウント（Personal Access Token取得用）
- OpenAI APIキー（AI評価機能用）

## 1. プロジェクトセットアップ

### 1.1 Next.jsプロジェクト作成

```bash
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### 1.2 依存関係インストール

```bash
# 本番依存
pnpm add firebase @octokit/rest openai

# shadcn/ui セットアップ
pnpm dlx shadcn-ui@latest init

# shadcn/ui コンポーネント追加（必要に応じて）
pnpm dlx shadcn-ui@latest add button card input table badge

# 開発依存
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test
```

### 1.3 環境変数設定

`.env.local` を作成:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin (Server-side)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# GitHub
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxx

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxx
```

## 2. Firebase設定

### 2.1 Firestoreルール

Firebaseコンソール → Firestore → ルール に以下を設定:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
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
      allow write: if false;
    }
  }
}
```

### 2.2 Firestoreインデックス

Firebaseコンソール → Firestore → インデックス で以下を追加:

| コレクション | フィールド | 順序 |
|-------------|-----------|------|
| repositories/{id}/issues | state, createdAt | ASC, DESC |
| repositories/{id}/issues | closedAt | DESC |

## 3. テスト設定

### 3.1 Vitest設定

`vitest.config.ts` を作成:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 3.2 テストセットアップ

`tests/setup.ts` を作成:

```typescript
import '@testing-library/jest-dom';
```

### 3.3 Playwright設定

`playwright.config.ts` を作成:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## 4. 開発サーバー起動

```bash
pnpm dev
```

http://localhost:3000 でアクセス可能

## 5. 動作確認シナリオ

### シナリオ 1: リポジトリ登録

1. ダッシュボードにアクセス
2. 「リポジトリを追加」ボタンをクリック
3. GitHub URL（例: `https://github.com/owner/repo`）を入力
4. 登録ボタンをクリック
5. **期待結果**: リポジトリがリストに表示される

### シナリオ 2: GitHub同期

1. 登録済みリポジトリの「同期」ボタンをクリック
2. **期待結果**: Issue/PR数が更新される
3. 同期完了後、Issue一覧に遷移
4. **期待結果**: GitHubのIssueが一覧表示される

### シナリオ 3: 完了速度評価

1. クローズ済みIssueがあるリポジトリを選択
2. Issue一覧で「評価を更新」をクリック
3. **期待結果**: 各Issueに S/A/B/C の評価バッジが表示される
4. 24時間以内にクローズされたIssueを確認
5. **期待結果**: S評価（120点）が表示される

### シナリオ 4: スプリントフィルタ

1. サマリーダッシュボードを開く
2. スプリント期間（例: 2026-01-13 〜 2026-01-26）を設定
3. **期待結果**: 該当期間のIssue/PRのみが集計される

## 6. テスト実行

### ユニットテスト

```bash
pnpm test
```

### E2Eテスト

```bash
pnpm exec playwright test
```

### カバレッジレポート

```bash
pnpm test --coverage
```

## 7. ビルド & デプロイ

### ローカルビルド確認

```bash
pnpm build
pnpm start
```

### Vercelデプロイ（推奨）

```bash
# Vercel CLIインストール
pnpm add -g vercel

# デプロイ
vercel
```

環境変数はVercelダッシュボードで設定

## トラブルシューティング

### GitHub API レート制限

**症状**: 429エラー、または「API rate limit exceeded」メッセージ

**対処**:
1. Personal Access Tokenが設定されているか確認
2. レート制限リセット時刻まで待機（レスポンスヘッダーで確認可能）
3. 差分同期を活用し、fullSync=trueを避ける

### Firebase認証エラー

**症状**: 「Permission denied」エラー

**対処**:
1. Firestoreルールが正しく設定されているか確認
2. Firebase Authenticationが有効か確認
3. 環境変数が正しいか確認

### OpenAI APIエラー

**症状**: AI評価が失敗する

**対処**:
1. APIキーが有効か確認
2. 利用制限（レート/クォータ）を確認
3. リクエストサイズ（Issue本文の長さ）を確認
