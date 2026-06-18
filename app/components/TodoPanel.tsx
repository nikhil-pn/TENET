"use client";
import React, { useEffect, useRef, useState } from "react";
import type { Todo } from "@/lib/types";
import {
  loadTodos,
  saveTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
} from "@/lib/storage";
import { dateToKey } from "@/lib/persist";
import { setActiveSessionTask } from "@/lib/session";
import {
  getQuadrant,
  QUADRANT_META,
  TWO_MIN_MAX,
  LONG_TASK_MIN,
} from "@/lib/prioritization";
import EisenhowerMatrix from "./EisenhowerMatrix";
import Insights from "./Insights";
import Reflect from "./Reflect";
import styles from "./TodoPanel.module.css";

interface TodoPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

type TaskTab = "list" | "matrix" | "insights";

const ESTIMATE_CHIPS: { label: string; minutes: number }[] = [
  { label: "2m", minutes: 2 },
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h+", minutes: 120 },
];

const TodoPanel = ({ isVisible, onClose }: TodoPanelProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<string>("");
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [tab, setTab] = useState<TaskTab>("list");

  // Classification for the add strip (new tasks default to Q2 "Schedule").
  const [cImportant, setCImportant] = useState<boolean>(true);
  const [cUrgent, setCUrgent] = useState<boolean>(false);
  const [cEstimate, setCEstimate] = useState<number | undefined>(undefined);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load persisted todos when the panel opens (picks up edits from the calendar).
  useEffect(() => {
    if (isVisible) {
      setTodos(loadTodos());
      setHydrated(true);
      setTab("list");
    }
  }, [isVisible]);

  // Persist after the initial load so the empty starting state can't clobber storage.
  useEffect(() => {
    if (hydrated) {
      saveTodos(todos);
    }
  }, [todos, hydrated]);

  // Focus the input when the List tab is shown.
  useEffect(() => {
    if (isVisible && tab === "list") {
      inputRef.current?.focus();
    }
  }, [isVisible, tab]);

  const handleAdd = () => {
    if (draft.trim() === "") return;
    setTodos((prev) =>
      addTodo(prev, draft, {
        important: cImportant,
        urgent: cUrgent,
        estimatedMinutes: cEstimate,
      })
    );
    setDraft("");
    setCEstimate(undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  // Start a focus session for a task: mark it active, close the panel, and
  // start the existing Pomodoro timer via its toggle (Clock credits the task
  // on completion). Uses click() so React's controlled checkbox stays in sync.
  const handleStartFocus = (todo: Todo) => {
    setActiveSessionTask(todo.id);
    onClose();
    if (typeof document !== "undefined") {
      const el = document.getElementById("main-toggle") as HTMLInputElement | null;
      if (el && !el.checked) el.click();
    }
  };

  if (!isVisible) return null;

  // Checklist shows the backlog (undated) + anything due today; scheduled
  // future tasks live on the calendar instead.
  const todayKey = dateToKey();
  const visible = todos.filter((t) => !t.date || t.date === todayKey);
  const sorted = [...visible].sort((a, b) => a.order - b.order);
  const remaining = visible.filter((t) => !t.done).length;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const draftQuadrant = getQuadrant({ important: cImportant, urgent: cUrgent });
  const draftMeta = draftQuadrant ? QUADRANT_META[draftQuadrant] : null;
  const quickWin =
    cImportant && cEstimate !== undefined && cEstimate <= TWO_MIN_MAX;
  const needsPlan =
    cImportant && cEstimate !== undefined && cEstimate >= LONG_TASK_MIN;

  return (
    <div
      className={styles.todoOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.todoContainer}
        role="dialog"
        aria-modal="true"
        aria-label="Tasks"
      >
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close tasks"
        >
          ×
        </button>

        <div className={styles.header}>
          <h2 className={styles.title}>Tasks</h2>
          <span className={styles.subtitle}>{todayLabel}</span>
        </div>

        <div className={styles.tabBar} role="tablist" aria-label="Task views">
          {(["list", "matrix", "insights"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? styles.tabActive : styles.tab}
              onClick={() => setTab(t)}
            >
              {t === "list" ? "List" : t === "matrix" ? "Matrix" : "Insights"}
            </button>
          ))}
        </div>

        {tab === "list" && (
          <>
            <div className={styles.addRow}>
              <input
                ref={inputRef}
                className={styles.input}
                type="text"
                value={draft}
                placeholder="Add a task…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="New task"
              />
              <button
                className={styles.addButton}
                onClick={handleAdd}
                disabled={draft.trim() === ""}
                aria-label="Add task"
              >
                +
              </button>
            </div>

            {/* Classify-on-add: Important / Urgent / estimate → live quadrant badge */}
            <div className={styles.classifyRow}>
              <button
                type="button"
                className={cImportant ? styles.flagOnImp : styles.flag}
                aria-pressed={cImportant}
                onClick={() => setCImportant((v) => !v)}
              >
                Important
              </button>
              <button
                type="button"
                className={cUrgent ? styles.flagOnUrg : styles.flag}
                aria-pressed={cUrgent}
                onClick={() => setCUrgent((v) => !v)}
              >
                Urgent
              </button>
              <div className={styles.chips}>
                {ESTIMATE_CHIPS.map((c) => (
                  <button
                    key={c.minutes}
                    type="button"
                    className={
                      cEstimate === c.minutes ? styles.chipActive : styles.estChip
                    }
                    onClick={() =>
                      setCEstimate((v) => (v === c.minutes ? undefined : c.minutes))
                    }
                    aria-pressed={cEstimate === c.minutes}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {draftMeta && (
                <span
                  className={styles.quadBadge}
                  style={{ background: draftMeta.color }}
                >
                  {draftMeta.short}
                </span>
              )}
            </div>
            {(quickWin || needsPlan) && (
              <div className={styles.hintLine}>
                {quickWin
                  ? "⚡ 2-min task — just do it, no need to schedule."
                  : "🧱 Long task — consider a ~90-min block or break it down."}
              </div>
            )}

            {sorted.length === 0 ? (
              <div className={styles.emptyState}>
                Nothing yet — add what you want to get done today.
              </div>
            ) : (
              <ul className={styles.list}>
                {sorted.map((todo) => {
                  const q = getQuadrant(todo);
                  return (
                    <li key={todo.id} className={styles.item}>
                      <label className={styles.itemLabel}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={todo.done}
                          onChange={() =>
                            setTodos((prev) => toggleTodo(prev, todo.id))
                          }
                        />
                        <span
                          className={styles.qDot}
                          style={q ? { background: QUADRANT_META[q].color } : undefined}
                          data-unclassified={q ? undefined : "true"}
                          title={q ? QUADRANT_META[q].name : "Unclassified"}
                          aria-hidden="true"
                        />
                        <span
                          className={
                            todo.done ? styles.titleTextDone : styles.titleText
                          }
                        >
                          {todo.title}
                        </span>
                      </label>
                      <button
                        className={styles.deleteButton}
                        onClick={() => setTodos((prev) => deleteTodo(prev, todo.id))}
                        aria-label={`Delete "${todo.title}"`}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {sorted.length > 0 && (
              <div className={styles.footer}>
                {remaining === 0
                  ? "All done 🎉"
                  : `${remaining} of ${visible.length} remaining`}
              </div>
            )}
          </>
        )}

        {tab === "matrix" && (
          <div className={styles.tabBody}>
            <EisenhowerMatrix
              todos={todos}
              setTodos={setTodos}
              onStartFocus={handleStartFocus}
            />
          </div>
        )}

        {tab === "insights" && (
          <div className={styles.tabBody}>
            <Insights todos={todos} />
            <Reflect />
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoPanel;
