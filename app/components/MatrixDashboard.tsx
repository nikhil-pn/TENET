"use client";
import { useEffect, useState } from "react";
import type { Todo } from "@/lib/types";
import { loadTodos, saveTodos } from "@/lib/storage";
import { setActiveSessionTask } from "@/lib/session";
import {
  REFERENCE_IMPORTANT_SHARE,
  nudges,
  quadrantBreakdown,
} from "@/lib/prioritization";
import EisenhowerMatrix from "./EisenhowerMatrix";
import styles from "./MatrixDashboard.module.css";

interface MatrixDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Full-screen priority-matrix dashboard, opened from the dock's Matrix icon.
 * On laptop the four quadrants sit side-by-side across the width; on mobile they
 * stack into the classic square. Below the matrix: the time-mix insights and the
 * daily reflection. (Moved out of the Tasks modal so it gets the whole screen.)
 */
const MatrixDashboard = ({ isVisible, onClose }: MatrixDashboardProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Reload from storage on open (picks up edits made elsewhere).
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

  // Close on Escape.
  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isVisible, onClose]);

  // Start a focus session: mark the task active, close the dashboard, and kick
  // the Pomodoro timer via its toggle (Clock credits the task on completion).
  const handleStartFocus = (todo: Todo) => {
    setActiveSessionTask(todo.id);
    onClose();
    if (typeof document !== "undefined") {
      const el = document.getElementById("main-toggle") as HTMLInputElement | null;
      if (el && !el.checked) el.click();
    }
  };

  if (!isVisible) return null;

  // Live focus-health summary for the header strip (the "where to focus" tip).
  const breakdown = quadrantBreakdown(todos);
  const hasData = breakdown.classifiedCount > 0;
  const onTrack = breakdown.importantSharePct >= REFERENCE_IMPORTANT_SHARE;
  const topTip = nudges(breakdown)[0];
  const focusMessage = topTip
    ? topTip.message
    : onTrack
      ? "Great balance — most of your effort is on important work."
      : "Solid start. Protect a block for important, not-urgent work.";

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.container}
        role="dialog"
        aria-modal="true"
        aria-label="Priority matrix"
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Matrix</h2>

          {hasData ? (
            <div className={styles.statusBar}>
              <div className={styles.meterBlock}>
                <div className={styles.meterTop}>
                  <span className={styles.meterLabel}>Important work</span>
                  <span className={styles.meterValue}>
                    <span className={onTrack ? styles.meterNowOn : styles.meterNow}>
                      {breakdown.importantSharePct}%
                    </span>
                    <span className={styles.meterRef}> / {REFERENCE_IMPORTANT_SHARE}%</span>
                  </span>
                </div>
                <div className={styles.meterTrack}>
                  <div
                    className={onTrack ? styles.meterFillOn : styles.meterFill}
                    style={{ width: `${breakdown.importantSharePct}%` }}
                  />
                  <div
                    className={styles.meterMarker}
                    style={{ left: `${REFERENCE_IMPORTANT_SHARE}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
              <p className={styles.tip}>
                <span className={styles.tipDot} aria-hidden="true" />
                <span className={styles.tipText}>{focusMessage}</span>
              </p>
            </div>
          ) : (
            <div className={styles.statusBar}>
              <p className={styles.tipText}>
                Classify a few tasks to see your focus mix and tips.
              </p>
            </div>
          )}
        </header>

        <div className={styles.scroll}>
          <EisenhowerMatrix
            todos={todos}
            setTodos={setTodos}
            onStartFocus={handleStartFocus}
          />
        </div>
      </div>
    </div>
  );
};

export default MatrixDashboard;
