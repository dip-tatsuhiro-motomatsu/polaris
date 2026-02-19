/**
 * QualityGrade Value Object のテスト
 */

import { describe, it, expect } from "vitest";
import { QualityGrade } from "@/domain/evaluation/value-objects/QualityGrade";

describe("QualityGrade", () => {
  describe("create", () => {
    it("有効なグレードを作成できる", () => {
      expect(QualityGrade.create("A").value).toBe("A");
      expect(QualityGrade.create("B").value).toBe("B");
      expect(QualityGrade.create("C").value).toBe("C");
      expect(QualityGrade.create("D").value).toBe("D");
      expect(QualityGrade.create("E").value).toBe("E");
    });

    it("無効なグレードはエラー", () => {
      expect(() => QualityGrade.create("F" as "A")).toThrow("無効なグレードです");
      expect(() => QualityGrade.create("S" as "A")).toThrow("無効なグレードです");
    });
  });

  describe("fromScore", () => {
    it("81-100点はAグレード", () => {
      expect(QualityGrade.fromScore(100).value).toBe("A");
      expect(QualityGrade.fromScore(81).value).toBe("A");
    });

    it("61-80点はBグレード", () => {
      expect(QualityGrade.fromScore(80).value).toBe("B");
      expect(QualityGrade.fromScore(61).value).toBe("B");
    });

    it("41-60点はCグレード", () => {
      expect(QualityGrade.fromScore(60).value).toBe("C");
      expect(QualityGrade.fromScore(41).value).toBe("C");
    });

    it("21-40点はDグレード", () => {
      expect(QualityGrade.fromScore(40).value).toBe("D");
      expect(QualityGrade.fromScore(21).value).toBe("D");
    });

    it("0-20点はEグレード", () => {
      expect(QualityGrade.fromScore(20).value).toBe("E");
      expect(QualityGrade.fromScore(0).value).toBe("E");
    });
  });

  describe("label", () => {
    it("各グレードにラベルがある", () => {
      expect(QualityGrade.create("A").label).toBe("AI Ready");
      expect(QualityGrade.create("B").label).toBe("Actionable");
      expect(QualityGrade.create("C").label).toBe("Developing");
      expect(QualityGrade.create("D").label).toBe("Needs Refinement");
      expect(QualityGrade.create("E").label).toBe("Incomplete");
    });
  });

  describe("description", () => {
    it("各グレードに説明がある", () => {
      const gradeA = QualityGrade.create("A");
      expect(gradeA.description).toContain("PRまで出せる");

      const gradeE = QualityGrade.create("E");
      expect(gradeE.description).toContain("必須項目の欠落");
    });
  });

  describe("color", () => {
    it("各グレードに色がある", () => {
      expect(QualityGrade.create("A").color).toBe("#22c55e"); // green
      expect(QualityGrade.create("B").color).toBe("#3b82f6"); // blue
      expect(QualityGrade.create("C").color).toBe("#eab308"); // yellow
      expect(QualityGrade.create("D").color).toBe("#f97316"); // orange
      expect(QualityGrade.create("E").color).toBe("#ef4444"); // red
    });
  });

  describe("scoreRange", () => {
    it("各グレードにスコア範囲がある", () => {
      const gradeA = QualityGrade.create("A");
      expect(gradeA.scoreRange).toEqual({ min: 81, max: 100 });

      const gradeE = QualityGrade.create("E");
      expect(gradeE.scoreRange).toEqual({ min: 0, max: 20 });
    });
  });

  describe("equals", () => {
    it("同じグレードは等しい", () => {
      const a = QualityGrade.create("A");
      const b = QualityGrade.create("A");
      expect(a.equals(b)).toBe(true);
    });

    it("異なるグレードは等しくない", () => {
      const a = QualityGrade.create("A");
      const b = QualityGrade.create("B");
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("compareTo", () => {
    it("より良いグレードは正の値", () => {
      const a = QualityGrade.create("A");
      const b = QualityGrade.create("B");
      expect(a.compareTo(b)).toBeGreaterThan(0);
    });

    it("より悪いグレードは負の値", () => {
      const c = QualityGrade.create("C");
      const a = QualityGrade.create("A");
      expect(c.compareTo(a)).toBeLessThan(0);
    });

    it("同じグレードは0", () => {
      const a1 = QualityGrade.create("A");
      const a2 = QualityGrade.create("A");
      expect(a1.compareTo(a2)).toBe(0);
    });
  });
});
