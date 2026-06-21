"use client";
import React, { useEffect, useRef, useState } from "react";
import type { DateKey, Habit, Todo } from "@/lib/types";
import { subscribeWrites } from "@/lib/persist";
import { loadTodos, saveTodos, addTodo } from "@/lib/storage";
import { addNote, loadNotes, saveNotes } from "@/lib/notes";
import {
  addHabit,
  loadHabits,
  saveHabits,
  deleteHabit,
  renameHabit,
  currentStreak,
} from "@/lib/habits";
import {
  getQuadrant,
  QUADRANT_META,
  TWO_MIN_MAX,
  LONG_TASK_MIN,
} from "@/lib/prioritization";
import { deadlineStatus, DEADLINE_META, formatDeadline } from "@/lib/deadlines";
import DeadlinePicker from "./DeadlinePicker";
import styles from "./TodoPanel.module.css";

interface TodoPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const ESTIMATE_CHIPS: { label: string; minutes: number }[] = [
  { label: "2m", minutes: 2 },
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h+", minutes: 120 },
];

// The three things you can create here. Task is the default; Sticky and Habit
// are folded in behind a segmented switch so the modal stays one clean surface.
type Mode = "task" | "sticky" | "habit";
const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: "task", label: "Task", icon: "📋" },
  { id: "sticky", label: "Sticky", icon: "🗒️" },
  { id: "habit", label: "Habit", icon: "🔥" },
];

const TodoPanel = ({ isVisible, onClose }: TodoPanelProps) => {
  const [mode, setMode] = useState<Mode>("task");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<string>("");
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Classification for the add strip (new tasks default to Q2 "Schedule").
  const [cImportant, setCImportant] = useState<boolean>(true);
  const [cUrgent, setCUrgent] = useState<boolean>(false);
  const [cEstimate, setCEstimate] = useState<number | undefined>(undefined);
  const [cDeadline, setCDeadline] = useState<DateKey | undefined>(undefined);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState<boolean>(false);

  // Sticky-note composer — pins a paper note to the home screen (StickyNotes).
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [justPinned, setJustPinned] = useState<boolean>(false);

  // Habit composer — adds a habit card to the home screen (HabitTracker).
  const [habitDraft, setHabitDraft] = useState<string>("");
  const [justAddedHabit, setJustAddedHabit] = useState<boolean>(false);
  // The created habits, listed under the input for review / edit / delete.
  const [habits, setHabits] = useState<Habit[]>([]);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habitEditDraft, setHabitEditDraft] = useState<string>("");

  const taskInputRef = useRef<HTMLInputElement | null>(null);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const habitInputRef = useRef<HTMLInputElement | null>(null);
  const deadlineWrapRef = useRef<HTMLSpanElement | null>(null);

  // Load persisted todos when the panel opens (picks up edits made elsewhere)
  // and reset to the default Task tab so it always opens on the same surface.
  useEffect(() => {
    if (isVisible) {
      setTodos(loadTodos());
      setHabits(loadHabits());
      setEditingHabitId(null);
      setHydrated(true);
      setShowDeadlinePicker(false);
      setMode("task");
    }
  }, [isVisible]);

  // Keep the habit list in sync while open — a check-off on the home screen
  // (or a cloud pull) writes the habits key; re-read so streaks stay current.
  useEffect(() => {
    if (!isVisible) return;
    const unsub = subscribeWrites((key) => {
      if (typeof key === "string" && key.includes("habits")) {
        setHabits(loadHabits());
      }
    });
    return unsub;
  }, [isVisible]);

  // Persist after the initial load so the empty starting state can't clobber storage.
  useEffect(() => {
    if (hydrated) {
      saveTodos(todos);
    }
  }, [todos, hydrated]);

  // Focus the active tab's input when the panel opens or the tab changes.
  useEffect(() => {
    if (!isVisible) return;
    if (mode === "task") taskInputRef.current?.focus();
    else if (mode === "sticky") noteInputRef.current?.focus();
    else habitInputRef.current?.focus();
  }, [isVisible, mode]);

  // Close the panel on Escape.
  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isVisible, onClose]);

  // Deadlines apply only to Important + Urgent (Q1) tasks — clear if it leaves Q1.
  useEffect(() => {
    if (!(cImportant && cUrgent)) {
      setShowDeadlinePicker(false);
      setCDeadline(undefined);
    }
  }, [cImportant, cUrgent]);

  const handleAdd = () => {
    if (draft.trim() === "") return;
    setTodos((prev) =>
      addTodo(prev, draft, {
        important: cImportant,
        urgent: cUrgent,
        estimatedMinutes: cEstimate,
        deadline: cImportant && cUrgent ? cDeadline : undefined,
      })
    );
    setDraft("");
    setCEstimate(undefined);
    setCDeadline(undefined);
    setShowDeadlinePicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  // Pin a sticky note to the home screen. Reads fresh from storage so a note
  // added elsewhere isn't clobbered; the write notifies StickyNotes to reload.
  const handleAddNote = () => {
    const text = noteDraft.trim();
    if (text === "") return;
    saveNotes(addNote(loadNotes(), { kind: "custom", title: text }));
    setNoteDraft("");
    setJustPinned(true);
    window.setTimeout(() => setJustPinned(false), 1600);
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter pins the note; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  // Add a habit to the home tracker. Same fresh-read-then-write pattern.
  const handleAddHabit = () => {
    const text = habitDraft.trim();
    if (text === "") return;
    const next = addHabit(loadHabits(), text);
    saveHabits(next);
    setHabits(next);
    setHabitDraft("");
    setJustAddedHabit(true);
    window.setTimeout(() => setJustAddedHabit(false), 1600);
  };

  const handleHabitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddHabit();
    }
  };

  const handleDeleteHabit = (id: string) => {
    const next = deleteHabit(loadHabits(), id);
    saveHabits(next);
    setHabits(next);
    if (editingHabitId === id) setEditingHabitId(null);
  };

  const startEditHabit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setHabitEditDraft(habit.name);
  };

  const commitEditHabit = () => {
    if (editingHabitId === null) return;
    const next = renameHabit(loadHabits(), editingHabitId, habitEditDraft);
    saveHabits(next);
    setHabits(next);
    setEditingHabitId(null);
    setHabitEditDraft("");
  };

  const cancelEditHabit = () => {
    setEditingHabitId(null);
    setHabitEditDraft("");
  };

  const handleHabitEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEditHabit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditHabit();
    }
  };

  if (!isVisible) return null;

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const draftQuadrant = getQuadrant({ important: cImportant, urgent: cUrgent });
  const draftMeta = draftQuadrant ? QUADRANT_META[draftQuadrant] : null;
  const draftDeadlineStatus = cDeadline ? deadlineStatus({ deadline: cDeadline }) : null;
  const draftDeadlineColor = draftDeadlineStatus
    ? DEADLINE_META[draftDeadlineStatus].color
    : undefined;
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
        aria-label="Create"
      >
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className={styles.header}>
          <h2 className={styles.title}>Create</h2>
          <span className={styles.subtitle}>{todayLabel}</span>
        </div>

        {/* Mode switch — Task (default) · Sticky · Habit */}
        <div className={styles.segmented} role="tablist" aria-label="What to create">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={mode === m.id ? styles.segActive : styles.seg}
              onClick={() => setMode(m.id)}
            >
              <span className={styles.segIcon} aria-hidden="true">
                {m.icon}
              </span>
              {m.label}
            </button>
          ))}
        </div>

        {/* ── TASK ── */}
        {mode === "task" && (
          <>
            <div className={styles.addRow}>
              <input
                ref={taskInputRef}
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
              {cImportant && cUrgent && (
                <span className={styles.deadlineWrap} ref={deadlineWrapRef}>
                  <button
                    type="button"
                    className={cDeadline ? styles.deadlineOn : styles.deadlineBtn}
                    style={
                      cDeadline
                        ? { color: draftDeadlineColor, borderColor: draftDeadlineColor }
                        : undefined
                    }
                    aria-pressed={cDeadline !== undefined}
                    onClick={() => setShowDeadlinePicker((v) => !v)}
                  >
                    {cDeadline ? `⚑ ${formatDeadline(cDeadline)}` : "📅 Deadline"}
                  </button>
                  {showDeadlinePicker && (
                    <DeadlinePicker
                      value={cDeadline}
                      onChange={setCDeadline}
                      onClose={() => setShowDeadlinePicker(false)}
                      boundaryRef={deadlineWrapRef}
                    />
                  )}
                </span>
              )}
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
          </>
        )}

        {/* ── STICKY NOTE ── */}
        {mode === "sticky" && (
          <div className={styles.composer}>
            <div className={styles.composerHead}>
              <span className={styles.composerLabel}>🗒️ Sticky note</span>
              <span
                className={justPinned ? styles.composerOk : styles.composerHint}
                aria-live="polite"
              >
                {justPinned ? "Pinned to your home ✓" : "Pins to the right of home"}
              </span>
            </div>
            <textarea
              ref={noteInputRef}
              className={styles.noteInput}
              value={noteDraft}
              placeholder="Jot something to keep in sight…"
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={handleNoteKeyDown}
              rows={3}
              aria-label="New sticky note"
            />
            <button
              className={styles.noteAdd}
              onClick={handleAddNote}
              disabled={noteDraft.trim() === ""}
            >
              Add sticky note
            </button>
          </div>
        )}

        {/* ── HABIT ── */}
        {mode === "habit" && (
          <div className={styles.composer}>
            <div className={styles.composerHead}>
              <span className={styles.composerLabel}>🔥 Daily habit</span>
              <span
                className={justAddedHabit ? styles.composerOk : styles.composerHint}
                aria-live="polite"
              >
                {justAddedHabit
                  ? "Added to your tracker ✓"
                  : "Tracks on the left of home"}
              </span>
            </div>
            <div className={styles.addRow}>
              <input
                ref={habitInputRef}
                className={styles.input}
                type="text"
                value={habitDraft}
                placeholder="Add a habit… (Gym, Read, Water)"
                onChange={(e) => setHabitDraft(e.target.value)}
                onKeyDown={handleHabitKeyDown}
                aria-label="New habit"
              />
              <button
                className={styles.addButton}
                onClick={handleAddHabit}
                disabled={habitDraft.trim() === ""}
                aria-label="Add habit"
              >
                +
              </button>
            </div>
            <p className={styles.habitNote}>
              Check it off each day on your home screen to build the streak.
            </p>

            {habits.length > 0 && (
              <ul className={styles.habitList} aria-label="Your habits">
                {[...habits]
                  .sort((a, b) => a.order - b.order)
                  .map((habit) => (
                    <li key={habit.id} className={styles.habitRow}>
                      {editingHabitId === habit.id ? (
                        <input
                          className={styles.habitEditInput}
                          type="text"
                          value={habitEditDraft}
                          autoFocus
                          onChange={(e) => setHabitEditDraft(e.target.value)}
                          onKeyDown={handleHabitEditKeyDown}
                          onBlur={commitEditHabit}
                          aria-label={`Edit habit "${habit.name}"`}
                        />
                      ) : (
                        <>
                          <span className={styles.habitRowName}>
                            {habit.emoji ? `${habit.emoji} ` : ""}
                            {habit.name}
                          </span>
                          <span
                            className={styles.habitRowStreak}
                            title="Current streak"
                          >
                            🔥 {currentStreak(habit)}
                          </span>
                          <button
                            type="button"
                            className={styles.habitRowEdit}
                            onClick={() => startEditHabit(habit)}
                            aria-label={`Edit habit "${habit.name}"`}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className={styles.habitRowDelete}
                            onClick={() => handleDeleteHabit(habit.id)}
                            aria-label={`Delete habit "${habit.name}"`}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoPanel;
