import { describe, it, expect } from "vitest";
import { SPEED_CRITERIA, scoreToGrade } from "@/config/evaluation-criteria";
import type { EvaluationResult, Grade } from "@/types/evaluation";

// 完了速度評価ロジック（実装前の仕様確認用）
function calculateCompletionHours(createdAt: Date, closedAt: Date): number {
  return (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
}

function evaluateSpeed(createdAt: Date, closedAt: Date): EvaluationResult {
  const hours = calculateCompletionHours(createdAt, closedAt);

  for (const criterion of SPEED_CRITERIA) {
    if (hours <= criterion.maxHours) {
      return {
        score: criterion.score,
        grade: criterion.grade,
        message: criterion.message,
        details: { completionHours: Math.round(hours * 10) / 10 },
        evaluatedAt: new Date(),
      };
    }
  }

  // フォールバック（最後の基準）
  const lastCriterion = SPEED_CRITERIA[SPEED_CRITERIA.length - 1];
  return {
    score: lastCriterion.score,
    grade: lastCriterion.grade,
    message: lastCriterion.message,
    details: { completionHours: Math.round(hours * 10) / 10 },
    evaluatedAt: new Date(),
  };
}

describe("Speed Evaluation", () => {
  describe("calculateCompletionHours", () => {
    it("完了までの時間を時間単位で計算できる", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-01T12:00:00Z");

      const hours = calculateCompletionHours(createdAt, closedAt);

      expect(hours).toBe(12);
    });

    it("日をまたいだ場合も正しく計算できる", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-03T00:00:00Z");

      const hours = calculateCompletionHours(createdAt, closedAt);

      expect(hours).toBe(48);
    });
  });

  describe("evaluateSpeed", () => {
    it("24時間以内の完了はS評価（120点）", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-01T23:00:00Z"); // 23時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("S");
      expect(result.score).toBe(120);
      expect(result.message).toContain("小さな単位で開発できています");
    });

    it("24時間ちょうどはS評価", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-02T00:00:00Z"); // 24時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("S");
      expect(result.score).toBe(120);
    });

    it("72時間以内（24時間超）の完了はA評価（100点）", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-03T00:00:00Z"); // 48時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("A");
      expect(result.score).toBe(100);
      expect(result.message).toContain("非常に健全な開発スピード");
    });

    it("120時間以内（72時間超）の完了はB評価（70点）", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-05T00:00:00Z"); // 96時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("B");
      expect(result.score).toBe(70);
      expect(result.message).toContain("タスクが肥大化");
    });

    it("120時間超の完了はC評価（40点）", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-10T00:00:00Z"); // 216時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("C");
      expect(result.score).toBe(40);
      expect(result.message).toContain("何か詰まっているはず");
    });

    it("詳細に完了時間が含まれる", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-01T12:30:00Z"); // 12.5時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.details).toBeDefined();
      expect(result.details?.completionHours).toBe(12.5);
    });
  });

  describe("SPEED_CRITERIA configuration", () => {
    it("設定ファイルに4つの評価基準がある", () => {
      expect(SPEED_CRITERIA.length).toBe(4);
    });

    it("基準が時間順にソートされている", () => {
      for (let i = 1; i < SPEED_CRITERIA.length; i++) {
        expect(SPEED_CRITERIA[i].maxHours).toBeGreaterThan(
          SPEED_CRITERIA[i - 1].maxHours
        );
      }
    });

    it("各基準にスコア、グレード、メッセージがある", () => {
      for (const criterion of SPEED_CRITERIA) {
        expect(criterion.score).toBeDefined();
        expect(criterion.grade).toBeDefined();
        expect(criterion.message).toBeDefined();
      }
    });
  });

  describe("scoreToGrade helper", () => {
    it("101点以上はS", () => {
      expect(scoreToGrade(120)).toBe("S");
      expect(scoreToGrade(101)).toBe("S");
    });

    it("71-100点はA", () => {
      expect(scoreToGrade(100)).toBe("A");
      expect(scoreToGrade(71)).toBe("A");
    });

    it("41-70点はB", () => {
      expect(scoreToGrade(70)).toBe("B");
      expect(scoreToGrade(41)).toBe("B");
    });

    it("40点以下はC", () => {
      expect(scoreToGrade(40)).toBe("C");
      expect(scoreToGrade(0)).toBe("C");
    });
  });
});
