"use client";
import React, { useEffect, useState } from "react";
import { dateToKey } from "@/lib/persist";
import type { DayLog } from "@/lib/types";
import { TRACKING_WINDOW_DAYS } from "@/lib/prioritization";
import {
  loadDayLogs,
  saveDayLogs,
  getDayLog,
  upsertDayLog,
  recentDayLogs,
} from "@/lib/daylog";
import styles from "./Reflect.module.css";

/** 0 (red) → mid (amber) → high (green). */
function scoreColor(score: number): string {
  if (score >= 67) return "#4caf50";
  if (score >= 34) return "#ff9800";
  return "#f44336";
}

const Reflect = () => {
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [score, setScore] = useState<number>(70);
  const [note, setNote] = useState<string>("");
  const todayKey = dateToKey();

  useEffect(() => {
    const loaded = loadDayLogs();
    setLogs(loaded);
    const todayLog = getDayLog(loaded, todayKey);
    if (todayLog) {
      setScore(todayLog.satisfactionScore);
      setNote(todayLog.satisfactionNote ?? "");
    }
    setHydrated(true);
  }, [todayKey]);

  useEffect(() => {
    if (hydrated) saveDayLogs(logs);
  }, [logs, hydrated]);

  const handleSave = () => {
    setLogs((prev) => upsertDayLog(prev, todayKey, score, note));
  };

  const days = recentDayLogs(logs, TRACKING_WINDOW_DAYS);
  const logged = days.filter((d) => d.score !== null);
  const avg = logged.length
    ? Math.round(logged.reduce((s, d) => s + (d.score ?? 0), 0) / logged.length)
    : null;
  const todaySaved = getDayLog(logs, todayKey) !== undefined;

  return (
    <div className={styles.reflect}>
      <div className={styles.heading}>How did today go?</div>
      <div className={styles.sliderRow}>
        <input
          type="range"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className={styles.slider}
          aria-label="Today's satisfaction from 0 to 100"
        />
        <span className={styles.scoreValue} style={{ color: scoreColor(score) }}>
          {score}
        </span>
      </div>
      <input
        type="text"
        className={styles.note}
        value={note}
        placeholder="Why? (optional)"
        onChange={(e) => setNote(e.target.value)}
        aria-label="Satisfaction note"
      />
      <button className={styles.saveBtn} onClick={handleSave}>
        {todaySaved ? "Update today" : "Save today"}
      </button>

      <div className={styles.cycleHeader}>
        <span>Last {TRACKING_WINDOW_DAYS} days</span>
        {avg !== null && <span>avg {avg}</span>}
      </div>
      <div className={styles.strip}>
        {days.map((d) => (
          <div
            key={d.key}
            className={styles.dayCol}
            title={d.score !== null ? `${d.key} · ${d.score}` : d.key}
          >
            <div className={styles.barTrack}>
              {d.score !== null && (
                <div
                  className={styles.barFill}
                  style={{
                    height: `${Math.max(6, d.score)}%`,
                    background: scoreColor(d.score),
                  }}
                />
              )}
            </div>
            <div className={d.isToday ? styles.dayTickToday : styles.dayTick} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reflect;
