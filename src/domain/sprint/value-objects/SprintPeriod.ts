/**
 * SprintPeriod Value Object
 *
 * スプリントの期間（開始日〜終了日）を表す値オブジェクト。
 */

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export class SprintPeriod {
  private constructor(
    private readonly _startDate: Date,
    private readonly _endDate: Date
  ) {}

  /**
   * SprintPeriodを作成する
   * @param startDate 開始日
   * @param endDate 終了日
   * @throws 終了日が開始日より前の場合
   */
  static create(startDate: Date, endDate: Date): SprintPeriod {
    // 日付のみで比較（時刻を無視）
    const start = SprintPeriod.normalizeDate(startDate);
    const end = SprintPeriod.normalizeDate(endDate);

    if (end < start) {
      throw new Error("終了日は開始日以降である必要があります");
    }

    return new SprintPeriod(start, end);
  }

  /**
   * 日付を正規化（時刻を00:00:00に設定）
   */
  private static normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  /**
   * 開始日を取得
   */
  get startDate(): Date {
    return new Date(this._startDate);
  }

  /**
   * 終了日を取得
   */
  get endDate(): Date {
    return new Date(this._endDate);
  }

  /**
   * 期間の日数を取得
   */
  get durationDays(): number {
    const diffMs = this._endDate.getTime() - this._startDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * 指定した日付が期間内かどうか
   */
  contains(date: Date): boolean {
    const normalized = SprintPeriod.normalizeDate(date);
    return normalized >= this._startDate && normalized <= this._endDate;
  }

  /**
   * 期間を日本語形式でフォーマット
   * @returns "1/6(土) - 1/12(金)" のような形式
   */
  format(): string {
    const formatDate = (d: Date) =>
      `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;

    return `${formatDate(this._startDate)} - ${formatDate(this._endDate)}`;
  }

  /**
   * 2つのSprintPeriodが等しいかどうか
   */
  equals(other: SprintPeriod): boolean {
    return (
      this._startDate.getTime() === other._startDate.getTime() &&
      this._endDate.getTime() === other._endDate.getTime()
    );
  }

  /**
   * JSON形式に変換
   */
  toJSON(): { startDate: string; endDate: string } {
    return {
      startDate: this._startDate.toISOString(),
      endDate: this._endDate.toISOString(),
    };
  }
}
