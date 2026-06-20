"use client";
import { useEffect, type RefObject } from "react";
import type { DateKey } from "@/lib/types";
import { dateToKey } from "@/lib/persist";
import { parseWhen } from "@/lib/dates";
import styles from "./DeadlinePicker.module.css";

interface DeadlinePickerProps {
  value: DateKey | undefined;
  onChange: (deadline: DateKey | undefined) => void;
  onClose: () => void;
  /** Clicks inside this element (the trigger + this card) don't dismiss the popover. */
  boundaryRef: RefObject<HTMLSpanElement | null>;
}

function shiftKey(days: number): DateKey {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateToKey(d);
}

const PRESETS: { label: string; getKey: () => DateKey }[] = [
  { label: "Today", getKey: () => shiftKey(0) },
  { label: "Tomorrow", getKey: () => shiftKey(1) },
  { label: "In 3 days", getKey: () => shiftKey(3) },
  // Reuse the calendar's natural-language parser for the upcoming Monday.
  { label: "Next Mon", getKey: () => parseWhen("monday").date ?? shiftKey(7) },
];

export default function DeadlinePicker({
  value,
  onChange,
  onClose,
  boundaryRef,
}: DeadlinePickerProps) {
  // Dismiss on a click outside the trigger+card boundary.
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = boundaryRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [onClose, boundaryRef]);

  const pick = (key: DateKey | undefined) => {
    onChange(key);
    onClose();
  };

  return (
    <div className={styles.card} role="dialog" aria-label="Set deadline">
      <div className={styles.presets}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={styles.preset}
            onClick={() => pick(p.getKey())}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        className={styles.dateInput}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        aria-label="Pick a deadline date"
      />
      {value && (
        <button type="button" className={styles.clear} onClick={() => pick(undefined)}>
          Clear deadline
        </button>
      )}
    </div>
  );
}
