/**
 * QualityScore Value Object のテスト
 */

import { describe, it, expect } from "vitest";
import { QualityScore } from "@/domain/evaluation/value-objects/QualityScore";

describe("QualityScore", () => {
  describe("create", () => {
    it("0-100の範囲でスコアを作成できる", () => {
      const score = QualityScore.create(75);
      expect(score.value).toBe(75);
    });

    it("0点を作成できる", () => {
      const score = QualityScore.create(0);
      expect(score.value).toBe(0);
    });

    it("100点を作成できる", () => {
      const score = QualityScore.create(100);
      expect(score.value).toBe(100);
    });

    it("負の数はエラー", () => {
      expect(() => QualityScore.create(-1)).toThrow("スコアは0以上100以下である必要があります");
    });

    it("100を超えるとエラー", () => {
      expect(() => QualityScore.create(101)).toThrow("スコアは0以上100以下である必要があります");
    });

    it("小数点以下は切り捨て", () => {
      const score = QualityScore.create(75.9);
      expect(score.value).toBe(75);
    });
  });

  describe("fromCategoryScores", () => {
    it("カテゴリスコアの合計を計算できる", () => {
      const categoryScores = [
        { score: 20, maxScore: 25 },
        { score: 18, maxScore: 25 },
        { score: 25, maxScore: 30 },
        { score: 15, maxScore: 20 },
      ];

      const totalScore = QualityScore.fromCategoryScores(categoryScores);
      expect(totalScore.value).toBe(78); // 20 + 18 + 25 + 15 = 78
    });

    it("空の配列は0点", () => {
      const totalScore = QualityScore.fromCategoryScores([]);
      expect(totalScore.value).toBe(0);
    });

    it("合計が100を超える場合は100に丸める", () => {
      const categoryScores = [
        { score: 30, maxScore: 25 },
        { score: 30, maxScore: 25 },
        { score: 35, maxScore: 30 },
        { score: 25, maxScore: 20 },
      ];

      const totalScore = QualityScore.fromCategoryScores(categoryScores);
      expect(totalScore.value).toBe(100);
    });
  });

  describe("toGrade", () => {
    it("81-100点はAグレード", () => {
      expect(QualityScore.create(100).toGrade().value).toBe("A");
      expect(QualityScore.create(81).toGrade().value).toBe("A");
    });

    it("61-80点はBグレード", () => {
      expect(QualityScore.create(80).toGrade().value).toBe("B");
      expect(QualityScore.create(61).toGrade().value).toBe("B");
    });

    it("41-60点はCグレード", () => {
      expect(QualityScore.create(60).toGrade().value).toBe("C");
      expect(QualityScore.create(41).toGrade().value).toBe("C");
    });

    it("21-40点はDグレード", () => {
      expect(QualityScore.create(40).toGrade().value).toBe("D");
      expect(QualityScore.create(21).toGrade().value).toBe("D");
    });

    it("0-20点はEグレード", () => {
      expect(QualityScore.create(20).toGrade().value).toBe("E");
      expect(QualityScore.create(0).toGrade().value).toBe("E");
    });
  });

  describe("equals", () => {
    it("同じスコアは等しい", () => {
      const a = QualityScore.create(75);
      const b = QualityScore.create(75);
      expect(a.equals(b)).toBe(true);
    });

    it("異なるスコアは等しくない", () => {
      const a = QualityScore.create(75);
      const b = QualityScore.create(80);
      expect(a.equals(b)).toBe(false);
    });
  });
});
