"use client";

import { useState } from "react";
import type { Todo } from "@/lib/types";
import {
  type Quadrant,
  QUADRANT_META,
  REFERENCE_IMPORTANT_SHARE,
  nudges,
  quadrantBreakdown,
} from "@/lib/prioritization";
import styles from "./Insights.module.css";

interface InsightsProps {
  todos: Todo[];
}

const QUADRANT_ORDER: readonly Quadrant[] = ["q1", "q2", "q3", "q4"];

/** Below this width, a stacked-bar segment is too thin to legibly hold its % label. */
const LABEL_MIN_PCT = 12;

export default function Insights({ todos }: InsightsProps) {
  const b = quadrantBreakdown(todos);
  // Locally-dismissed nudge ids — no persistence (re-derived each session).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (b.classifiedCount === 0) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.emptyState}>Classify a few tasks to see your time mix.</p>
      </div>
    );
  }

  const modeNote =
    b.mode === "time"
      ? "By estimated time"
      : "By task count — add time estimates for a time-based view.";

  const visibleNudges = nudges(b).filter((n) => !dismissed.has(n.id));

  const dismiss = (id: string): void => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.wrapper}>
      {/* ── 100% stacked bar ── */}
      <div className={styles.bar}>
        {QUADRANT_ORDER.map((q) => {
          const pct = b[q];
          if (pct <= 0) return null;
          return (
            <div
              key={q}
              className={styles.segment}
              style={{ flexGrow: pct, background: QUADRANT_META[q].color }}
              title={`${QUADRANT_META[q].name} — ${pct}%`}
            >
              {pct >= LABEL_MIN_PCT ? `${pct}%` : ""}
            </div>
          );
        })}
      </div>

      <ul className={styles.legend}>
        {QUADRANT_ORDER.map((q) => (
          <li key={q} className={styles.legendItem}>
            <span
              className={styles.swatch}
              style={{ background: QUADRANT_META[q].color }}
              aria-hidden="true"
            />
            <span className={styles.legendName}>{QUADRANT_META[q].name}</span>
            <span className={styles.legendPct}>{b[q]}%</span>
          </li>
        ))}
      </ul>

      <p className={styles.modeNote}>{modeNote}</p>

      {/* ── Important-share gauge ── */}
      <div className={styles.gauge}>
        <div className={styles.gaugeLabelRow}>
          <span className={styles.gaugeLabel}>Important work</span>
          <span className={styles.gaugeValue}>{b.importantSharePct}%</span>
        </div>
        {/* Not overflow:hidden so the reference marker can't be clipped. */}
        <div className={styles.gaugeTrack}>
          <div className={styles.gaugeFill} style={{ width: `${b.importantSharePct}%` }} />
          <div
            className={styles.gaugeMarker}
            style={{ left: `${REFERENCE_IMPORTANT_SHARE}%` }}
            aria-hidden="true"
          >
            <span className={styles.gaugeMarkerLabel}>{REFERENCE_IMPORTANT_SHARE}%</span>
          </div>
        </div>
        <p className={styles.caption}>
          Marker = ~{REFERENCE_IMPORTANT_SHARE}% on important work — a healthy reference, not a
          target.
        </p>
      </div>

      {/* ── Stats row ── */}
      <div className={styles.stats}>
        <span className={styles.stat}>
          Important <strong>{b.importantSharePct}%</strong>
        </span>
        <span className={styles.statDivider} aria-hidden="true">
          ·
        </span>
        <span className={styles.stat}>
          Urgent <strong>{b.urgentSharePct}%</strong>
        </span>
      </div>

      {/* ── Dismissible nudges ── */}
      {visibleNudges.length > 0 && (
        <div className={styles.nudges}>
          {visibleNudges.map((n) => (
            <div key={n.id} className={styles.nudge}>
              <span className={styles.nudgeText}>{n.message}</span>
              <button
                type="button"
                className={styles.nudgeDismiss}
                onClick={() => dismiss(n.id)}
                aria-label="Dismiss suggestion"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
