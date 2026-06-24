"use client";
import { useMemo } from "react";
import { QUADRANT_META, type Quadrant } from "@/lib/prioritization";
import { dateToKey } from "@/lib/persist";
import { loadSessions, minutesByDate } from "@/lib/pomodoroLog";
import { loadDayLogs, recentDayLogs } from "@/lib/daylog";
import { COACH_WINDOW_DAYS, type CoachDigest } from "@/lib/ai/snapshot";
import styles from "./CoachCharts.module.css";

/**
 * The Coach's data visualisation — pure-SVG charts in the "Soft Focus" language
 * (no chart library). Summary stats come from the same digest the AI narrates;
 * the per-day series are read locally so the charts stay full-fidelity. Shown
 * both on open and beside the AI review.
 */

const Q_ORDER: readonly Quadrant[] = ["q1", "q2", "q3", "q4"];
const ACCENT = "#4caf50";
const TRACK = "#eceef1";

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(dateToKey(d));
  }
  return out;
}

// ── Donut (quadrant time-mix) ──────────────────────────────────────────────────
function Donut({ mix }: { mix: CoachDigest["mix"] }) {
  const r = 42;
  const C = 2 * Math.PI * r;
  const GAP = 2.2;
  let offset = 0;
  const segments = Q_ORDER.map((q) => ({ q, v: mix[q] })).filter((s) => s.v > 0);
  return (
    <svg viewBox="0 0 100 100" className={styles.donut} role="img" aria-label="Time mix by quadrant">
      <circle cx="50" cy="50" r={r} fill="none" stroke={TRACK} strokeWidth="11" />
      {segments.map((s) => {
        const full = (s.v / 100) * C;
        const len = Math.max(full - GAP, 0.5);
        const el = (
          <circle
            key={s.q}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={QUADRANT_META[s.q].color}
            strokeWidth="11"
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        );
        offset += full;
        return el;
      })}
      <text x="50" y="48" textAnchor="middle" className={styles.donutNum}>
        {mix.importantSharePct}%
      </text>
      <text x="50" y="61" textAnchor="middle" className={styles.donutSub}>
        important
      </text>
    </svg>
  );
}

// ── Vertical bars (focus minutes / day) ────────────────────────────────────────
function Bars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const n = values.length;
  return (
    <svg viewBox={`0 0 ${n * 10} 44`} className={styles.bars} preserveAspectRatio="none" aria-hidden="true">
      {values.map((v, i) => {
        const h = (v / max) * 40;
        return (
          <rect
            key={i}
            x={i * 10 + 1.5}
            y={44 - Math.max(h, 2)}
            width={7}
            height={Math.max(h, 2)}
            rx={2}
            fill={ACCENT}
            opacity={v > 0 ? 0.9 : 0.18}
          />
        );
      })}
    </svg>
  );
}

// ── Area line (satisfaction trend) ─────────────────────────────────────────────
function Line({ values }: { values: (number | null)[] }) {
  const n = values.length;
  const W = 100;
  const H = 44;
  const pts = values
    .map((v, i) => (v == null ? null : ([(i / (n - 1)) * W, H - (v / 100) * (H - 4) - 2] as const)))
    .filter((p): p is readonly [number, number] => p !== null);
  if (pts.length === 0) {
    return <div className={styles.emptyMini}>No reflections logged yet</div>;
  }
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L ${pts[pts.length - 1][0].toFixed(1)} ${H} L ${pts[0][0].toFixed(1)} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.line} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill="rgba(76,175,80,0.12)" />
      <path
        d={path}
        fill="none"
        stroke={ACCENT}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={1.5} fill={ACCENT} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

// ── Circular progress ring (habit consistency, completion) ─────────────────────
function Ring({ pct, color = ACCENT, size = 52 }: { pct: number; color?: string; size?: number }) {
  const r = 20;
  const C = 2 * Math.PI * r;
  const len = (Math.max(0, Math.min(100, pct)) / 100) * C;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={styles.ringSvg} aria-hidden="true">
      <circle cx="24" cy="24" r={r} fill="none" stroke={TRACK} strokeWidth="5" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={`${len} ${C - len}`}
        transform="rotate(-90 24 24)"
        strokeLinecap="round"
      />
      <text x="24" y="27.5" textAnchor="middle" className={styles.ringNum}>
        {pct}%
      </text>
    </svg>
  );
}

// ── Estimate-vs-actual drift bar (planning fallacy) ────────────────────────────
function Drift({ factor }: { factor: number }) {
  const pct = Math.min(factor / 2, 1) * 100; // 2.0× fills the track; 1.0× sits at 50%
  const over = factor >= 1.25;
  const color = over ? QUADRANT_META.q3.color : ACCENT;
  return (
    <div className={styles.driftWrap}>
      <div className={styles.driftTrack}>
        <div className={styles.driftFill} style={{ width: `${pct}%`, background: color }} />
        <div className={styles.driftMark} style={{ left: "50%" }} aria-hidden="true" />
      </div>
      <div className={styles.driftScale}>
        <span>on estimate</span>
        <span style={{ color }}>{factor}× actual</span>
      </div>
    </div>
  );
}

export default function CoachCharts({ digest }: { digest: CoachDigest }) {
  const focusByDay = useMemo(() => {
    const byDate = minutesByDate(loadSessions());
    return lastNDays(COACH_WINDOW_DAYS).map((k) => byDate[k] ?? 0);
  }, []);
  const satByDay = useMemo(
    () => recentDayLogs(loadDayLogs(), COACH_WINDOW_DAYS).map((c) => c.score),
    []
  );

  const hasMix = digest.mix.classifiedCount > 0;
  const topHabits = [...digest.habits].slice(0, 3);

  return (
    <div className={styles.grid}>
      {/* Time mix */}
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Where your time goes</h3>
        {hasMix ? (
          <div className={styles.donutRow}>
            <Donut mix={digest.mix} />
            <ul className={styles.legend}>
              {Q_ORDER.map((q) => (
                <li key={q} className={styles.legendItem}>
                  <span className={styles.dot} style={{ background: QUADRANT_META[q].color }} aria-hidden="true" />
                  <span className={styles.legendName}>{QUADRANT_META[q].short}</span>
                  <span className={styles.legendPct}>{digest.mix[q]}%</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={styles.empty}>Classify a few tasks to see your mix.</p>
        )}
        <p className={styles.foot}>
          Reference for important work is ~{digest.reference.importantSharePct}% — a guide, not a target.
        </p>
      </section>

      {/* Focus */}
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Focus</h3>
        <Bars values={focusByDay} />
        <div className={styles.statRow}>
          <span className={styles.stat}>
            <strong>{digest.focus.dailyAvg}</strong> min/day
          </span>
          <span className={styles.statDivider}>·</span>
          <span className={styles.stat}>
            <strong>{digest.focus.streak}</strong>-day streak
          </span>
          <span className={styles.statDivider}>·</span>
          <span className={styles.stat}>
            <strong>{digest.focus.sessions}</strong> sessions
          </span>
        </div>
      </section>

      {/* Satisfaction trend */}
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Satisfaction</h3>
        <Line values={satByDay} />
        <div className={styles.statRow}>
          <span className={styles.stat}>
            avg <strong>{digest.satisfaction.avg ?? "—"}</strong>
          </span>
          {digest.satisfaction.trend != null && (
            <>
              <span className={styles.statDivider}>·</span>
              <span className={styles.stat}>
                trend{" "}
                <strong style={{ color: digest.satisfaction.trend >= 0 ? ACCENT : QUADRANT_META.q1.color }}>
                  {digest.satisfaction.trend >= 0 ? "+" : ""}
                  {digest.satisfaction.trend}
                </strong>
              </span>
            </>
          )}
        </div>
      </section>

      {/* Habits */}
      {topHabits.length > 0 && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Habits</h3>
          <div className={styles.rings}>
            {topHabits.map((h) => (
              <div key={h.name} className={styles.ringItem}>
                <Ring pct={h.consistencyPct} />
                <span className={styles.ringName}>{h.name}</span>
                <span className={styles.ringSub}>
                  {h.currentStreak > 0 ? `${h.currentStreak}-day streak` : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Estimate accuracy */}
      {digest.estimateDrift && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Estimate accuracy</h3>
          <Drift factor={digest.estimateDrift.factor} />
          <p className={styles.foot}>
            Tasks ran about <strong>{digest.estimateDrift.factor}×</strong> your estimates
            {digest.estimateDrift.worstQuadrant
              ? ` (most on ${QUADRANT_META[digest.estimateDrift.worstQuadrant].short})`
              : ""}
            . Budgeting a little more tends to make the day feel calmer.
          </p>
        </section>
      )}

      {/* Completion */}
      <section className={`${styles.card} ${styles.completionCard}`}>
        <h3 className={styles.cardTitle}>Follow-through</h3>
        <div className={styles.completionRow}>
          <Ring pct={digest.completion.ratePct} size={64} />
          <p className={styles.completionText}>
            <strong>
              {digest.completion.completed}/{digest.completion.created}
            </strong>{" "}
            tasks finished this window
          </p>
        </div>
      </section>
    </div>
  );
}
