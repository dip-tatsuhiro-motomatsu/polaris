/**
 * SprintNumber Value Object
 *
 * スプリント番号を表す値オブジェクト。
 * 1以上の整数のみ許可。
 */
export class SprintNumber {
  private constructor(private readonly _value: number) {}

  /**
   * SprintNumberを作成する
   * @param value スプリント番号（1以上の整数）
   * @throws スプリント番号が不正な場合
   */
  static create(value: number): SprintNumber {
    if (!Number.isInteger(value)) {
      throw new Error("スプリント番号は整数である必要があります");
    }
    if (value < 1) {
      throw new Error("スプリント番号は1以上である必要があります");
    }
    return new SprintNumber(value);
  }

  /**
   * 0以下を許可するファクトリ（過去スプリント計算用）
   */
  static createAllowingZeroOrNegative(value: number): SprintNumber {
    if (!Number.isInteger(value)) {
      throw new Error("スプリント番号は整数である必要があります");
    }
    return new SprintNumber(value);
  }

  /**
   * スプリント番号の値を取得
   */
  get value(): number {
    return this._value;
  }

  /**
   * 次のスプリント番号を取得
   */
  next(): SprintNumber {
    return SprintNumber.create(this._value + 1);
  }

  /**
   * 前のスプリント番号を取得
   * @throws スプリント1の場合
   */
  previous(): SprintNumber {
    return SprintNumber.create(this._value - 1);
  }

  /**
   * offsetを加算した新しいSprintNumberを返す
   * @param offset 加算する値（負の値も可）
   */
  add(offset: number): SprintNumber {
    return SprintNumber.create(this._value + offset);
  }

  /**
   * 2つのSprintNumberが等しいかどうか
   */
  equals(other: SprintNumber): boolean {
    return this._value === other._value;
  }

  /**
   * 文字列表現
   */
  toString(): string {
    return `Sprint ${this._value}`;
  }
}
