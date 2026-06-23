"use client";
import React, { useEffect, useState } from "react";
import type { Note } from "@/lib/types";
import { loadNotes, saveNotes, customNotes, deleteNote } from "@/lib/notes";
import { subscribeWrites } from "@/lib/persist";
import styles from "./StickyNotes.module.css";

// Accent palette — white paper, a single muted colour on the top edge. The
// colour is picked deterministically from the note id so a note keeps the same
// look across reloads. Kept subtle to sit inside the black/white/grey theme.
const ACCENTS = [
  "#e3b341", // amber
  "#6fae5f", // green
  "#6ea8d8", // blue
  "#d98aa6", // rose
  "#a99bd6", // lilac
] as const;

// Small deterministic hash → stable colour without storing it.
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Sticky notes pinned to the home screen (top-right, under the account chip).
 * Created from the Tasks modal's note composer; surfaced here as little paper
 * cards that drop in with a flourish. Reads the same custom notes the old Notes
 * panel used, and reloads through the persistence write-seam so a note added in
 * the modal appears here instantly.
 */
const StickyNotes = () => {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    const reload = () => setNotes(customNotes(loadNotes()));
    reload();
    // Re-read whenever notes are written (add from the Tasks modal, delete here,
    // or a cloud sync pull). Ignore unrelated writes (todos, habits, …).
    const unsub = subscribeWrites((key) => {
      if (typeof key === "string" && key.includes("notes")) reload();
    });
    return unsub;
  }, []);

  const handleDelete = (id: string) => {
    saveNotes(deleteNote(loadNotes(), id));
  };

  if (notes.length === 0) return null;

  return (
    <div className={styles.stack} aria-label="Sticky notes">
      {notes.map((note) => {
        const accent = ACCENTS[hash(note.id) % ACCENTS.length];
        return (
          <div
            key={note.id}
            className={styles.note}
            style={{ "--accent": accent } as React.CSSProperties}
          >
            <span className={styles.accent} aria-hidden="true" />
            <button
              className={styles.delete}
              onClick={() => handleDelete(note.id)}
              aria-label="Remove sticky note"
            >
              ×
            </button>
            <p className={styles.text}>{note.title}</p>
            {note.body && <p className={styles.body}>{note.body}</p>}
          </div>
        );
      })}
    </div>
  );
};

export default StickyNotes;
