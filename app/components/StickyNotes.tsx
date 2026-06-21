"use client";
import React, { useEffect, useState } from "react";
import type { Note } from "@/lib/types";
import { loadNotes, saveNotes, customNotes, deleteNote } from "@/lib/notes";
import { subscribeWrites } from "@/lib/persist";
import styles from "./StickyNotes.module.css";

// Paper palette — a colour is picked deterministically from the note id so a
// note keeps the same look across reloads. Each entry pairs a paper fill with a
// matching translucent "tape" tint.
const PAPERS = [
  { bg: "#fff3b0", tape: "rgba(214, 184, 49, 0.45)" }, // sunshine
  { bg: "#ffd7e1", tape: "rgba(214, 120, 145, 0.4)" }, // blush
  { bg: "#cdeefe", tape: "rgba(96, 165, 205, 0.4)" }, // sky
  { bg: "#d6f5cf", tape: "rgba(120, 195, 110, 0.4)" }, // mint
  { bg: "#ece1ff", tape: "rgba(150, 120, 215, 0.4)" }, // lilac
] as const;

// Small deterministic hash → stable colour + tilt without storing them.
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const TILTS = [-2.5, 1.8, -1.4, 2.4, -2, 1.2];

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
        const h = hash(note.id);
        const paper = PAPERS[h % PAPERS.length];
        const tilt = TILTS[h % TILTS.length];
        return (
          <div
            key={note.id}
            className={styles.note}
            style={
              {
                background: paper.bg,
                "--tilt": `${tilt}deg`,
              } as React.CSSProperties
            }
          >
            <span
              className={styles.tape}
              style={{ background: paper.tape }}
              aria-hidden="true"
            />
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
