"use client";
import React, { useEffect, useState } from "react";
import type { Habit } from "@/lib/types";
import { dateToKey } from "@/lib/persist";
import { subscribeWrites } from "@/lib/persist";
import {
  loadHabits,
  saveHabits,
  toggleCheckin,
  deleteHabit,
  isDoneOn,
  currentStreak,
  recentDays,
} from "@/lib/habits";
import styles from "./HabitTracker.module.css";

const STRIP_DAYS = 7;

/**
 * Habit tracker pinned to the home screen (top-left, mirroring the sticky notes
 * on the right). Habits are created from the Tasks modal's Habit tab; here they
 * surface as clean little tracker cards you can check off for the day. Reads the
 * same habits the old Habits panel used and reloads through the persistence
 * write-seam so a habit added in the modal appears instantly.
 */
const HabitTracker = () => {
  const [habits, setHabits] = useState<Habit[]>([]);

  useEffect(() => {
    const reload = () => setHabits(loadHabits());
    reload();
    // Re-read whenever habits are written (add from the modal, toggle/delete
    // here, or a cloud sync pull). Ignore unrelated writes (todos, notes, …).
    const unsub = subscribeWrites((key) => {
      if (typeof key === "string" && key.includes("habits")) reload();
    });
    return unsub;
  }, []);

  const todayKey = dateToKey();
  const today = new Date();

  const handleToggle = (id: string) => {
    saveHabits(toggleCheckin(loadHabits(), id, todayKey));
  };

  const handleDelete = (id: string) => {
    saveHabits(deleteHabit(loadHabits(), id));
  };

  // Once a habit is checked off for the day it drops off the home screen — a
  // recurring daily task you've already done shouldn't keep taking up space.
  // The check-in still lives in storage (streak intact); when the local day
  // rolls to a new `dateToKey()` it's "not done" again and reappears.
  const sorted = [...habits]
    .filter((habit) => !isDoneOn(habit, todayKey))
    .sort((a, b) => a.order - b.order);

  if (sorted.length === 0) return null;

  return (
    <div className={styles.tracker} aria-label="Habit tracker">
      {sorted.map((habit) => {
        const done = isDoneOn(habit, todayKey);
        const streak = currentStreak(habit, today);
        return (
          <div
            key={habit.id}
            className={done ? styles.cardDone : styles.card}
          >
            <button
              className={styles.delete}
              onClick={() => handleDelete(habit.id)}
              aria-label={`Delete habit "${habit.name}"`}
            >
              ×
            </button>

            <div className={styles.topRow}>
              <button
                className={done ? styles.checkDone : styles.check}
                onClick={() => handleToggle(habit.id)}
                aria-pressed={done}
                aria-label={
                  done
                    ? `Mark "${habit.name}" not done today`
                    : `Mark "${habit.name}" done today`
                }
              >
                {done ? "✓" : ""}
              </button>
              <span className={styles.name}>
                {habit.emoji ? `${habit.emoji} ` : ""}
                {habit.name}
              </span>
            </div>

            <div className={styles.metaRow}>
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
              <span
                className={streak > 0 ? styles.streak : styles.streakZero}
                title="Current streak"
              >
                🔥 {streak}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HabitTracker;
