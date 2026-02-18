import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QualityFeedbackModal } from "@/components/dashboard/QualityFeedbackModal";
import type { Issue } from "@/types/issue";
import type { IssueQualityEvaluation } from "@/types/evaluation";

/**
 * QualityFeedbackModal コンポーネントのユニットテスト
 * T044: 品質評価フィードバック詳細モーダルを作成
 */

// 各テスト後にDOMをクリーンアップ
afterEach(() => {
  cleanup();
});

// モックデータ
const mockIssue: Issue = {
  id: "issue-1",
  number: 42,
  title: "ユーザー認証機能の実装",
  body: "## ユーザーストーリー\n認証機能を実装する",
  state: "open",
  createdAt: new Date("2026-01-15T10:00:00Z"),
  closedAt: null,
  assignee: "developer1",
  labels: ["feature", "high-priority"],
  githubId: 12345,
  speedEvaluation: null,
  qualityEvaluation: {
    score: 75,
    grade: "A",
    message: "良好な記述です",
    details: {
      categories: [
        {
          categoryId: "user-story",
          categoryName: "ユーザーストーリー",
          score: 25,
          maxScore: 30,
          feedback: "ユーザーストーリーが明確に記載されています。",
        },
        {
          categoryId: "implementation",
          categoryName: "実装方針",
          score: 20,
          maxScore: 25,
          feedback: "実装方針が記載されていますが、詳細が不足しています。",
        },
        {
          categoryId: "concerns",
          categoryName: "懸念点",
          score: 10,
          maxScore: 25,
          feedback: "懸念点の記載を検討してください。",
        },
        {
          categoryId: "assignee",
          categoryName: "担当者",
          score: 20,
          maxScore: 20,
          feedback: "担当者が設定されています。",
        },
      ],
      overallFeedback: "全体的に良好な記述ですが、懸念点の記載を追加することを推奨します。",
      improvementSuggestions: [
        "懸念点セクションを追加してください",
        "実装方針をより具体的に記載してください",
      ],
    },
    evaluatedAt: new Date("2026-01-15T12:00:00Z"),
  },
  syncedAt: new Date("2026-01-15T10:00:00Z"),
};

const mockQualityEvaluation: IssueQualityEvaluation = {
  totalScore: 75,
  grade: "A",
  categories: [
    {
      categoryId: "user-story",
      categoryName: "ユーザーストーリー",
      score: 25,
      maxScore: 30,
      feedback: "ユーザーストーリーが明確に記載されています。",
    },
    {
      categoryId: "implementation",
      categoryName: "実装方針",
      score: 20,
      maxScore: 25,
      feedback: "実装方針が記載されていますが、詳細が不足しています。",
    },
    {
      categoryId: "concerns",
      categoryName: "懸念点",
      score: 10,
      maxScore: 25,
      feedback: "懸念点の記載を検討してください。",
    },
    {
      categoryId: "assignee",
      categoryName: "担当者",
      score: 20,
      maxScore: 20,
      feedback: "担当者が設定されています。",
    },
  ],
  overallFeedback: "全体的に良好な記述ですが、懸念点の記載を追加することを推奨します。",
  improvementSuggestions: [
    "懸念点セクションを追加してください",
    "実装方針をより具体的に記載してください",
  ],
  evaluatedAt: "2026-01-15T12:00:00Z",
};

describe("QualityFeedbackModal", () => {
  describe("表示", () => {
    it("モーダルが開いている時、Issue情報が表示される", () => {
      render(
        <QualityFeedbackModal
          open={true}
          onOpenChange={() => {}}
          issue={mockIssue}
          evaluation={mockQualityEvaluation}
        />
      );

      // ダイアログを取得
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent("ユーザー認証機能の実装");
      expect(dialog).toHaveTextContent("#42");
    });

    it("カテゴリ別スコアが表示される", () => {
      render(
        <QualityFeedbackModal
          open={true}
          onOpenChange={() => {}}
          issue={mockIssue}
          evaluation={mockQualityEvaluation}
        />
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("ユーザーストーリー");
      expect(dialog).toHaveTextContent("実装方針");
      expect(dialog).toHaveTextContent("懸念点");
      expect(dialog).toHaveTextContent("担当者");
    });

    it("各カテゴリのフィードバックが表示される", () => {
      render(
        <QualityFeedbackModal
          open={true}
          onOpenChange={() => {}}
          issue={mockIssue}
          evaluation={mockQualityEvaluation}
        />
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("ユーザーストーリーが明確に記載されています");
    });

    it("改善提案が表示される", () => {
      render(
        <QualityFeedbackModal
          open={true}
          onOpenChange={() => {}}
          issue={mockIssue}
          evaluation={mockQualityEvaluation}
        />
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("懸念点セクションを追加してください");
      expect(dialog).toHaveTextContent("実装方針をより具体的に記載してください");
    });

    it("総合スコアとグレードが表示される", () => {
      render(
        <QualityFeedbackModal
          open={true}
          onOpenChange={() => {}}
          issue={mockIssue}
          evaluation={mockQualityEvaluation}
        />
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("75");
      expect(dialog).toHaveTextContent(/A.*優秀/);
    });

    it("全体フィードバックが表示される", () => {
      render(
        <QualityFeedbackModal
          open={true}
          onOpenChange={() => {}}
          issue={mockIssue}
          evaluation={mockQualityEvaluation}
        />
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("全体的に良好な記述です");
    });
  });

  describe("開閉制御", () => {
    it("open=falseの時、モーダルは表示されない", () => {
      render(
        <QualityFeedbackModal
          open={false}
          onOpenChange={() => {}}
          issue={mockIssue}
          evaluation={mockQualityEvaluation}
        />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("閉じるボタンをクリックするとonOpenChangeが呼ばれる", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(
        <QualityFeedbackModal
          open={true}
          onOpenChange={onOpenChange}
          issue={mockIssue}
          evaluation={mockQualityEvaluation}
        />
      );

      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("評価なしの場合", () => {
    it("評価データがない場合、適切なメッセージが表示される", () => {
      render(
        <QualityFeedbackModal
          open={true}
          onOpenChange={() => {}}
          issue={mockIssue}
          evaluation={null}
        />
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("評価データがありません");
    });
  });

  describe("スコアプログレスバー", () => {
    it("各カテゴリのスコアに応じたプログレスバーが表示される", () => {
      render(
        <QualityFeedbackModal
          open={true}
          onOpenChange={() => {}}
          issue={mockIssue}
          evaluation={mockQualityEvaluation}
        />
      );

      // プログレスバーが存在することを確認
      const progressBars = screen.getAllByRole("progressbar");
      expect(progressBars.length).toBeGreaterThanOrEqual(4);
    });
  });
});
