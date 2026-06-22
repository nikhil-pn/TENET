"use client";

import { useState } from "react";
import type { Todo } from "@/lib/types";
import {
  type Quadrant,
  QUADRANT_META,
  estimatePomodoros,
  quadrantBreakdown,
  todosByQuadrant,
} from "@/lib/prioritization";
import {
  deleteTodo,
  setTodoFlags,
  toggleTodo,
} from "@/lib/storage";
import styles from "./EisenhowerMatrix.module.css";

interface EisenhowerMatrixProps {
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  /** Start a Pomodoro focus session for this task (shown on Q1/Q2 cards). */
  onStartFocus?: (todo: Todo) => void;
}

/** Canonical 2×2 order: top row = Important, left column = Urgent. */
const QUADRANT_ORDER: readonly Quadrant[] = ["q1", "q2", "q3", "q4"];

/** The (important, urgent) axes a quadrant represents — used by drop-to-reclassify. */
const QUADRANT_AXES: Record<Quadrant, { important: boolean; urgent: boolean }> = {
  q1: { important: true, urgent: true },
  q2: { important: true, urgent: false },
  q3: { important: false, urgent: true },
  q4: { important: false, urgent: false },
};

/** dataTransfer key for drag-to-reclassify. */
const DRAG_TYPE = "text/plain";

/** Cards shown per quadrant before a "Show more" button (avoids a long column). */
const VISIBLE_LIMIT = 6;

export default function EisenhowerMatrix({
  todos,
  setTodos,
  onStartFocus,
}: EisenhowerMatrixProps) {
  const breakdown = quadrantBreakdown(todos);
  const buckets = todosByQuadrant(todos);
  // Which quadrant section is currently a drag-hover target (for the highlight).
  const [dragOverQuadrant, setDragOverQuadrant] = useState<Quadrant | null>(null);
  // Quadrants whose full task list is expanded (past VISIBLE_LIMIT).
  const [expanded, setExpanded] = useState<Set<Quadrant>>(new Set());

  const toggleExpanded = (q: Quadrant): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  };

  const handleToggle = (id: string): void => {
    setTodos((prev) => toggleTodo(prev, id));
  };

  const handleDelete = (id: string): void => {
    setTodos((prev) => deleteTodo(prev, id));
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string): void => {
    e.dataTransfer.setData(DRAG_TYPE, id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>, q: Quadrant): void => {
    e.preventDefault();
    setDragOverQuadrant(null);
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (!id) return;
    setTodos((prev) => setTodoFlags(prev, id, QUADRANT_AXES[q]));
  };

  // q === null ⇒ an unclassified card (no quadrant-colored left border).
  const renderCard = (t: Todo, q: Quadrant | null) => {
    const pomodoros = estimatePomodoros(t.estimatedMinutes);
    return (
      <div
        key={t.id}
        className={styles.card}
        draggable
        onDragStart={(e) => handleDragStart(e, t.id)}
      >
        <button
          type="button"
          className={t.done ? styles.checkDone : styles.check}
          onClick={() => handleToggle(t.id)}
          aria-label={t.done ? "Mark as not done" : "Mark as done"}
          aria-pressed={t.done}
        >
          {t.done ? "✓" : ""}
        </button>

        <div className={styles.cardMain}>
          <span className={t.done ? styles.titleDone : styles.title}>{t.title}</span>
          <div className={styles.cardControls}>
            {(q === "q1" || q === "q2") && onStartFocus && !t.done && (
              <button
                type="button"
                className={styles.focusBtn}
                onClick={() => onStartFocus(t)}
                title="Start a focus session"
                aria-label="Start a focus session"
              >
                ▶
              </button>
            )}
            {pomodoros > 0 && (
              <span className={styles.estimate} title={`${t.estimatedMinutes} min`}>
                <span className={styles.estimateIcon}>🍅</span>
                {pomodoros}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => handleDelete(t.id)}
          aria-label="Delete task"
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid}>
        {QUADRANT_ORDER.map((q) => {
          const meta = QUADRANT_META[q];
          const items = buckets[q];
          const isExp = expanded.has(q);
          const shown = isExp ? items : items.slice(0, VISIBLE_LIMIT);
          const isDragOver = dragOverQuadrant === q;
          return (
            <section
              key={q}
              className={isDragOver ? styles.quadrantDragOver : styles.quadrant}
              style={{ borderTopColor: meta.color }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverQuadrant !== q) setDragOverQuadrant(q);
              }}
              onDragLeave={() => setDragOverQuadrant((cur) => (cur === q ? null : cur))}
              onDrop={(e) => handleDrop(e, q)}
            >
              <header className={styles.quadrantHeader}>
                <span className={styles.quadrantName}>
                  <span className={styles.quadrantDot} style={{ background: meta.color }} />
                  {meta.name}
                </span>
                <span className={styles.quadrantMeta}>
                  <span className={styles.quadrantAction}>{meta.action}</span>
                  <span className={styles.quadrantPct}>{breakdown[q]}%</span>
                </span>
              </header>
              <div className={styles.quadrantBody}>
                {items.length === 0 ? (
                  <span className={styles.empty}>—</span>
                ) : (
                  <>
                    {shown.map((t) => renderCard(t, q))}
                    {items.length > VISIBLE_LIMIT && (
                      <button
                        type="button"
                        className={styles.showMore}
                        onClick={() => toggleExpanded(q)}
                      >
                        {isExp
                          ? "Show less"
                          : `Show ${items.length - VISIBLE_LIMIT} more`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {buckets.unclassified.length > 0 && (
        <section className={styles.unclassified}>
          <header className={styles.unclassifiedHeader}>
            <span className={styles.unclassifiedTitle}>Unclassified</span>
            <span className={styles.unclassifiedHint}>Tap Imp / Urg to sort these</span>
          </header>
          <div className={styles.unclassifiedBody}>
            {buckets.unclassified.map((t) => renderCard(t, null))}
          </div>
        </section>
      )}
    </div>
  );
}
