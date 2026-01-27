/**
 * プロジェクト固定設定
 * 対象リポジトリ、スプリント設定などの固定値を管理
 */

/**
 * 対象GitHubリポジトリ設定
 */
export const GITHUB_REPOSITORY = {
  owner: "posse-ap",
  repo: "junior_job_202511",
  /** フルネーム (owner/repo) */
  get fullName() {
    return `${this.owner}/${this.repo}`;
  },
} as const;

/**
 * スプリント設定
 */
export const SPRINT_CONFIG = {
  /** スプリント開始曜日 (0: 日曜, 1: 月曜, ..., 6: 土曜) */
  startDayOfWeek: 6, // 土曜日
  /** スプリント期間（日数） */
  durationDays: 7,
  /** 曜日名（日本語） */
  dayNames: ["日", "月", "火", "水", "木", "金", "土"] as const,
  /** スプリント開始曜日名 */
  get startDayName() {
    return this.dayNames[this.startDayOfWeek];
  },
} as const;

/**
 * スプリント情報
 */
export interface SprintInfo {
  /** スプリント番号 */
  number: number;
  /** 開始日 */
  startDate: Date;
  /** 終了日 */
  endDate: Date;
  /** 現在のスプリントかどうか */
  isCurrent: boolean;
}

/**
 * 指定日が属するスプリントの開始日を取得
 * @param date 対象日
 * @returns スプリント開始日
 */
export function getSprintStartDate(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = (dayOfWeek - SPRINT_CONFIG.startDayOfWeek + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 指定日が属するスプリントの終了日を取得
 * @param date 対象日
 * @returns スプリント終了日
 */
export function getSprintEndDate(date: Date): Date {
  const startDate = getSprintStartDate(date);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + SPRINT_CONFIG.durationDays - 1);
  endDate.setHours(23, 59, 59, 999);
  return endDate;
}

/**
 * 現在のスプリント情報を取得
 */
export function getCurrentSprint(): SprintInfo {
  const now = new Date();
  const startDate = getSprintStartDate(now);
  const endDate = getSprintEndDate(now);

  return {
    number: calculateSprintNumber(startDate),
    startDate,
    endDate,
    isCurrent: true,
  };
}

/**
 * プロジェクト開始からのスプリント番号を計算
 * （仮の基準日: 2024年1月6日を第1スプリントとする）
 */
export function calculateSprintNumber(sprintStartDate: Date): number {
  const baseDate = new Date("2024-01-06"); // 第1スプリント開始日（土曜日）
  const diffTime = sprintStartDate.getTime() - baseDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / SPRINT_CONFIG.durationDays) + 1;
}

/**
 * 指定範囲のスプリント一覧を取得
 * @param fromDate 開始日
 * @param toDate 終了日（省略時は現在日）
 * @returns スプリント情報の配列
 */
export function getSprintsInRange(fromDate: Date, toDate?: Date): SprintInfo[] {
  const endDate = toDate || new Date();
  const sprints: SprintInfo[] = [];
  const currentSprintStart = getSprintStartDate(new Date());

  const currentDate = getSprintStartDate(fromDate);

  while (currentDate <= endDate) {
    const sprintEnd = getSprintEndDate(currentDate);
    sprints.push({
      number: calculateSprintNumber(currentDate),
      startDate: new Date(currentDate),
      endDate: sprintEnd,
      isCurrent: currentDate.getTime() === currentSprintStart.getTime(),
    });

    currentDate.setDate(currentDate.getDate() + SPRINT_CONFIG.durationDays);
  }

  return sprints;
}

/**
 * スプリント期間を日本語フォーマットで表示
 */
export function formatSprintPeriod(sprint: SprintInfo): string {
  const formatDate = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}(${SPRINT_CONFIG.dayNames[d.getDay()]})`;
  return `${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}`;
}
