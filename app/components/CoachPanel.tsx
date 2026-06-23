"use client";
import { useEffect, useState } from "react";
import type { Todo } from "@/lib/types";
import { loadTodos } from "@/lib/storage";
import {
  COACH_WINDOW_DAYS,
  MIN_ACTIVE_DAYS,
  type DataSufficiency,
  dataSufficiency,
} from "@/lib/ai/snapshot";
import Insights from "./Insights";
import Reflect from "./Reflect";
import styles from "./CoachPanel.module.css";

interface CoachPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * The Coach — a weekly review surface opened from the dock. It always shows the
 * deterministic floor (the time-mix Insights + the satisfaction Reflection), so
 * it's useful with AI off; a later commit adds an AI-narrated summary card on top
 * when the user opts in and enough data exists. Read-only over a snapshot of
 * todos (Reflect manages its own day-log persistence), so no save effect here.
 */
const CoachPanel = ({ isVisible, onClose }: CoachPanelProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [sufficiency, setSufficiency] = useState<DataSufficiency | null>(null);

  // Reload from storage on open (picks up edits made elsewhere).
  useEffect(() => {
    if (isVisible) {
      setTodos(loadTodos());
      setSufficiency(dataSufficiency());
    }
  }, [isVisible]);

  // Close on Escape.
  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const ready = sufficiency?.ready ?? false;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.container}
        role="dialog"
        aria-modal="true"
        aria-label="Coach"
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Coach</h2>
          <p className={styles.subtitle}>Your last {COACH_WINDOW_DAYS} days</p>
        </header>

        <div className={styles.scroll}>
          {!ready && (
            <div className={styles.learning}>
              <span className={styles.learningDot} aria-hidden="true" />
              <p className={styles.learningText}>
                Still learning your patterns — your weekly review unlocks after about{" "}
                {MIN_ACTIVE_DAYS} active days
                {sufficiency ? ` (${sufficiency.activeDays} so far)` : ""}. Keep planning,
                focusing, and checking in below.
              </p>
            </div>
          )}

          <div className={styles.grid}>
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Time mix</h3>
              <Insights todos={todos} />
            </section>
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Reflection</h3>
              <Reflect />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachPanel;
