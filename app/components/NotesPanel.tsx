"use client";
import React, { useEffect, useRef, useState } from "react";
import type { Note } from "@/lib/types";
import { dateToKey } from "@/lib/persist";
import {
  loadNotes,
  saveNotes,
  addNote,
  updateNote,
  deleteNote,
  customNotes,
  dailyNote,
  monthlyNote,
  monthKey,
} from "@/lib/notes";
import styles from "./NotesPanel.module.css";

interface NotesPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const NotesPanel = ({ isVisible, onClose }: NotesPanelProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState<string>("");
  const [hydrated, setHydrated] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reload from storage every time the panel opens (mirrors the other panels).
  useEffect(() => {
    if (isVisible) {
      setNotes(loadNotes());
      setHydrated(true);
    }
  }, [isVisible]);

  // Persist on change, but only after load so the empty state can't clobber data.
  useEffect(() => {
    if (hydrated) saveNotes(notes);
  }, [notes, hydrated]);

  if (!isVisible) return null;

  const today = new Date();
  const todayKey = dateToKey(today);
  const thisMonth = monthKey(today);
  const daily = dailyNote(notes, todayKey);
  const monthly = monthlyNote(notes, thisMonth);
  const customs = customNotes(notes);

  // Upsert a reminder; an emptied reminder is removed entirely.
  const setReminder = (
    kind: "daily" | "monthly",
    date: string,
    existing: Note | undefined,
    body: string
  ) => {
    setNotes((prev) => {
      if (body.trim() === "") {
        return existing ? deleteNote(prev, existing.id) : prev;
      }
      if (existing) return updateNote(prev, existing.id, { body });
      return addNote(prev, { kind, date, body });
    });
  };

  const handleAddCustom = () => {
    if (draft.trim() === "") return;
    setNotes((prev) => addNote(prev, { kind: "custom", title: draft }));
    setDraft("");
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.container}
        role="dialog"
        aria-modal="true"
        aria-label="Notes and reminders"
      >
        <button className={styles.closeButton} onClick={onClose} aria-label="Close notes">
          ×
        </button>

        <div className={styles.header}>
          <h2 className={styles.title}>Notes</h2>
          <span className={styles.subtitle}>Reminders &amp; notes</span>
        </div>

        <div className={styles.scroll}>
          <section className={styles.section}>
            <label className={styles.sectionLabel}>Today&apos;s reminder</label>
            <textarea
              className={styles.reminder}
              value={daily?.body ?? ""}
              placeholder="One thing to remember today…"
              onChange={(e) => setReminder("daily", todayKey, daily, e.target.value)}
              aria-label="Today's reminder"
            />
          </section>

          <section className={styles.section}>
            <label className={styles.sectionLabel}>This month</label>
            <textarea
              className={styles.reminder}
              value={monthly?.body ?? ""}
              placeholder="A focus or intention for the month…"
              onChange={(e) =>
                setReminder("monthly", thisMonth, monthly, e.target.value)
              }
              aria-label="This month's reminder"
            />
          </section>

          <section className={styles.section}>
            <label className={styles.sectionLabel}>Notes</label>
            <div className={styles.addRow}>
              <input
                ref={inputRef}
                className={styles.input}
                type="text"
                value={draft}
                placeholder="Add a note…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                aria-label="New note"
              />
              <button
                className={styles.addButton}
                onClick={handleAddCustom}
                disabled={draft.trim() === ""}
                aria-label="Add note"
              >
                +
              </button>
            </div>

            {customs.length === 0 ? (
              <div className={styles.emptyState}>No notes yet.</div>
            ) : (
              <ul className={styles.list}>
                {customs.map((note) => (
                  <li key={note.id} className={styles.item}>
                    <textarea
                      className={styles.noteBody}
                      value={note.body ? `${note.title}\n${note.body}` : note.title}
                      onChange={(e) => {
                        const [title, ...rest] = e.target.value.split("\n");
                        setNotes((prev) =>
                          updateNote(prev, note.id, {
                            title,
                            body: rest.join("\n"),
                          })
                        );
                      }}
                      rows={2}
                      aria-label={`Edit note "${note.title}"`}
                    />
                    <button
                      className={styles.deleteButton}
                      onClick={() => setNotes((prev) => deleteNote(prev, note.id))}
                      aria-label={`Delete note "${note.title}"`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default NotesPanel;
