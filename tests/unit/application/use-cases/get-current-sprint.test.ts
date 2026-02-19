/**
 * GetCurrentSprintUseCase のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GetCurrentSprintUseCase,
  GetCurrentSprintInput,
} from "@/application/use-cases/get-current-sprint";

// ローカルタイムゾーンで日付を作成するヘルパー
function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe("GetCurrentSprintUseCase", () => {
  let useCase: GetCurrentSprintUseCase;

  beforeEach(() => {
    useCase = new GetCurrentSprintUseCase();
  });

  describe("execute", () => {
    it("現在のスプリント情報を取得できる", async () => {
      const input: GetCurrentSprintInput = {
        sprintConfig: {
          startDayOfWeek: 6, // 土曜日
          durationWeeks: 1,
          baseDate: createLocalDate(2024, 1, 6),
        },
        currentDate: createLocalDate(2024, 1, 10), // スプリント1の水曜日
        offset: 0,
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.sprint).toBeDefined();
      expect(result.sprint!.number).toBe(1);
      expect(result.sprint!.isCurrent).toBe(true);
      expect(result.sprint!.period).toContain("1/6");
      expect(result.sprint!.period).toContain("1/12");
    });

    it("オフセット指定で過去スプリントを取得できる", async () => {
      const input: GetCurrentSprintInput = {
        sprintConfig: {
          startDayOfWeek: 6,
          durationWeeks: 1,
          baseDate: createLocalDate(2024, 1, 6),
        },
        currentDate: createLocalDate(2024, 1, 15), // スプリント2
        offset: -1, // 1つ前のスプリント
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.sprint!.number).toBe(1);
      expect(result.sprint!.isCurrent).toBe(false);
    });

    it("オフセット指定で未来スプリントを取得できる", async () => {
      const input: GetCurrentSprintInput = {
        sprintConfig: {
          startDayOfWeek: 6,
          durationWeeks: 1,
          baseDate: createLocalDate(2024, 1, 6),
        },
        currentDate: createLocalDate(2024, 1, 10), // スプリント1
        offset: 1, // 1つ後のスプリント
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.sprint!.number).toBe(2);
      expect(result.sprint!.isCurrent).toBe(false);
    });

    it("2週間スプリントで正しく計算される", async () => {
      const input: GetCurrentSprintInput = {
        sprintConfig: {
          startDayOfWeek: 6,
          durationWeeks: 2,
          baseDate: createLocalDate(2024, 1, 6),
        },
        currentDate: createLocalDate(2024, 1, 15), // 1/6から見て2週目
        offset: 0,
      };

      const result = await useCase.execute(input);

      expect(result.success).toBe(true);
      expect(result.sprint!.number).toBe(1); // まだスプリント1
      expect(result.sprint!.durationWeeks).toBe(2);
    });
  });
});
