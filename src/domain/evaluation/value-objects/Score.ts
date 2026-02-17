/**
 * スコア値オブジェクト
 *
 * 評価スコア（0-100点）とグレード（A-E）の対応関係を定義する。
 * 全ての評価軸（リードタイム、Issue品質、整合性）で共通して使用される。
 *
 * グレード対応:
 * - E: 0-20点
 * - D: 21-40点
 * - C: 41-60点
 * - B: 61-80点
 * - A: 81-100点
 */

export type Grade = "A" | "B" | "C" | "D" | "E";

interface GradeThreshold {
  readonly min: number;
  readonly max: number;
  readonly grade: Grade;
}

const GRADE_THRESHOLDS: readonly GradeThreshold[] = [
  { min: 81, max: 100, grade: "A" },
  { min: 61, max: 80, grade: "B" },
  { min: 41, max: 60, grade: "C" },
  { min: 21, max: 40, grade: "D" },
  { min: 0, max: 20, grade: "E" },
] as const;

export class Score {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  /**
   * スコアを作成する
   * @param value 0-100の整数値
   * @throws スコアが範囲外または整数でない場合
   */
  static create(value: number): Score {
    if (!Number.isInteger(value)) {
      throw new Error(`スコアは整数である必要があります: ${value}`);
    }
    if (value < 0 || value > 100) {
      throw new Error(`スコアは0-100の範囲である必要があります: ${value}`);
    }
    return new Score(value);
  }

  /**
   * スコア値を取得する
   */
  getValue(): number {
    return this.value;
  }

  /**
   * スコアからグレードを取得する
   */
  getGrade(): Grade {
    for (const threshold of GRADE_THRESHOLDS) {
      if (this.value >= threshold.min && this.value <= threshold.max) {
        return threshold.grade;
      }
    }
    // 理論上到達しないが、型安全性のため
    return "E";
  }

  /**
   * グレードの説明を取得する
   */
  getGradeDescription(): string {
    const grade = this.getGrade();
    const descriptions: Record<Grade, string> = {
      A: "優秀",
      B: "良好",
      C: "普通",
      D: "要改善",
      E: "要注意",
    };
    return descriptions[grade];
  }

  /**
   * 他のスコアと比較する
   */
  isHigherThan(other: Score): boolean {
    return this.value > other.value;
  }

  /**
   * 他のスコアと等しいか
   */
  equals(other: Score): boolean {
    return this.value === other.value;
  }

  /**
   * 複数のスコアの平均を計算する
   * 平均はスコアで計算され、その後グレードに変換される
   */
  static average(scores: Score[]): Score {
    if (scores.length === 0) {
      throw new Error("平均を計算するにはスコアが1つ以上必要です");
    }
    const sum = scores.reduce((acc, score) => acc + score.getValue(), 0);
    const avg = Math.round(sum / scores.length);
    return Score.create(avg);
  }
}
