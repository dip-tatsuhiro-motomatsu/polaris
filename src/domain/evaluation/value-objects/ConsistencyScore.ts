/**
 * 整合性スコア値オブジェクト
 *
 * Issueで定義された責務と、実際のPRの内容が合致しているかを評価する。
 * 100点から減点方式でスコアを算出する。
 *
 * 評価ポイント:
 * - Issueの範囲外の変更（ついでに修正など）が含まれていないか
 * - 実装方針で示した設計と実際のコードが乖離していないか
 */

import { Score } from "./Score";

const MAX_SCORE = 100;

export interface ConsistencyDeduction {
  /** 減点理由 */
  readonly reason: string;
  /** 減点値 */
  readonly points: number;
}

export class ConsistencyScore {
  private readonly score: Score;
  private readonly deductions: readonly ConsistencyDeduction[];
  private readonly summary: string | null;

  private constructor(
    score: Score,
    deductions: readonly ConsistencyDeduction[],
    summary: string | null
  ) {
    this.score = score;
    this.deductions = deductions;
    this.summary = summary;
  }

  /**
   * 減点リストから整合性スコアを作成する
   * @param deductions 減点リスト
   * @param summary 評価サマリー（オプション）
   */
  static create(
    deductions: ConsistencyDeduction[],
    summary?: string
  ): ConsistencyScore {
    ConsistencyScore.validateDeductions(deductions);

    const totalDeduction = deductions.reduce((sum, d) => sum + d.points, 0);
    const finalScore = Math.max(0, MAX_SCORE - totalDeduction);

    return new ConsistencyScore(
      Score.create(finalScore),
      [...deductions],
      summary ?? null
    );
  }

  /**
   * スコア値から直接整合性スコアを作成する（LLM評価結果から）
   * @param scoreValue スコア値（0-100）
   * @param summary 評価サマリー（オプション）
   */
  static fromScore(scoreValue: number, summary?: string): ConsistencyScore {
    return new ConsistencyScore(Score.create(scoreValue), [], summary ?? null);
  }

  /**
   * 減点リストをバリデーションする
   */
  private static validateDeductions(deductions: ConsistencyDeduction[]): void {
    for (const deduction of deductions) {
      if (!Number.isInteger(deduction.points)) {
        throw new Error(`減点値は整数である必要があります: ${deduction.points}`);
      }
      if (deduction.points < 0) {
        throw new Error(`減点値は0以上である必要があります: ${deduction.points}`);
      }
      if (deduction.reason.trim() === "") {
        throw new Error("減点理由は空にできません");
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
   * 減点リストを取得する
   */
  getDeductions(): readonly ConsistencyDeduction[] {
    return [...this.deductions];
  }

  /**
   * 評価サマリーを取得する
   */
  getSummary(): string | null {
    return this.summary;
  }

  /**
   * 総減点数を取得する
   */
  getTotalDeduction(): number {
    return this.deductions.reduce((sum, d) => sum + d.points, 0);
  }

  /**
   * 完全一致（減点なし）かどうか
   */
  isPerfect(): boolean {
    return this.score.getValue() === MAX_SCORE;
  }

  /**
   * 評価詳細を取得する
   */
  getDetails(): string {
    if (this.deductions.length === 0) {
      return this.summary ?? "IssueとPRの内容が一致しています";
    }

    const deductionDetails = this.deductions
      .map((d) => `- ${d.reason} (-${d.points}点)`)
      .join("\n");

    return `${this.summary ?? "整合性評価"}\n\n減点項目:\n${deductionDetails}`;
  }
}
