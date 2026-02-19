/**
 * GetCurrentSprintUseCase
 *
 * 現在のスプリント情報を取得するユースケース。
 * スプリント設定を元に、指定されたオフセットのスプリント情報を返す。
 */

import { SprintCalculator, SprintConfig } from "@/domain/sprint";

export interface GetCurrentSprintInput {
  /** スプリント設定 */
  sprintConfig: {
    startDayOfWeek: number;
    durationWeeks: number;
    baseDate: Date;
  };
  /** 基準日時（省略時は現在時刻） */
  currentDate?: Date;
  /** スプリントオフセット（0=現在, -1=前, 1=次） */
  offset?: number;
}

export interface SprintInfo {
  /** スプリント番号 */
  number: number;
  /** スプリント開始日（ISO文字列） */
  startDate: string;
  /** スプリント終了日（ISO文字列） */
  endDate: string;
  /** フォーマット済み期間（例: "1/6(土) - 1/12(金)"） */
  period: string;
  /** スプリント開始曜日名 */
  startDayName: string;
  /** スプリント期間（週） */
  durationWeeks: number;
  /** 現在のスプリントかどうか */
  isCurrent: boolean;
  /** オフセット値 */
  offset: number;
}

export interface GetCurrentSprintOutput {
  success: boolean;
  sprint?: SprintInfo;
  error?: string;
}

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export class GetCurrentSprintUseCase {
  async execute(input: GetCurrentSprintInput): Promise<GetCurrentSprintOutput> {
    try {
      const { sprintConfig, currentDate = new Date(), offset = 0 } = input;

      // SprintConfigを作成
      const config: SprintConfig = {
        startDayOfWeek: sprintConfig.startDayOfWeek,
        durationWeeks: sprintConfig.durationWeeks,
        baseDate: sprintConfig.baseDate,
      };

      // SprintCalculatorを使用してスプリント情報を計算
      const calculator = new SprintCalculator(config);
      const sprint = calculator.getSprintWithOffset(currentDate, offset);

      // レスポンスを構築
      const sprintInfo: SprintInfo = {
        number: sprint.number.value,
        startDate: sprint.period.startDate.toISOString(),
        endDate: sprint.period.endDate.toISOString(),
        period: sprint.period.format(),
        startDayName: DAY_NAMES[sprintConfig.startDayOfWeek],
        durationWeeks: sprintConfig.durationWeeks,
        isCurrent: sprint.isCurrent,
        offset,
      };

      return {
        success: true,
        sprint: sprintInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "スプリント計算に失敗しました",
      };
    }
  }
}
