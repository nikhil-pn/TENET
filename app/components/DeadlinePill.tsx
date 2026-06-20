"use client";
import { useRef, useState } from "react";
import type { DateKey } from "@/lib/types";
import { deadlineStatus, DEADLINE_META, formatDeadline } from "@/lib/deadlines";
import DeadlinePicker from "./DeadlinePicker";
import styles from "./DeadlinePill.module.css";

interface DeadlinePillProps {
  deadline: DateKey | undefined;
  onChange: (deadline: DateKey | undefined) => void;
  /** When there's no deadline: true ⇒ render nothing; false ⇒ a faint "+ deadline". */
  hideWhenEmpty?: boolean;
}

/**
 * A view/edit chip for a task's deadline. Shows the date colored by status and
 * opens a {@link DeadlinePicker} on click. The wrapper stops mouse/drag events so
 * it stays usable inside the draggable Eisenhower cards.
 */
export default function DeadlinePill({
  deadline,
  onChange,
  hideWhenEmpty,
}: DeadlinePillProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  if (!deadline && hideWhenEmpty) return null;

  const status = deadlineStatus({ deadline });
  const color = status ? DEADLINE_META[status].color : undefined;

  return (
    <span
      className={styles.wrap}
      ref={wrapRef}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={deadline ? styles.pillSet : styles.pillEmpty}
        style={deadline ? { color, borderColor: color } : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-label={
          deadline ? `Deadline ${formatDeadline(deadline)} — edit` : "Set deadline"
        }
        title={status ? DEADLINE_META[status].label : "Set deadline"}
      >
        {deadline ? `⚑ ${formatDeadline(deadline)}` : "+ deadline"}
      </button>
      {open && (
        <DeadlinePicker
          value={deadline}
          onChange={onChange}
          onClose={() => setOpen(false)}
          boundaryRef={wrapRef}
        />
      )}
    </span>
  );
}
