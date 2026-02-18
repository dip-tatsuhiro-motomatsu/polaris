/**
 * ConsistencyGrade Value Object
 * Issue-PR整合性のグレード（A-E）を表す値オブジェクト
 */

export type ConsistencyGradeValue = "A" | "B" | "C" | "D" | "E";

interface GradeDefinition {
  value: ConsistencyGradeValue;
  label: string;
  description: string;
  color: string;
  scoreRange: { min: number; max: number };
}

const GRADE_DEFINITIONS: Record<ConsistencyGradeValue, GradeDefinition> = {
  A: {
    value: "A",
    label: "完全一致",
    description: "Issueの要件が全て実装され、スコープも適切。模範的なPR。",
    color: "#22c55e",
    scoreRange: { min: 81, max: 100 },
  },
  B: {
    value: "B",
    label: "概ね一致",
    description: "主要な要件は実装されているが、一部改善の余地あり。",
    color: "#3b82f6",
    scoreRange: { min: 61, max: 80 },
  },
  C: {
    value: "C",
    label: "部分的に一致",
    description: "要件の一部が未実装、またはスコープに問題あり。",
    color: "#eab308",
    scoreRange: { min: 41, max: 60 },
  },
  D: {
    value: "D",
    label: "乖離あり",
    description: "Issueの要件とPRの実装に明確な乖離がある。",
    color: "#f97316",
    scoreRange: { min: 21, max: 40 },
  },
  E: {
    value: "E",
    label: "大幅な乖離",
    description: "IssueとPRの関連性が不明、または大幅に異なる実装。",
    color: "#ef4444",
    scoreRange: { min: 0, max: 20 },
  },
};

const VALID_GRADES: ConsistencyGradeValue[] = ["A", "B", "C", "D", "E"];
const GRADE_ORDER: Record<ConsistencyGradeValue, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };

export class ConsistencyGrade {
  private constructor(private readonly _value: ConsistencyGradeValue) {}

  /**
   * グレード値から作成
   */
  static create(value: ConsistencyGradeValue): ConsistencyGrade {
    if (!VALID_GRADES.includes(value)) {
      throw new Error(`無効なグレードです: ${value}`);
    }
    return new ConsistencyGrade(value);
  }

  /**
   * スコアからグレードを判定して作成
   */
  static fromScore(score: number): ConsistencyGrade {
    if (score >= 81) return new ConsistencyGrade("A");
    if (score >= 61) return new ConsistencyGrade("B");
    if (score >= 41) return new ConsistencyGrade("C");
    if (score >= 21) return new ConsistencyGrade("D");
    return new ConsistencyGrade("E");
  }

  get value(): ConsistencyGradeValue {
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

  get scoreRange(): { min: number; max: number } {
    return GRADE_DEFINITIONS[this._value].scoreRange;
  }

  /**
   * 等価性の比較
   */
  equals(other: ConsistencyGrade): boolean {
    return this._value === other._value;
  }

  /**
   * グレードの比較（Aが最高、Eが最低）
   */
  compareTo(other: ConsistencyGrade): number {
    return GRADE_ORDER[this._value] - GRADE_ORDER[other._value];
  }
}
