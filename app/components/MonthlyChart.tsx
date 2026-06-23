"use client";
// Calendar (opened from the dock's Calendar button). Each day shows its focus
// minutes; double-click a day to open a little popover (Google-Calendar style)
// and add/edit/delete events & reminders pinned to that date. Events surface as
// small chips on the day. Also keeps the session/total productivity display.
import { useState, useEffect, useMemo } from "react";
import type { Note } from "@/lib/types";
import { dateToKey } from "@/lib/persist";
import { subscribeWrites } from "@/lib/persist";
import { buildMonthMatrix } from "@/lib/calendar";
import {
  loadNotes,
  saveNotes,
  addNote,
  updateNote,
  deleteNote,
  eventsForDate,
  eventsByDate,
} from "@/lib/notes";
import {
  loadContributions,
  getGitHubUsername,
  type ContribMap,
} from "@/lib/github/contributions";
import styles from "./MonthlyChart.module.css";

interface DayData {
  date: number;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
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

// Popover footprint (approx) used to keep it on-screen.
const POP_W = 300;
const POP_H = 300;

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
  const [totalProductivityMinutes, setTotalProductivityMinutes] = useState(0);

  // GitHub contribution heatmap (opt-in; both null when not signed in w/ GitHub).
  const [contrib, setContrib] = useState<ContribMap | null>(null);
  const [ghUser, setGhUser] = useState<string | null>(null);

  // Events (stored as "event" notes). The calendar reads/writes these.
  const [notes, setNotes] = useState<Note[]>([]);

  // Event editor popover state.
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [editorPos, setEditorPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const [evTitle, setEvTitle] = useState("");
  const [evBody, setEvBody] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

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
        return {
          date: cell.date,
          dateKey: cell.dateKey,
          isCurrentMonth: cell.isCurrentMonth,
          isToday: cell.isToday,
          minutes,
        };
      });
      setMonthData(enriched);

      const productiveTime = localStorage.getItem("productiveTime");
      if (productiveTime) setTotalProductivityMinutes(parseInt(productiveTime, 10));
    }
  }, [currentMonth, currentYear, isVisible]);

  // Load events when the panel opens, and keep in sync with external writes.
  useEffect(() => {
    if (!isVisible) return;
    setNotes(loadNotes());
    const unsub = subscribeWrites((key) => {
      if (typeof key === "string" && key.includes("notes")) setNotes(loadNotes());
    });
    return unsub;
  }, [isVisible]);

  // GitHub contribution heatmap — load the displayed year's public commit
  // calendar when the panel opens. Stays null when not signed in with GitHub;
  // cached on-device and never throws, so the calendar is unaffected if it fails.
  useEffect(() => {
    if (!isVisible) return;
    setGhUser(getGitHubUsername());
    let cancelled = false;
    loadContributions(currentYear).then((map) => {
      if (!cancelled) setContrib(map);
    });
    return () => {
      cancelled = true;
    };
  }, [currentYear, isVisible]);

  // Close the editor whenever the panel itself closes.
  useEffect(() => {
    if (!isVisible) closeEditor();
  }, [isVisible]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    closeEditor();
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    closeEditor();
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    closeEditor();
  };

  const eventMap = useMemo(() => eventsByDate(notes), [notes]);
  const dayEvents = useMemo(
    () => (editorKey ? eventsForDate(notes, editorKey) : []),
    [notes, editorKey]
  );

  const jumpTo = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    setCurrentYear(y);
    setCurrentMonth(m - 1);
  };

  // ── Event editor ──────────────────────────────────────────────────────────
  function closeEditor() {
    setEditorKey(null);
    setEditorPos(null);
    setEvTitle("");
    setEvBody("");
    setEditingEventId(null);
  }

  const openEditor = (cell: DayData, rect: DOMRect) => {
    if (!cell.isCurrentMonth) jumpTo(cell.dateKey);
    // Position a fixed popover near the cell, clamped on-screen.
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + POP_W > window.innerWidth - 12) left = window.innerWidth - 12 - POP_W;
    if (left < 12) left = 12;
    if (top + POP_H > window.innerHeight - 12) {
      top = Math.max(12, rect.top - 6 - POP_H);
    }
    setEditorKey(cell.dateKey);
    setEditorPos({ top, left });
    setEvTitle("");
    setEvBody("");
    setEditingEventId(null);
  };

  const handleDayDoubleClick = (
    cell: DayData,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    openEditor(cell, e.currentTarget.getBoundingClientRect());
  };

  const saveEvent = () => {
    const title = evTitle.trim();
    if (title === "" || editorKey === null) return;
    const body = evBody.trim();
    const next = editingEventId
      ? updateNote(loadNotes(), editingEventId, { title, body })
      : addNote(loadNotes(), { kind: "event", date: editorKey, title, body });
    saveNotes(next);
    setNotes(next);
    setEvTitle("");
    setEvBody("");
    setEditingEventId(null);
  };

  const editEvent = (note: Note) => {
    setEditingEventId(note.id);
    setEvTitle(note.title);
    setEvBody(note.body);
  };

  const removeEvent = (id: string) => {
    const next = deleteNote(loadNotes(), id);
    saveNotes(next);
    setNotes(next);
    if (editingEventId === id) {
      setEditingEventId(null);
      setEvTitle("");
      setEvBody("");
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={styles.chartOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.chartContainer}
        role="dialog"
        aria-modal="true"
        aria-label="Calendar"
      >
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

        <div className={styles.hintRow}>Double-click a day to add an event.</div>

        <div className={styles.calendarGrid}>
          {dayNames.map((day, index) => (
            <div key={`header-${index}`} className={styles.dayHeader}>
              {day}
            </div>
          ))}

          {monthData.map((day, index) => {
            const events = eventMap[day.dateKey] ?? [];
            const isEditing = day.dateKey === editorKey;
            const commits = day.isCurrentMonth
              ? contrib?.[day.dateKey]
              : undefined;
            const commitCount = commits?.count ?? 0;
            return (
              <button
                key={`day-${index}`}
                type="button"
                onDoubleClick={(e) => handleDayDoubleClick(day, e)}
                className={[
                  styles.dayCell,
                  !day.isCurrentMonth ? styles.otherMonth : "",
                  day.isToday ? styles.today : "",
                  isEditing ? styles.selected : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={`${monthNames[currentMonth]} ${day.date}, ${
                  events.length
                } event${events.length === 1 ? "" : "s"}${
                  commitCount > 0
                    ? `, ${commitCount} GitHub commit${
                        commitCount === 1 ? "" : "s"
                      }`
                    : ""
                }`}
              >
                <span className={styles.dayNumber}>{day.date}</span>

                {commits && commits.count > 0 && (
                  <span
                    className={styles.contribSquare}
                    data-level={commits.level}
                    title={`${commits.count} contribution${
                      commits.count === 1 ? "" : "s"
                    } on GitHub`}
                    aria-hidden="true"
                  />
                )}

                {events.length > 0 && (
                  <span className={styles.cellEvents}>
                    {events.slice(0, 2).map((ev) => (
                      <span
                        key={ev.id}
                        className={styles.cellEvent}
                        title={ev.body || ev.title}
                      >
                        {ev.title}
                      </span>
                    ))}
                    {events.length > 2 && (
                      <span className={styles.cellEventMore}>
                        +{events.length - 2} more
                      </span>
                    )}
                  </span>
                )}

                {day.minutes > 0 && (
                  <span className={styles.minutesValue}>{day.minutes}m</span>
                )}
              </button>
            );
          })}
        </div>

        {ghUser && (
          <div className={styles.ghFooter}>
            <span className={styles.ghLegend} aria-hidden="true">
              <span className={styles.ghLegendLabel}>commits</span>
              <i className={styles.ghSwatch} data-level="1" />
              <i className={styles.ghSwatch} data-level="2" />
              <i className={styles.ghSwatch} data-level="3" />
              <i className={styles.ghSwatch} data-level="4" />
            </span>
            <a
              className={styles.ghNudge}
              href="https://github.com/settings/profile"
              target="_blank"
              rel="noopener noreferrer"
              title="Opens GitHub → Public profile. Turn on “Include private contributions on my profile” to count your private repos here too."
            >
              include private →
            </a>
          </div>
        )}

        <div className={styles.totalTime}>Σ {totalProductivityMinutes} min</div>
      </div>

      {/* Google-Calendar-style event popover */}
      {editorKey && editorPos && (
        <>
          <div className={styles.eventPopBackdrop} onClick={closeEditor} />
          <div
            className={styles.eventPop}
            style={{ top: editorPos.top, left: editorPos.left }}
            role="dialog"
            aria-label={`Events for ${formatKey(editorKey)}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.eventPopHeader}>
              <span className={styles.eventPopDate}>{formatKey(editorKey)}</span>
            </div>

            {dayEvents.length > 0 && (
              <ul className={styles.eventPopList}>
                {dayEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className={
                      editingEventId === ev.id
                        ? styles.eventPopItemActive
                        : styles.eventPopItem
                    }
                  >
                    <span className={styles.eventPopItemDot} aria-hidden="true" />
                    <button
                      type="button"
                      className={styles.eventPopItemText}
                      onClick={() => editEvent(ev)}
                      title={ev.body || "Edit"}
                    >
                      {ev.title}
                    </button>
                    <button
                      type="button"
                      className={styles.eventPopItemDel}
                      onClick={() => removeEvent(ev.id)}
                      aria-label={`Delete "${ev.title}"`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input
              className={styles.eventPopTitle}
              type="text"
              value={evTitle}
              autoFocus
              placeholder={editingEventId ? "Edit event…" : "Add title…"}
              onChange={(e) => setEvTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveEvent();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  closeEditor();
                }
              }}
              aria-label="Event title"
            />
            <textarea
              className={styles.eventPopBody}
              value={evBody}
              placeholder="Add details (optional)…"
              onChange={(e) => setEvBody(e.target.value)}
              rows={2}
              aria-label="Event details"
            />
            <div className={styles.eventPopActions}>
              {editingEventId && (
                <button
                  type="button"
                  className={styles.eventPopCancel}
                  onClick={() => {
                    setEditingEventId(null);
                    setEvTitle("");
                    setEvBody("");
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className={styles.eventPopSave}
                onClick={saveEvent}
                disabled={evTitle.trim() === ""}
              >
                {editingEventId ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MonthlyChart;
