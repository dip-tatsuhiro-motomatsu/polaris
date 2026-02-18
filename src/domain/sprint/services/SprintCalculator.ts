/**
 * SprintCalculator ドメインサービス
 *
 * スプリント番号の計算やスプリント期間の算出を行う。
 */

import { SprintNumber } from "../value-objects/SprintNumber";
import { SprintPeriod } from "../value-objects/SprintPeriod";

/**
 * スプリント設定
 */
export interface SprintConfig {
  /** スプリント開始曜日（0=日, 1=月, ..., 6=土） */
  startDayOfWeek: number;
  /** スプリント期間（週単位） */
  durationWeeks: number;
  /** スプリント1の基準日 */
  baseDate: Date;
}

/**
 * スプリント情報
 */
export interface Sprint {
  number: SprintNumber;
  period: SprintPeriod;
  isCurrent: boolean;
}

export class SprintCalculator {
  private readonly config: SprintConfig;
  private readonly baseSprintStart: Date;

  constructor(config: SprintConfig) {
    this.config = config;
    // 基準日からスプリント開始日を計算
    this.baseSprintStart = this.getSprintStartDate(config.baseDate);
  }

  /**
   * 指定した日付が属するスプリント開始日を計算
   */
  private getSprintStartDate(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const dayOfWeek = d.getDay();
    const diff = (dayOfWeek - this.config.startDayOfWeek + 7) % 7;
    d.setDate(d.getDate() - diff);

    return d;
  }

  /**
   * スプリント終了日を計算
   */
  private getSprintEndDate(startDate: Date): Date {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + this.config.durationWeeks * 7 - 1);
    endDate.setHours(23, 59, 59, 999);
    return endDate;
  }

  /**
   * 日付からスプリント番号を計算
   * @param date 対象日付
   * @returns SprintNumber（0以下の場合もあり得る）
   */
  calculateSprintNumber(date: Date): SprintNumber {
    const targetSprintStart = this.getSprintStartDate(date);
    const diffMs = targetSprintStart.getTime() - this.baseSprintStart.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const sprintNumber = Math.floor(diffDays / (this.config.durationWeeks * 7)) + 1;

    return SprintNumber.createAllowingZeroOrNegative(sprintNumber);
  }

  /**
   * スプリント番号からスプリント期間を計算
   * @param sprintNumber スプリント番号
   * @returns SprintPeriod
   */
  calculateSprintPeriod(sprintNumber: SprintNumber): SprintPeriod {
    const daysFromBase = (sprintNumber.value - 1) * this.config.durationWeeks * 7;
    const startDate = new Date(this.baseSprintStart);
    startDate.setDate(startDate.getDate() + daysFromBase);

    const endDate = this.getSprintEndDate(startDate);
    // 終了日は23:59:59だが、SprintPeriodは日付のみで扱う
    const endDateOnly = new Date(endDate);
    endDateOnly.setHours(0, 0, 0, 0);

    return SprintPeriod.create(startDate, endDateOnly);
  }

  /**
   * 指定日時点の現在スプリントを取得
   * @param now 基準日時
   */
  getCurrentSprint(now: Date): Sprint {
    const number = this.calculateSprintNumber(now);
    const period = this.calculateSprintPeriod(number);

    return {
      number,
      period,
      isCurrent: true,
    };
  }

  /**
   * オフセット付きでスプリントを取得
   * @param now 基準日時
   * @param offset スプリントオフセット（0=現在, -1=前, 1=次）
   */
  getSprintWithOffset(now: Date, offset: number): Sprint {
    const currentNumber = this.calculateSprintNumber(now);
    const targetNumber = SprintNumber.createAllowingZeroOrNegative(
      currentNumber.value + offset
    );
    const period = this.calculateSprintPeriod(targetNumber);

    return {
      number: targetNumber,
      period,
      isCurrent: offset === 0,
    };
  }

  /**
   * Issueの作成日からスプリント番号を計算
   * @param issueCreatedAt Issue作成日時
   */
  calculateIssueSprintNumber(issueCreatedAt: Date): SprintNumber {
    return this.calculateSprintNumber(issueCreatedAt);
  }

  /**
   * スプリント設定を取得
   */
  getConfig(): SprintConfig {
    return { ...this.config };
  }
}
