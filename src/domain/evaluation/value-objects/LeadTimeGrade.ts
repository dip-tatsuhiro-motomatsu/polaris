/**
 * LeadTimeGrade Value Object
 * リードタイム（完了速度）のグレード（A-E）を表す値オブジェクト
 *
 * 基準:
 * - A: 2日以内 (100点)
 * - B: 3日以内 (80点)
 * - C: 4日以内 (60点)
 * - D: 5日以内 (40点)
 * - E: 5日超 (20点)
 */

export type LeadTimeGradeValue = "A" | "B" | "C" | "D" | "E";

interface GradeDefinition {
  value: LeadTimeGradeValue;
  label: string;
  description: string;
  color: string;
  maxDays: number | null; // nullは上限なし
  score: number;
}

const GRADE_DEFINITIONS: Record<LeadTimeGradeValue, GradeDefinition> = {
  A: {
    value: "A",
    label: "Excellent",
    description: "2日以内に完了。迅速な対応ができています。",
    color: "#22c55e",
    maxDays: 2,
    score: 100,
  },
  B: {
    value: "B",
    label: "Good",
    description: "3日以内に完了。良好なペースです。",
    color: "#3b82f6",
    maxDays: 3,
    score: 80,
  },
  C: {
    value: "C",
    label: "Average",
    description: "4日以内に完了。標準的なペースです。",
    color: "#eab308",
    maxDays: 4,
    score: 60,
  },
  D: {
    value: "D",
    label: "Slow",
    description: "5日以内に完了。改善の余地があります。",
    color: "#f97316",
    maxDays: 5,
    score: 40,
  },
  E: {
    value: "E",
    label: "Very Slow",
    description: "5日超。大幅な改善が必要です。",
    color: "#ef4444",
    maxDays: null,
    score: 20,
  },
};

const VALID_GRADES: LeadTimeGradeValue[] = ["A", "B", "C", "D", "E"];
const GRADE_ORDER: Record<LeadTimeGradeValue, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };

export class LeadTimeGrade {
  private constructor(private readonly _value: LeadTimeGradeValue) {}

  /**
   * グレード値から作成
   */
  static create(value: LeadTimeGradeValue): LeadTimeGrade {
    if (!VALID_GRADES.includes(value)) {
      throw new Error(`無効なグレードです: ${value}`);
    }
    return new LeadTimeGrade(value);
  }

  /**
   * リードタイム（日数）からグレードを判定して作成
   */
  static fromDays(days: number): LeadTimeGrade {
    if (days <= 2) return new LeadTimeGrade("A");
    if (days <= 3) return new LeadTimeGrade("B");
    if (days <= 4) return new LeadTimeGrade("C");
    if (days <= 5) return new LeadTimeGrade("D");
    return new LeadTimeGrade("E");
  }

  /**
   * リードタイム（時間）からグレードを判定して作成
   */
  static fromHours(hours: number): LeadTimeGrade {
    return LeadTimeGrade.fromDays(hours / 24);
  }

  /**
   * スコアからグレードを判定して作成
   */
  static fromScore(score: number): LeadTimeGrade {
    if (score >= 81) return new LeadTimeGrade("A");
    if (score >= 61) return new LeadTimeGrade("B");
    if (score >= 41) return new LeadTimeGrade("C");
    if (score >= 21) return new LeadTimeGrade("D");
    return new LeadTimeGrade("E");
  }

  get value(): LeadTimeGradeValue {
    return this._value;
  }

  get label(): string {
    return GRADE_DEFINITIONS[this._value].label;
  }

  get description(): string {
    return GRADE_DEFINITIONS[this._value].description;
  }

  get color(): string {
    return GRADE_DEFINITIONS[this._value].color;
  }

  get score(): number {
    return GRADE_DEFINITIONS[this._value].score;
  }

  get maxDays(): number | null {
    return GRADE_DEFINITIONS[this._value].maxDays;
  }

  /**
   * 等価性の比較
   */
  equals(other: LeadTimeGrade): boolean {
    return this._value === other._value;
  }

  /**
   * グレードの比較（Aが最高、Eが最低）
   * @returns 正の値: thisがより良い、負の値: otherがより良い、0: 同じ
   */
  compareTo(other: LeadTimeGrade): number {
    return GRADE_ORDER[this._value] - GRADE_ORDER[other._value];
  }
}
