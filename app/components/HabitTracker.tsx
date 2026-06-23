"use client";
import { useEffect, useState } from "react";
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
 * on the right). Neumorphic cards in the reference soft-UI style with real
 * habit-tracking elements: a check that presses in, a streak line, and a 7-day
 * strip of wells that fill as days are done. See docs/brand-and-design-language.md.
 * Habits are created from the Tasks modal's Habit tab; here they surface as
 * tracker cards you can check off for the day. Reloads through the persistence
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
          <div key={habit.id} className={done ? styles.cardDone : styles.card}>
            <button
              className={styles.delete}
              onClick={() => handleDelete(habit.id)}
              aria-label={`Delete habit "${habit.name}"`}
            >
              ×
            </button>

            <div className={styles.head}>
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
              <div className={styles.info}>
                <span className={styles.name}>{habit.name}</span>
                <span className={streak > 0 ? styles.sub : styles.subZero}>
                  {streak > 0 ? `${streak} day streak` : "Start today"}
                </span>
              </div>
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
        );
      })}
    </div>
  );
};

export default HabitTracker;
