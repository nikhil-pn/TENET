import type { DateKey } from "./types";
import { dateToKey } from "./persist";

export interface MonthCell {
  date: number; // day-of-month shown in the cell
  dateKey: DateKey; // local "YYYY-MM-DD" for this cell's real date
  isCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Build a 7-column month grid: leading days from the previous month, the full
 * current month, then trailing days from the next month to complete the last
 * row. `month` is 0-based (Jan = 0), matching Date#getMonth.
 *
 * Each cell's dateKey is built from a real Date (which normalizes month/year
 * overflow), so padding cells carry their true date — e.g. January's leading
 * cells belong to the previous December/year. Never string-concatenate keys.
 */
export function buildMonthMatrix(
  year: number,
  month: number,
  today: Date = new Date()
): MonthCell[] {
  const todayKey = dateToKey(today);
  const startingDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: MonthCell[] = [];

  const pushCell = (d: Date, isCurrentMonth: boolean) => {
    const dateKey = dateToKey(d);
    cells.push({
      date: d.getDate(),
      dateKey,
      isCurrentMonth,
      isToday: dateKey === todayKey,
    });
  };

  // Leading days from the previous month (new Date(year, month, 0) is its last day).
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    pushCell(new Date(year, month, -i), false);
  }

  // Current month.
  for (let day = 1; day <= daysInMonth; day++) {
    pushCell(new Date(year, month, day), true);
  }

  // Trailing days to complete the final week.
  const trailing = Math.ceil(cells.length / 7) * 7 - cells.length;
  for (let day = 1; day <= trailing; day++) {
    pushCell(new Date(year, month + 1, day), false);
  }

  return cells;
}
