/**
 * SprintCalculator ドメインサービスのテスト
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SprintCalculator,
  SprintConfig,
} from "@/domain/sprint/services/SprintCalculator";
import { SprintNumber } from "@/domain/sprint/value-objects/SprintNumber";

// ローカルタイムゾーンで日付を作成するヘルパー
function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe("SprintCalculator", () => {
  // 土曜始まり、1週間スプリント
  const defaultConfig: SprintConfig = {
    startDayOfWeek: 6, // 土曜日
    durationWeeks: 1,
    baseDate: createLocalDate(2024, 1, 6), // 2024年1月6日（土）をスプリント1の開始日とする
  };

  let calculator: SprintCalculator;

  beforeEach(() => {
    calculator = new SprintCalculator(defaultConfig);
  });

  describe("calculateSprintNumber", () => {
    it("基準日と同じ日はスプリント1", () => {
      const date = createLocalDate(2024, 1, 6); // 土曜日、スプリント1開始
      const sprintNumber = calculator.calculateSprintNumber(date);
      expect(sprintNumber.value).toBe(1);
    });

    it("基準日の翌週の土曜日はスプリント2", () => {
      const date = createLocalDate(2024, 1, 13); // 次の土曜日
      const sprintNumber = calculator.calculateSprintNumber(date);
      expect(sprintNumber.value).toBe(2);
    });

    it("スプリント1の最終日（金曜日）はスプリント1", () => {
      const date = createLocalDate(2024, 1, 12); // 金曜日
      const sprintNumber = calculator.calculateSprintNumber(date);
      expect(sprintNumber.value).toBe(1);
    });

    it("スプリント1の中間日（水曜日）はスプリント1", () => {
      const date = createLocalDate(2024, 1, 10); // 水曜日
      const sprintNumber = calculator.calculateSprintNumber(date);
      expect(sprintNumber.value).toBe(1);
    });

    it("基準日より前の日付は過去のスプリント番号を返す", () => {
      const date = createLocalDate(2023, 12, 30); // 前週の土曜日
      const sprintNumber = calculator.calculateSprintNumber(date);
      expect(sprintNumber.value).toBe(0); // または負の値、実装による
    });
  });

  describe("calculateSprintPeriod", () => {
    it("スプリント1の期間を取得できる", () => {
      const sprintNumber = SprintNumber.create(1);
      const period = calculator.calculateSprintPeriod(sprintNumber);

      expect(period.startDate.getFullYear()).toBe(2024);
      expect(period.startDate.getMonth()).toBe(0); // January
      expect(period.startDate.getDate()).toBe(6);
      expect(period.endDate.getDate()).toBe(12); // 1/12（金）
    });

    it("スプリント2の期間を取得できる", () => {
      const sprintNumber = SprintNumber.create(2);
      const period = calculator.calculateSprintPeriod(sprintNumber);

      expect(period.startDate.getFullYear()).toBe(2024);
      expect(period.startDate.getMonth()).toBe(0); // January
      expect(period.startDate.getDate()).toBe(13);
      expect(period.endDate.getDate()).toBe(19); // 1/19（金）
    });
  });

  describe("getCurrentSprint", () => {
    it("指定日時点の現在スプリントを取得できる", () => {
      const now = createLocalDate(2024, 1, 10); // 水曜日
      const sprint = calculator.getCurrentSprint(now);

      expect(sprint.number.value).toBe(1);
      expect(sprint.period.contains(now)).toBe(true);
      expect(sprint.isCurrent).toBe(true);
    });
  });

  describe("getSprintWithOffset", () => {
    it("offset=0で現在のスプリントを取得", () => {
      const now = createLocalDate(2024, 1, 10);
      const sprint = calculator.getSprintWithOffset(now, 0);

      expect(sprint.number.value).toBe(1);
      expect(sprint.isCurrent).toBe(true);
    });

    it("offset=-1で前のスプリントを取得", () => {
      const now = createLocalDate(2024, 1, 15); // スプリント2
      const sprint = calculator.getSprintWithOffset(now, -1);

      expect(sprint.number.value).toBe(1);
      expect(sprint.isCurrent).toBe(false);
    });

    it("offset=1で次のスプリントを取得", () => {
      const now = createLocalDate(2024, 1, 10); // スプリント1
      const sprint = calculator.getSprintWithOffset(now, 1);

      expect(sprint.number.value).toBe(2);
      expect(sprint.isCurrent).toBe(false);
    });
  });

  describe("2週間スプリント", () => {
    it("2週間スプリントで正しく計算される", () => {
      const twoWeekConfig: SprintConfig = {
        startDayOfWeek: 6,
        durationWeeks: 2,
        baseDate: createLocalDate(2024, 1, 6),
      };
      const calc = new SprintCalculator(twoWeekConfig);

      // スプリント1は1/6〜1/19
      expect(calc.calculateSprintNumber(createLocalDate(2024, 1, 6)).value).toBe(1);
      expect(calc.calculateSprintNumber(createLocalDate(2024, 1, 19)).value).toBe(1);

      // スプリント2は1/20〜2/2
      expect(calc.calculateSprintNumber(createLocalDate(2024, 1, 20)).value).toBe(2);
    });
  });

  describe("異なる開始曜日", () => {
    it("月曜始まりで正しく計算される", () => {
      const mondayConfig: SprintConfig = {
        startDayOfWeek: 1, // 月曜日
        durationWeeks: 1,
        baseDate: createLocalDate(2024, 1, 1), // 2024年1月1日（月）
      };
      const calc = new SprintCalculator(mondayConfig);

      // スプリント1は1/1〜1/7
      expect(calc.calculateSprintNumber(createLocalDate(2024, 1, 1)).value).toBe(1);
      expect(calc.calculateSprintNumber(createLocalDate(2024, 1, 7)).value).toBe(1);

      // スプリント2は1/8〜1/14
      expect(calc.calculateSprintNumber(createLocalDate(2024, 1, 8)).value).toBe(2);
    });
  });
});
