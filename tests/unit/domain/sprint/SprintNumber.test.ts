/**
 * SprintNumber Value Object のテスト
 */

import { describe, it, expect } from "vitest";
import { SprintNumber } from "@/domain/sprint/value-objects/SprintNumber";

describe("SprintNumber", () => {
  describe("create", () => {
    it("正の整数でSprintNumberを作成できる", () => {
      const sprintNumber = SprintNumber.create(1);
      expect(sprintNumber.value).toBe(1);
    });

    it("大きな数値でもSprintNumberを作成できる", () => {
      const sprintNumber = SprintNumber.create(100);
      expect(sprintNumber.value).toBe(100);
    });

    it("0以下の値ではエラーをスローする", () => {
      expect(() => SprintNumber.create(0)).toThrow(
        "スプリント番号は1以上である必要があります"
      );
      expect(() => SprintNumber.create(-1)).toThrow(
        "スプリント番号は1以上である必要があります"
      );
    });

    it("小数ではエラーをスローする", () => {
      expect(() => SprintNumber.create(1.5)).toThrow(
        "スプリント番号は整数である必要があります"
      );
    });
  });

  describe("equals", () => {
    it("同じ値のSprintNumberは等しい", () => {
      const a = SprintNumber.create(5);
      const b = SprintNumber.create(5);
      expect(a.equals(b)).toBe(true);
    });

    it("異なる値のSprintNumberは等しくない", () => {
      const a = SprintNumber.create(5);
      const b = SprintNumber.create(6);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("next / previous", () => {
    it("nextで次のスプリント番号を取得できる", () => {
      const current = SprintNumber.create(5);
      const next = current.next();
      expect(next.value).toBe(6);
    });

    it("previousで前のスプリント番号を取得できる", () => {
      const current = SprintNumber.create(5);
      const previous = current.previous();
      expect(previous.value).toBe(4);
    });

    it("スプリント1のpreviousはエラーをスローする", () => {
      const first = SprintNumber.create(1);
      expect(() => first.previous()).toThrow(
        "スプリント番号は1以上である必要があります"
      );
    });
  });

  describe("add", () => {
    it("offsetを加算できる", () => {
      const current = SprintNumber.create(5);
      const result = current.add(3);
      expect(result.value).toBe(8);
    });

    it("負のoffsetで減算できる", () => {
      const current = SprintNumber.create(5);
      const result = current.add(-2);
      expect(result.value).toBe(3);
    });

    it("結果が0以下になる場合はエラー", () => {
      const current = SprintNumber.create(3);
      expect(() => current.add(-5)).toThrow(
        "スプリント番号は1以上である必要があります"
      );
    });
  });
});
