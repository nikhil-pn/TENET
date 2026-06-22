"use client";
import { useEffect, useState } from "react";
import type { Todo } from "@/lib/types";
import { loadTodos, saveTodos } from "@/lib/storage";
import { setActiveSessionTask } from "@/lib/session";
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
          <div className={styles.titleBlock}>
            <h2 className={styles.title}>Matrix</h2>
          </div>
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
