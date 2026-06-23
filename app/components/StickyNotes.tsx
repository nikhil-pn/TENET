"use client";
import { useEffect, useState } from "react";
import type { Note } from "@/lib/types";
import { loadNotes, saveNotes, customNotes, deleteNote } from "@/lib/notes";
import { subscribeWrites } from "@/lib/persist";
import styles from "./StickyNotes.module.css";

/**
 * Sticky notes pinned to the home screen (top-right, under the account chip).
 * Created from the Tasks modal's note composer; surfaced here as neumorphic
 * paper tiles — a grey soft-UI card held by a pushpin and tilted slightly, in
 * the reference neumorphism style (see docs/brand-and-design-language.md).
 * Reads the same custom notes the old Notes panel used, and reloads through the
 * persistence write-seam so a note added in the modal appears here instantly.
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
      {notes.map((note) => (
        <div key={note.id} className={styles.note}>
          <span className={styles.pin} aria-hidden="true" />
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
      ))}
    </div>
  );
};

export default StickyNotes;
