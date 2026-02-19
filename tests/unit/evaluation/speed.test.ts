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
    it("2日以内（48時間以内）の完了はA評価（100点）", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-01T23:00:00Z"); // 23時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("A");
      expect(result.score).toBe(100);
      expect(result.message).toContain("迅速な対応");
    });

    it("2日ちょうど（48時間）はA評価", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-03T00:00:00Z"); // 48時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("A");
      expect(result.score).toBe(100);
    });

    it("3日以内（72時間以内、48時間超）の完了はB評価（80点）", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-03T12:00:00Z"); // 60時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("B");
      expect(result.score).toBe(80);
      expect(result.message).toContain("良好なペース");
    });

    it("4日以内（96時間以内、72時間超）の完了はC評価（60点）", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-04T12:00:00Z"); // 84時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("C");
      expect(result.score).toBe(60);
      expect(result.message).toContain("標準的なペース");
    });

    it("5日以内（120時間以内、96時間超）の完了はD評価（40点）", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-05T12:00:00Z"); // 108時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("D");
      expect(result.score).toBe(40);
      expect(result.message).toContain("タスクが肥大化");
    });

    it("5日超（120時間超）の完了はE評価（20点）", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-10T00:00:00Z"); // 216時間

      const result = evaluateSpeed(createdAt, closedAt);

      expect(result.grade).toBe("E");
      expect(result.score).toBe(20);
      expect(result.message).toContain("詰まっているはず");
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
    it("設定ファイルに5つの評価基準がある", () => {
      expect(SPEED_CRITERIA.length).toBe(5);
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
    it("81点以上はA", () => {
      expect(scoreToGrade(100)).toBe("A");
      expect(scoreToGrade(81)).toBe("A");
    });

    it("61-80点はB", () => {
      expect(scoreToGrade(80)).toBe("B");
      expect(scoreToGrade(61)).toBe("B");
    });

    it("41-60点はC", () => {
      expect(scoreToGrade(60)).toBe("C");
      expect(scoreToGrade(41)).toBe("C");
    });

    it("21-40点はD", () => {
      expect(scoreToGrade(40)).toBe("D");
      expect(scoreToGrade(21)).toBe("D");
    });

    it("20点以下はE", () => {
      expect(scoreToGrade(20)).toBe("E");
      expect(scoreToGrade(0)).toBe("E");
    });
  });
});
