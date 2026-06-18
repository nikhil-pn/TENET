"use client";
// Calendar + day planner (opened from the "i" button). Each day shows focus
// minutes and planned-task indicators; click a day to see/add its tasks; the
// quick-add field accepts natural language ("next monday gym"). Also keeps the
// session/total productivity display. (Evolved from the monthly chart.)
import { useState, useEffect, useMemo } from "react";
import type { Todo } from "@/lib/types";
import { dateToKey } from "@/lib/persist";
import { buildMonthMatrix, type MonthCell } from "@/lib/calendar";
import { parseWhen } from "@/lib/dates";
import {
  loadTodos,
  saveTodos,
  toggleTodo,
  deleteTodo,
  addTodoForDate,
  todosForDate,
  setTodoDate,
} from "@/lib/storage";
import {
  getQuadrant,
  quadrantCountsByDate,
  QUADRANT_META,
  type Quadrant,
} from "@/lib/prioritization";
import styles from "./MonthlyChart.module.css";

/** Neutral colour for tasks with at least one Eisenhower axis still unset. */
const UNCLASSIFIED_COLOR = "#9e9e9e";

/** Up to 3 dot colours for a day cell, ordered q1 → q2 → q3 → q4 → unclassified. */
function dayDotColors(tally: {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  unclassified: number;
}): string[] {
  const dots: string[] = [];
  const order: Quadrant[] = ["q1", "q2", "q3", "q4"];
  for (const q of order) {
    for (let i = 0; i < tally[q]; i++) dots.push(QUADRANT_META[q].color);
  }
  for (let i = 0; i < tally.unclassified; i++) dots.push(UNCLASSIFIED_COLOR);
  return dots.slice(0, 3);
}

interface DayData extends MonthCell {
  minutes: number;
}

interface MonthlyChartProps {
  isVisible: boolean;
  onClose: () => void;
  todayProductivity: string;
  appInstalled: boolean;
  deferredPrompt: unknown;
  onInstall: () => void;
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Friendly label for a "YYYY-MM-DD" key, parsed in local time. */
function formatKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const MonthlyChart = ({
  isVisible,
  onClose,
  appInstalled,
  deferredPrompt,
  onInstall,
}: MonthlyChartProps) => {
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentTimerInfo, setCurrentTimerInfo] = useState("00:00 / 25:00");
  const [totalProductivityMinutes, setTotalProductivityMinutes] = useState(0);

  // Planner state
  const [todos, setTodos] = useState<Todo[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>(dateToKey());
  const [quick, setQuick] = useState("");
  const [dayDraft, setDayDraft] = useState("");

  // Build the month grid + read per-day minutes and the all-time total.
  useEffect(() => {
    if (typeof window !== "undefined" && isVisible) {
      const cells = buildMonthMatrix(currentYear, currentMonth);
      const enriched: DayData[] = cells.map((cell) => {
        let minutes = 0;
        if (cell.isCurrentMonth) {
          const saved = localStorage.getItem(`productiveTime_${cell.dateKey}`);
          if (saved) minutes = parseInt(saved, 10);
        }
        return { ...cell, minutes };
      });
      setMonthData(enriched);

      const currentTime = localStorage.getItem("currentTimerInfo");
      if (currentTime) setCurrentTimerInfo(currentTime);
      const productiveTime = localStorage.getItem("productiveTime");
      if (productiveTime) setTotalProductivityMinutes(parseInt(productiveTime, 10));
    }
  }, [currentMonth, currentYear, isVisible]);

  // Real-time session info while open.
  useEffect(() => {
    if (!isVisible) return;
    const timerInterval = setInterval(() => {
      if (typeof window !== "undefined") {
        const currentTime = localStorage.getItem("currentTimerInfo");
        if (currentTime) setCurrentTimerInfo(currentTime);
      }
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [isVisible]);

  // Load todos when the panel opens (picks up edits made in the checklist).
  useEffect(() => {
    if (isVisible) {
      setTodos(loadTodos());
      setHydrated(true);
    }
  }, [isVisible]);

  // Persist after the initial load so the empty starting state can't clobber storage.
  useEffect(() => {
    if (hydrated) saveTodos(todos);
  }, [todos, hydrated]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedKey(dateToKey(today));
  };

  const quadCounts = useMemo(() => quadrantCountsByDate(todos), [todos]);
  const selectedTodos = useMemo(
    () => todosForDate(todos, selectedKey),
    [todos, selectedKey]
  );
  const parsed = useMemo(() => parseWhen(quick), [quick]);
  const quickTarget = parsed.date ?? selectedKey;

  const jumpTo = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    setCurrentYear(y);
    setCurrentMonth(m - 1);
  };

  const handleQuickAdd = () => {
    const title = parsed.title.trim();
    if (title === "") return;
    setTodos((prev) => addTodoForDate(prev, title, quickTarget));
    setSelectedKey(quickTarget);
    jumpTo(quickTarget);
    setQuick("");
  };

  const handleDayAdd = () => {
    if (dayDraft.trim() === "") return;
    setTodos((prev) => addTodoForDate(prev, dayDraft, selectedKey));
    setDayDraft("");
  };

  const handleSelectCell = (cell: DayData) => {
    setSelectedKey(cell.dateKey);
    if (!cell.isCurrentMonth) jumpTo(cell.dateKey);
  };

  if (!isVisible) return null;

  return (
    <div
      className={styles.chartOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.chartContainer}>
        <div className={styles.productivitySummary}>
          Current Session: {currentTimerInfo}
        </div>

        <div className={styles.chartHeader}>
          <div className={styles.monthYearDisplay}>
            {monthNames[currentMonth]} {currentYear}
          </div>
          <div className={styles.controlsContainer}>
            <div className={styles.todayButton} onClick={handleToday}>
              Today
            </div>
            <button
              className={styles.navButton}
              onClick={handlePrevMonth}
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              className={styles.navButton}
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              ›
            </button>
            {!appInstalled && Boolean(deferredPrompt) && (
              <button onClick={onInstall} className={styles.installButton}>
                Install App
              </button>
            )}
          </div>
        </div>

        {/* Natural-language quick add */}
        <div className={styles.quickRow}>
          <input
            className={styles.quickInput}
            type="text"
            value={quick}
            placeholder="Add a task… e.g. 'next monday gym'"
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleQuickAdd();
              }
            }}
            aria-label="Quick-add a task with a natural-language date"
          />
          <button
            className={styles.quickAddBtn}
            onClick={handleQuickAdd}
            disabled={parsed.title.trim() === ""}
          >
            Add
          </button>
        </div>
        <div className={styles.chip}>
          → <span className={styles.chipDate}>{formatKey(quickTarget)}</span>
          {parsed.date ? "" : " (selected day)"}
        </div>

        <div className={styles.calendarGrid}>
          {dayNames.map((day, index) => (
            <div key={`header-${index}`} className={styles.dayHeader}>
              {day}
            </div>
          ))}

          {monthData.map((day, index) => {
            const tally = quadCounts[day.dateKey];
            const count = tally
              ? tally.q1 + tally.q2 + tally.q3 + tally.q4 + tally.unclassified
              : 0;
            const dotColors = tally ? dayDotColors(tally) : [];
            const isSelected = day.dateKey === selectedKey;
            return (
              <button
                key={`day-${index}`}
                type="button"
                onClick={() => handleSelectCell(day)}
                className={[
                  styles.dayCell,
                  !day.isCurrentMonth ? styles.otherMonth : "",
                  day.isToday ? styles.today : "",
                  isSelected ? styles.selected : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={isSelected}
                aria-current={day.isToday ? "date" : undefined}
                aria-label={`${monthNames[currentMonth]} ${day.date}, ${count} task${
                  count === 1 ? "" : "s"
                }`}
              >
                <div className={styles.dayNumber}>{day.date}</div>
                {dotColors.length > 0 && (
                  <div className={styles.taskDots}>
                    {dotColors.map((color, i) => (
                      <span
                        key={i}
                        className={styles.taskDot}
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                )}
                {day.minutes > 0 && (
                  <div className={styles.minutesValue}>{day.minutes}</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected-day detail */}
        <div className={styles.dayDetail}>
          <div className={styles.dayDetailHeader}>{formatKey(selectedKey)}</div>
          {selectedTodos.length === 0 ? (
            <div className={styles.emptyDay}>Nothing planned for this day.</div>
          ) : (
            <ul className={styles.dayList}>
              {selectedTodos.map((todo) => {
                const q = getQuadrant(todo);
                return (
                <li key={todo.id} className={styles.dayItem}>
                  <label className={styles.dayItemLabel}>
                    <input
                      type="checkbox"
                      className={styles.dayCheckbox}
                      checked={todo.done}
                      onChange={() => setTodos((prev) => toggleTodo(prev, todo.id))}
                    />
                    <span
                      className={q ? styles.qDot : `${styles.qDot} ${styles.qDotUnclassified}`}
                      style={q ? { background: QUADRANT_META[q].color } : undefined}
                      aria-hidden="true"
                    />
                    <span
                      className={todo.done ? styles.dayTitleDone : styles.dayTitle}
                    >
                      {todo.title}
                    </span>
                  </label>
                  <div className={styles.dayActions}>
                    <button
                      className={styles.dayIconBtn}
                      title="Move to backlog (unschedule)"
                      aria-label={`Unschedule "${todo.title}"`}
                      onClick={() =>
                        setTodos((prev) => setTodoDate(prev, todo.id, undefined))
                      }
                    >
                      ↩
                    </button>
                    <button
                      className={`${styles.dayIconBtn} ${styles.dayDelete}`}
                      aria-label={`Delete "${todo.title}"`}
                      onClick={() => setTodos((prev) => deleteTodo(prev, todo.id))}
                    >
                      ×
                    </button>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
          <div className={styles.dayAddRow}>
            <input
              className={styles.quickInput}
              type="text"
              value={dayDraft}
              placeholder={`Add to ${formatKey(selectedKey)}…`}
              onChange={(e) => setDayDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleDayAdd();
                }
              }}
              aria-label="Add a task to the selected day"
            />
            <button
              className={styles.quickAddBtn}
              onClick={handleDayAdd}
              disabled={dayDraft.trim() === ""}
            >
              Add
            </button>
          </div>
        </div>

        <div className={styles.totalTime}>Σ {totalProductivityMinutes} min</div>
      </div>
    </div>
  );
};

export default MonthlyChart;
