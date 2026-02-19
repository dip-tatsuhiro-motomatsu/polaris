/**
 * QualityScore Value Object
 * Issue記述品質のスコア（0-100）を表す値オブジェクト
 */

import { QualityGrade } from "./QualityGrade";

interface CategoryScore {
  score: number;
  maxScore: number;
}

export class QualityScore {
  private constructor(private readonly _value: number) {}

  /**
   * スコア値から作成
   * @param value 0-100の整数
   */
  static create(value: number): QualityScore {
    const intValue = Math.floor(value);
    if (intValue < 0 || intValue > 100) {
      throw new Error("スコアは0以上100以下である必要があります");
    }
    return new QualityScore(intValue);
  }

  /**
   * カテゴリ別スコアの配列から合計スコアを計算して作成
   */
  static fromCategoryScores(categoryScores: CategoryScore[]): QualityScore {
    const total = categoryScores.reduce((sum, cat) => sum + cat.score, 0);
    // 100を超える場合は100に丸める
    return new QualityScore(Math.min(100, Math.floor(total)));
  }

  get value(): number {
    return this._value;
  }

  /**
   * スコアからグレードを判定
   */
  toGrade(): QualityGrade {
    return QualityGrade.fromScore(this._value);
  }

  /**
   * 等価性の比較
   */
  equals(other: QualityScore): boolean {
    return this._value === other._value;
  }
}
