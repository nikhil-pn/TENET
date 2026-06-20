"use client";
import { useEffect, useState } from "react";
import type { Todo } from "@/lib/types";
import type { DockPanel } from "./NavDock";
import { loadTodos } from "@/lib/storage";
import {
  importantReminders,
  deadlineStatus,
  formatDeadline,
  DEADLINE_META,
} from "@/lib/deadlines";
import styles from "./DeadlineReminder.module.css";

interface DeadlineReminderProps {
  /** Which panel is open (null = home screen). The reminder only shows on home. */
  activePanel: DockPanel | null;
  onOpenTasks: () => void;
}

/**
 * A quiet home-screen reminder: appears only when an *important* task has an
 * approaching (overdue / today / soon) deadline. Tapping it opens Tasks. When
 * nothing is due it renders nothing — no permanent UI, no nagging.
 */
export default function DeadlineReminder({
  activePanel,
  onOpenTasks,
}: DeadlineReminderProps) {
  const [todos, setTodos] = useState<Todo[]>([]);

  // Refresh on the home screen (mount, and whenever a panel closes back to home).
  useEffect(() => {
    if (activePanel === null) setTodos(loadTodos());
  }, [activePanel]);

  if (activePanel !== null) return null;
  const items = importantReminders(todos);
  if (items.length === 0) return null;

  const shown = items.slice(0, 2);
  const extra = items.length - shown.length;

  return (
    <button
      type="button"
      className={styles.card}
      onClick={onOpenTasks}
      aria-label={`${items.length} important deadline${
        items.length === 1 ? "" : "s"
      } coming up — open tasks`}
    >
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true">
          ⏰
        </span>
        <span className={styles.title}>Coming up</span>
        <span className={styles.count}>{items.length}</span>
      </div>
      <ul className={styles.list}>
        {shown.map((t) => {
          const status = deadlineStatus({ deadline: t.deadline });
          const color = status ? DEADLINE_META[status].color : undefined;
          return (
            <li key={t.id} className={styles.item}>
              <span className={styles.flag} style={{ color }} aria-hidden="true">
                ⚑
              </span>
              <span className={styles.itemTitle}>{t.title}</span>
              <span className={styles.due} style={{ color }}>
                {t.deadline ? formatDeadline(t.deadline) : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <div className={styles.more}>
        {extra > 0 ? `+${extra} more · tap to view` : "tap to view"}
      </div>
    </button>
  );
}
