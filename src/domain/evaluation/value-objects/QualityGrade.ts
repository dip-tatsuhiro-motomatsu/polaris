/**
 * QualityGrade Value Object
 * Issue記述品質のグレード（A-E）を表す値オブジェクト
 */

export type QualityGradeValue = "A" | "B" | "C" | "D" | "E";

interface GradeDefinition {
  value: QualityGradeValue;
  label: string;
  description: string;
  color: string;
  scoreRange: { min: number; max: number };
}

const GRADE_DEFINITIONS: Record<QualityGradeValue, GradeDefinition> = {
  A: {
    value: "A",
    label: "AI Ready",
    description: "実装担当者が一度も質問せずにPRまで出せる。エッジケースや影響範囲も網羅されている。",
    color: "#22c55e",
    scoreRange: { min: 81, max: 100 },
  },
  B: {
    value: "B",
    label: "Actionable",
    description: "人間であれば迷わず作業に入れる。標準的な要件とACが揃っている。",
    color: "#3b82f6",
    scoreRange: { min: 61, max: 80 },
  },
  C: {
    value: "C",
    label: "Developing",
    description: "目的はわかるが、実装方法や詳細な仕様で「確認」が発生する。",
    color: "#eab308",
    scoreRange: { min: 41, max: 60 },
  },
  D: {
    value: "D",
    label: "Needs Refinement",
    description: "タイトルと一行程度の説明のみ。実装者が「何をすべきか」を調査するところから始まる。",
    color: "#f97316",
    scoreRange: { min: 21, max: 40 },
  },
  E: {
    value: "E",
    label: "Incomplete",
    description: "必須項目の欠落、または内容が支離滅裂。",
    color: "#ef4444",
    scoreRange: { min: 0, max: 20 },
  },
};

const VALID_GRADES: QualityGradeValue[] = ["A", "B", "C", "D", "E"];
const GRADE_ORDER: Record<QualityGradeValue, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };

export class QualityGrade {
  private constructor(private readonly _value: QualityGradeValue) {}

  /**
   * グレード値から作成
   */
  static create(value: QualityGradeValue): QualityGrade {
    if (!VALID_GRADES.includes(value)) {
      throw new Error(`無効なグレードです: ${value}`);
    }
    return new QualityGrade(value);
  }

  /**
   * スコアからグレードを判定して作成
   */
  static fromScore(score: number): QualityGrade {
    if (score >= 81) return new QualityGrade("A");
    if (score >= 61) return new QualityGrade("B");
    if (score >= 41) return new QualityGrade("C");
    if (score >= 21) return new QualityGrade("D");
    return new QualityGrade("E");
  }

  get value(): QualityGradeValue {
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
  equals(other: QualityGrade): boolean {
    return this._value === other._value;
  }

  /**
   * グレードの比較（Aが最高、Eが最低）
   * @returns 正の値: thisがより良い、負の値: otherがより良い、0: 同じ
   */
  compareTo(other: QualityGrade): number {
    return GRADE_ORDER[this._value] - GRADE_ORDER[other._value];
  }
}
