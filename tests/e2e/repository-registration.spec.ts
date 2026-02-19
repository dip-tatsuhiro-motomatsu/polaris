import { test, expect } from "@playwright/test";

test.describe("Repository Registration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/repositories");
  });

  test("リポジトリ一覧ページが表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /リポジトリ/i })).toBeVisible();
  });

  test("リポジトリを追加ボタンが表示される", async ({ page }) => {
    await expect(page.getByRole("button", { name: /リポジトリを追加/i })).toBeVisible();
  });

  test("リポジトリ追加フォームが開く", async ({ page }) => {
    await page.getByRole("button", { name: /リポジトリを追加/i }).click();
    await expect(page.getByPlaceholder(/github.com/i)).toBeVisible();
  });

  test("有効なURLでリポジトリを登録できる", async ({ page }) => {
    // リポジトリ追加フォームを開く
    await page.getByRole("button", { name: /リポジトリを追加/i }).click();

    // URLを入力
    await page.getByPlaceholder(/github.com/i).fill("https://github.com/owner/repo");

    // 登録ボタンをクリック
    await page.getByRole("button", { name: /登録/i }).click();

    // 成功メッセージまたはリポジトリカードが表示されることを確認
    // 注: 実際のテストはモックAPIが必要
    await expect(page.locator("text=owner/repo")).toBeVisible({ timeout: 10000 });
  });

  test("無効なURLではエラーメッセージが表示される", async ({ page }) => {
    await page.getByRole("button", { name: /リポジトリを追加/i }).click();
    await page.getByPlaceholder(/github.com/i).fill("invalid-url");
    await page.getByRole("button", { name: /登録/i }).click();

    // エラーメッセージを確認
    await expect(page.getByText(/有効なGitHub URL/i)).toBeVisible();
  });

  test("空のURLではエラーメッセージが表示される", async ({ page }) => {
    await page.getByRole("button", { name: /リポジトリを追加/i }).click();
    await page.getByRole("button", { name: /登録/i }).click();

    // 必須フィールドエラーを確認
    await expect(page.getByText(/URL.*必須/i)).toBeVisible();
  });
});

test.describe("Repository List", () => {
  test("リポジトリがない場合は空状態が表示される", async ({ page }) => {
    await page.goto("/repositories");

    // 空状態のメッセージを確認
    await expect(
      page.getByText(/リポジトリが登録されていません/i)
    ).toBeVisible();
  });

  test("リポジトリカードをクリックすると詳細ページに遷移する", async ({
    page,
  }) => {
    // 前提: リポジトリが登録済み
    await page.goto("/repositories");

    // リポジトリカードをクリック
    const repoCard = page.locator('[data-testid="repository-card"]').first();
    if (await repoCard.isVisible()) {
      await repoCard.click();
      await expect(page).toHaveURL(/\/repositories\/[^/]+/);
    }
  });
});

test.describe("Repository Detail", () => {
  test("リポジトリ詳細ページが表示される", async ({ page }) => {
    // 前提: リポジトリIDが存在する
    await page.goto("/repositories/test-repo-id");

    // 詳細ページのコンテンツを確認
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("同期ボタンが表示される", async ({ page }) => {
    await page.goto("/repositories/test-repo-id");

    await expect(page.getByRole("button", { name: /同期/i })).toBeVisible();
  });

  test("Issue一覧へのリンクが表示される", async ({ page }) => {
    await page.goto("/repositories/test-repo-id");

    await expect(page.getByRole("link", { name: /Issue/i })).toBeVisible();
  });
});

test.describe("GitHub Sync", () => {
  test("同期ボタンをクリックするとデータが更新される", async ({ page }) => {
    await page.goto("/repositories/test-repo-id");

    // 同期ボタンをクリック
    await page.getByRole("button", { name: /同期/i }).click();

    // ローディング状態を確認
    await expect(page.getByText(/同期中/i)).toBeVisible();

    // 完了を待機
    await expect(page.getByText(/同期完了/i)).toBeVisible({ timeout: 30000 });
  });
});
