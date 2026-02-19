/**
 * SprintPeriod Value Object のテスト
 */

import { describe, it, expect } from "vitest";
import { SprintPeriod } from "@/domain/sprint/value-objects/SprintPeriod";

// ローカルタイムゾーンで日付を作成するヘルパー
function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe("SprintPeriod", () => {
  describe("create", () => {
    it("有効な期間でSprintPeriodを作成できる", () => {
      const startDate = createLocalDate(2024, 1, 6); // 土曜日
      const endDate = createLocalDate(2024, 1, 12); // 金曜日
      const period = SprintPeriod.create(startDate, endDate);

      expect(period.startDate.getFullYear()).toBe(2024);
      expect(period.startDate.getMonth()).toBe(0); // January
      expect(period.startDate.getDate()).toBe(6);
      expect(period.endDate.getDate()).toBe(12);
    });

    it("終了日が開始日より前の場合はエラー", () => {
      const startDate = createLocalDate(2024, 1, 12);
      const endDate = createLocalDate(2024, 1, 6);

      expect(() => SprintPeriod.create(startDate, endDate)).toThrow(
        "終了日は開始日以降である必要があります"
      );
    });

    it("同じ日付でも作成可能", () => {
      const sameDate = createLocalDate(2024, 1, 6);
      const period = SprintPeriod.create(sameDate, sameDate);

      expect(period.startDate.getDate()).toBe(6);
      expect(period.endDate.getDate()).toBe(6);
    });
  });

  describe("contains", () => {
    it("期間内の日付を含む", () => {
      const period = SprintPeriod.create(
        createLocalDate(2024, 1, 6),
        createLocalDate(2024, 1, 12)
      );

      expect(period.contains(createLocalDate(2024, 1, 6))).toBe(true); // 開始日
      expect(period.contains(createLocalDate(2024, 1, 9))).toBe(true); // 中間
      expect(period.contains(createLocalDate(2024, 1, 12))).toBe(true); // 終了日
    });

    it("期間外の日付を含まない", () => {
      const period = SprintPeriod.create(
        createLocalDate(2024, 1, 6),
        createLocalDate(2024, 1, 12)
      );

      expect(period.contains(createLocalDate(2024, 1, 5))).toBe(false); // 前日
      expect(period.contains(createLocalDate(2024, 1, 13))).toBe(false); // 翌日
    });
  });

  describe("durationDays", () => {
    it("1週間の期間は7日", () => {
      const period = SprintPeriod.create(
        createLocalDate(2024, 1, 6),
        createLocalDate(2024, 1, 12)
      );

      expect(period.durationDays).toBe(7);
    });

    it("2週間の期間は14日", () => {
      const period = SprintPeriod.create(
        createLocalDate(2024, 1, 6),
        createLocalDate(2024, 1, 19)
      );

      expect(period.durationDays).toBe(14);
    });

    it("同じ日は1日", () => {
      const period = SprintPeriod.create(
        createLocalDate(2024, 1, 6),
        createLocalDate(2024, 1, 6)
      );

      expect(period.durationDays).toBe(1);
    });
  });

  describe("format", () => {
    it("期間を日本語形式でフォーマットできる", () => {
      const period = SprintPeriod.create(
        createLocalDate(2024, 1, 6),
        createLocalDate(2024, 1, 12)
      );

      const formatted = period.format();
      // "1/6(土) - 1/12(金)" のような形式
      expect(formatted).toContain("1/6");
      expect(formatted).toContain("1/12");
      expect(formatted).toContain("-");
    });
  });

  describe("equals", () => {
    it("同じ期間は等しい", () => {
      const a = SprintPeriod.create(
        createLocalDate(2024, 1, 6),
        createLocalDate(2024, 1, 12)
      );
      const b = SprintPeriod.create(
        createLocalDate(2024, 1, 6),
        createLocalDate(2024, 1, 12)
      );

      expect(a.equals(b)).toBe(true);
    });

    it("異なる期間は等しくない", () => {
      const a = SprintPeriod.create(
        createLocalDate(2024, 1, 6),
        createLocalDate(2024, 1, 12)
      );
      const b = SprintPeriod.create(
        createLocalDate(2024, 1, 13),
        createLocalDate(2024, 1, 19)
      );

      expect(a.equals(b)).toBe(false);
    });
  });
});
