/**
 * Issue品質スコア値オブジェクト
 *
 * Issue記述が「AIが理解できるほど構造的か」を評価する。
 * 4つの評価項目（各25点満点）の合計で100点満点。
 *
 * 評価項目:
 * 1. ユーザーストーリー: 「誰が」「何のために」が明記されているか
 * 2. 実装方針: どのように実装するかの論理的なステップがあるか
 * 3. 懸念点: リスクや注意書きが記述されているか
 * 4. アサイン: 担当者が正しく設定されているか
 */

import { Score } from "./Score";

const MAX_ITEM_SCORE = 25;

export interface IssueQualityItemScores {
  /** ユーザーストーリー（0-25点） */
  readonly userStory: number;
  /** 実装方針（0-25点） */
  readonly implementationPlan: number;
  /** 懸念点（0-25点） */
  readonly concerns: number;
  /** アサイン（0-25点） */
  readonly assignee: number;
}

export interface IssueQualityItemFeedback {
  /** ユーザーストーリーのフィードバック */
  readonly userStory: string;
  /** 実装方針のフィードバック */
  readonly implementationPlan: string;
  /** 懸念点のフィードバック */
  readonly concerns: string;
  /** アサインのフィードバック */
  readonly assignee: string;
}

export class IssueQualityScore {
  private readonly score: Score;
  private readonly itemScores: IssueQualityItemScores;
  private readonly feedback: IssueQualityItemFeedback | null;

  private constructor(
    score: Score,
    itemScores: IssueQualityItemScores,
    feedback: IssueQualityItemFeedback | null
  ) {
    this.score = score;
    this.itemScores = itemScores;
    this.feedback = feedback;
  }

  /**
   * 各項目のスコアからIssue品質スコアを作成する
   * @param itemScores 各項目のスコア（各0-25点）
   * @param feedback 各項目のフィードバック（オプション）
   */
  static create(
    itemScores: IssueQualityItemScores,
    feedback?: IssueQualityItemFeedback
  ): IssueQualityScore {
    IssueQualityScore.validateItemScores(itemScores);

    const totalScore =
      itemScores.userStory +
      itemScores.implementationPlan +
      itemScores.concerns +
      itemScores.assignee;

    return new IssueQualityScore(
      Score.create(totalScore),
      itemScores,
      feedback ?? null
    );
  }

  /**
   * 各項目のスコアをバリデーションする
   */
  private static validateItemScores(itemScores: IssueQualityItemScores): void {
    const items = [
      { name: "userStory", value: itemScores.userStory },
      { name: "implementationPlan", value: itemScores.implementationPlan },
      { name: "concerns", value: itemScores.concerns },
      { name: "assignee", value: itemScores.assignee },
    ];

    for (const item of items) {
      if (!Number.isInteger(item.value)) {
        throw new Error(`${item.name}は整数である必要があります: ${item.value}`);
      }
      if (item.value < 0 || item.value > MAX_ITEM_SCORE) {
        throw new Error(
          `${item.name}は0-${MAX_ITEM_SCORE}の範囲である必要があります: ${item.value}`
        );
      }
    }
  }

  /**
   * 総合スコアを取得する
   */
  getScore(): Score {
    return this.score;
  }

  /**
   * 各項目のスコアを取得する
   */
  getItemScores(): IssueQualityItemScores {
    return { ...this.itemScores };
  }

  /**
   * 各項目のフィードバックを取得する
   */
  getFeedback(): IssueQualityItemFeedback | null {
    return this.feedback ? { ...this.feedback } : null;
  }

  /**
   * 評価サマリーを取得する
   */
  getSummary(): string {
    const items = [
      { name: "ユーザーストーリー", score: this.itemScores.userStory },
      { name: "実装方針", score: this.itemScores.implementationPlan },
      { name: "懸念点", score: this.itemScores.concerns },
      { name: "アサイン", score: this.itemScores.assignee },
    ];

    const details = items
      .map((item) => `${item.name}: ${item.score}/${MAX_ITEM_SCORE}`)
      .join(", ");

    return `合計: ${this.score.getValue()}/100 (${details})`;
  }
}
