/**
 * リードタイムスコア値オブジェクト
 *
 * Issueが起票されてからメインブランチへマージされるまでの経過時間を評価する。
 *
 * スコア基準:
 * - 100点: 2日以内
 * - 80点: 2日超〜3日以内
 * - 60点: 3日超〜4日以内
 * - 40点: 4日超〜5日以内
 * - 20点: 5日超（6日以上）
 */

import { Score } from "./Score";

interface LeadTimeThreshold {
  readonly maxDays: number;
  readonly score: number;
}

const LEAD_TIME_THRESHOLDS: readonly LeadTimeThreshold[] = [
  { maxDays: 2, score: 100 },
  { maxDays: 3, score: 80 },
  { maxDays: 4, score: 60 },
  { maxDays: 5, score: 40 },
] as const;

const MIN_SCORE = 20;

export class LeadTimeScore {
  private readonly score: Score;
  private readonly leadTimeDays: number;

  private constructor(score: Score, leadTimeDays: number) {
    this.score = score;
    this.leadTimeDays = leadTimeDays;
  }

  /**
   * リードタイム（時間）からスコアを計算する
   * @param leadTimeHours リードタイム（時間単位）
   */
  static fromHours(leadTimeHours: number): LeadTimeScore {
    if (leadTimeHours < 0) {
      throw new Error(`リードタイムは0以上である必要があります: ${leadTimeHours}`);
    }

    const leadTimeDays = leadTimeHours / 24;
    const scoreValue = LeadTimeScore.calculateScore(leadTimeDays);

    return new LeadTimeScore(Score.create(scoreValue), leadTimeDays);
  }

  /**
   * リードタイム（日数）からスコアを計算する
   * @param leadTimeDays リードタイム（日単位）
   */
  static fromDays(leadTimeDays: number): LeadTimeScore {
    if (leadTimeDays < 0) {
      throw new Error(`リードタイムは0以上である必要があります: ${leadTimeDays}`);
    }

    const scoreValue = LeadTimeScore.calculateScore(leadTimeDays);

    return new LeadTimeScore(Score.create(scoreValue), leadTimeDays);
  }

  /**
   * 日数からスコアを計算する
   */
  private static calculateScore(days: number): number {
    for (const threshold of LEAD_TIME_THRESHOLDS) {
      if (days <= threshold.maxDays) {
        return threshold.score;
      }
    }
    return MIN_SCORE;
  }

  /**
   * スコアを取得する
   */
  getScore(): Score {
    return this.score;
  }

  /**
   * リードタイム（日数）を取得する
   */
  getLeadTimeDays(): number {
    return this.leadTimeDays;
  }

  /**
   * リードタイム（時間）を取得する
   */
  getLeadTimeHours(): number {
    return this.leadTimeDays * 24;
  }

  /**
   * 評価メッセージを取得する
   */
  getMessage(): string {
    const score = this.score.getValue();
    const days = Math.round(this.leadTimeDays * 10) / 10;

    if (score === 100) {
      return `${days}日で完了（2日以内）`;
    } else if (score === 80) {
      return `${days}日で完了（3日以内）`;
    } else if (score === 60) {
      return `${days}日で完了（4日以内）`;
    } else if (score === 40) {
      return `${days}日で完了（5日以内）`;
    } else {
      return `${days}日で完了（5日超）`;
    }
  }
}
