"use client";
import React, { useEffect, useRef, useState } from "react";
import type { Habit } from "@/lib/types";
import { dateToKey } from "@/lib/persist";
import {
  loadHabits,
  saveHabits,
  addHabit,
  deleteHabit,
  toggleCheckin,
  isDoneOn,
  currentStreak,
  recentDays,
} from "@/lib/habits";
import styles from "./HabitPanel.module.css";

interface HabitPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const STRIP_DAYS = 7;

const HabitPanel = ({ isVisible, onClose }: HabitPanelProps) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [draft, setDraft] = useState<string>("");
  const [hydrated, setHydrated] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load persisted habits after mount (never read storage during render).
  useEffect(() => {
    setHabits(loadHabits());
    setHydrated(true);
  }, []);

  // Persist on change, but only after the initial load so the empty starting
  // state can't clobber stored data.
  useEffect(() => {
    if (hydrated) {
      saveHabits(habits);
    }
  }, [habits, hydrated]);

  // Focus the input whenever the panel opens.
  useEffect(() => {
    if (isVisible) {
      inputRef.current?.focus();
    }
  }, [isVisible]);

  const handleAdd = () => {
    if (draft.trim() === "") return;
    setHabits((prev) => addHabit(prev, draft));
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleToggleToday = (id: string, todayKey: string) => {
    setHabits((prev) => toggleCheckin(prev, id, todayKey));
  };

  const handleDelete = (id: string) => {
    setHabits((prev) => deleteHabit(prev, id));
  };

  if (!isVisible) return null;

  const today = new Date();
  const todayKey = dateToKey(today);
  const sorted = [...habits].sort((a, b) => a.order - b.order);
  const doneToday = sorted.filter((h) => isDoneOn(h, todayKey)).length;

  return (
    <div
      className={styles.habitOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.habitContainer}
        role="dialog"
        aria-modal="true"
        aria-label="Habits and streaks"
      >
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close habits"
        >
          ×
        </button>

        <div className={styles.header}>
          <h2 className={styles.title}>Habits</h2>
          <span className={styles.subtitle}>Build the chain</span>
        </div>

        <div className={styles.addRow}>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={draft}
            placeholder="Add a habit… (Gym, Read, Water)"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="New habit"
          />
          <button
            className={styles.addButton}
            onClick={handleAdd}
            disabled={draft.trim() === ""}
            aria-label="Add habit"
          >
            +
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className={styles.emptyState}>
            No habits yet — add one you want to do every day (Gym, Read, Meditate…).
          </div>
        ) : (
          <ul className={styles.list}>
            {sorted.map((habit) => {
              const done = isDoneOn(habit, todayKey);
              const streak = currentStreak(habit, today);
              return (
                <li key={habit.id} className={styles.item}>
                  <button
                    className={done ? styles.checkDone : styles.check}
                    onClick={() => handleToggleToday(habit.id, todayKey)}
                    aria-pressed={done}
                    aria-label={
                      done
                        ? `Mark "${habit.name}" not done today`
                        : `Mark "${habit.name}" done today`
                    }
                  >
                    {done ? "✓" : ""}
                  </button>

                  <div className={styles.main}>
                    <div className={styles.topRow}>
                      <span className={styles.name}>
                        {habit.emoji ? `${habit.emoji} ` : ""}
                        {habit.name}
                      </span>
                      <span
                        className={streak > 0 ? styles.streak : styles.streakZero}
                        title="Current streak"
                      >
                        🔥 {streak}
                      </span>
                    </div>
                    <div className={styles.strip} aria-hidden="true">
                      {recentDays(habit, STRIP_DAYS, today).map((d) => (
                        <span
                          key={d.key}
                          className={[
                            styles.dot,
                            d.done ? styles.dotDone : "",
                            d.isToday ? styles.dotToday : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDelete(habit.id)}
                    aria-label={`Delete habit "${habit.name}"`}
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
            {doneToday === sorted.length
              ? "All habits done today 🎉"
              : `${doneToday} of ${sorted.length} done today`}
          </div>
        )}
      </div>
    </div>
  );
};

export default HabitPanel;
