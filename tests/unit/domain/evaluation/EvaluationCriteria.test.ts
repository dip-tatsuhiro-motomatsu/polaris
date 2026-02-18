/**
 * EvaluationCriteria Value Object のテスト
 */

import { describe, it, expect } from "vitest";
import {
  QualityCriteria,
  ConsistencyCriteria,
  QUALITY_CATEGORIES,
  CONSISTENCY_CATEGORIES,
} from "@/domain/evaluation/value-objects/EvaluationCriteria";

describe("QualityCriteria", () => {
  describe("categories", () => {
    it("4つのカテゴリが定義されている", () => {
      expect(QUALITY_CATEGORIES.length).toBe(4);
    });

    it("各カテゴリにid, label, weight, descriptionがある", () => {
      QUALITY_CATEGORIES.forEach((category) => {
        expect(category.id).toBeTruthy();
        expect(category.label).toBeTruthy();
        expect(category.weight).toBeGreaterThan(0);
        expect(category.description).toBeTruthy();
      });
    });

    it("weightの合計は100", () => {
      const totalWeight = QUALITY_CATEGORIES.reduce((sum, cat) => sum + cat.weight, 0);
      expect(totalWeight).toBe(100);
    });

    it("context-goalカテゴリが含まれる", () => {
      const category = QUALITY_CATEGORIES.find((c) => c.id === "context-goal");
      expect(category).toBeDefined();
      expect(category?.weight).toBe(25);
    });

    it("acceptance-criteriaが最も重要（最大weight）", () => {
      const acceptanceCriteria = QUALITY_CATEGORIES.find((c) => c.id === "acceptance-criteria");
      expect(acceptanceCriteria?.weight).toBe(30);
    });
  });

  describe("QualityCriteria.getById", () => {
    it("IDでカテゴリを取得できる", () => {
      const category = QualityCriteria.getById("context-goal");
      expect(category?.id).toBe("context-goal");
      expect(category?.label).toBe("Context & Goal（背景と目的）");
    });

    it("存在しないIDはundefined", () => {
      const category = QualityCriteria.getById("invalid-id");
      expect(category).toBeUndefined();
    });
  });

  describe("QualityCriteria.validateCategoryScores", () => {
    it("有効なカテゴリスコアを検証できる", () => {
      const scores = [
        { categoryId: "context-goal", score: 20 },
        { categoryId: "implementation-details", score: 18 },
        { categoryId: "acceptance-criteria", score: 25 },
        { categoryId: "structure-clarity", score: 15 },
      ];

      const result = QualityCriteria.validateCategoryScores(scores);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("スコアが最大値を超えるとエラー", () => {
      const scores = [
        { categoryId: "context-goal", score: 30 }, // max is 25
      ];

      const result = QualityCriteria.validateCategoryScores(scores);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("context-goal");
    });

    it("負のスコアはエラー", () => {
      const scores = [
        { categoryId: "context-goal", score: -5 },
      ];

      const result = QualityCriteria.validateCategoryScores(scores);
      expect(result.valid).toBe(false);
    });

    it("存在しないカテゴリIDはエラー", () => {
      const scores = [
        { categoryId: "invalid-category", score: 10 },
      ];

      const result = QualityCriteria.validateCategoryScores(scores);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("invalid-category");
    });
  });
});

describe("ConsistencyCriteria", () => {
  describe("categories", () => {
    it("5つのカテゴリが定義されている", () => {
      expect(CONSISTENCY_CATEGORIES.length).toBe(5);
    });

    it("weightの合計は100", () => {
      const totalWeight = CONSISTENCY_CATEGORIES.reduce((sum, cat) => sum + cat.weight, 0);
      expect(totalWeight).toBe(100);
    });

    it("requirement-coverageが最も重要（最大weight）", () => {
      const category = CONSISTENCY_CATEGORIES.find((c) => c.id === "requirement-coverage");
      expect(category?.weight).toBe(30);
    });
  });

  describe("ConsistencyCriteria.getById", () => {
    it("IDでカテゴリを取得できる", () => {
      const category = ConsistencyCriteria.getById("issue-evaluability");
      expect(category?.id).toBe("issue-evaluability");
    });
  });
});
