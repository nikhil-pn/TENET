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
import styles from "./TodoPanel.module.css";

interface TodoPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const TodoPanel = ({ isVisible, onClose }: TodoPanelProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<string>("");
  const [hydrated, setHydrated] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load persisted todos when the panel opens (picks up edits from the calendar).
  useEffect(() => {
    if (isVisible) {
      setTodos(loadTodos());
      setHydrated(true);
    }
  }, [isVisible]);

  // Persist on change, but only after the initial load so the empty starting
  // state can't clobber stored data.
  useEffect(() => {
    if (hydrated) {
      saveTodos(todos);
    }
  }, [todos, hydrated]);

  // Focus the input whenever the panel opens.
  useEffect(() => {
    if (isVisible) {
      inputRef.current?.focus();
    }
  }, [isVisible]);

  const handleAdd = () => {
    if (draft.trim() === "") return;
    setTodos((prev) => addTodo(prev, draft));
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleToggle = (id: string) => {
    setTodos((prev) => toggleTodo(prev, id));
  };

  const handleDelete = (id: string) => {
    setTodos((prev) => deleteTodo(prev, id));
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

  return (
    <div
      className={styles.todoOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.todoContainer}
        role="dialog"
        aria-modal="true"
        aria-label="Daily checklist"
      >
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close checklist"
        >
          ×
        </button>

        <div className={styles.header}>
          <h2 className={styles.title}>To-Do</h2>
          <span className={styles.subtitle}>{todayLabel}</span>
        </div>

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

        {sorted.length === 0 ? (
          <div className={styles.emptyState}>
            Nothing yet — add what you want to get done today.
          </div>
        ) : (
          <ul className={styles.list}>
            {sorted.map((todo) => (
              <li key={todo.id} className={styles.item}>
                <label className={styles.itemLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={todo.done}
                    onChange={() => handleToggle(todo.id)}
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
                  onClick={() => handleDelete(todo.id)}
                  aria-label={`Delete "${todo.title}"`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {sorted.length > 0 && (
          <div className={styles.footer}>
            {remaining === 0
              ? "All done 🎉"
              : `${remaining} of ${visible.length} remaining`}
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoPanel;
