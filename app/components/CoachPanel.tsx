"use client";
import { useEffect, useState } from "react";
import type { Todo } from "@/lib/types";
import { loadTodos } from "@/lib/storage";
import {
  COACH_WINDOW_DAYS,
  MIN_ACTIVE_DAYS,
  type DataSufficiency,
  dataSufficiency,
} from "@/lib/ai/snapshot";
import {
  type AiConfig,
  DEFAULT_AI_CONFIG,
  DEFAULT_AI_MODEL,
  getAiConfig,
  saveAiConfig,
} from "@/lib/ai/config";
import { type CoachResult, getCachedReview, getCoachReview } from "@/lib/ai/coach";
import Insights from "./Insights";
import Reflect from "./Reflect";
import styles from "./CoachPanel.module.css";

interface CoachPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * The Coach — a weekly review surface opened from the dock. It always shows the
 * deterministic floor (the time-mix Insights + the satisfaction Reflection); when
 * the user opts AI in (BYOK) and enough data exists, an AI-narrated summary card
 * sits on top. With AI off, the same card shows a deterministic templated
 * summary, so the panel is useful either way. Read-only over a snapshot of todos
 * (Reflect owns its own day-log persistence), so there is no save effect.
 */
const CoachPanel = ({ isVisible, onClose }: CoachPanelProps) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [sufficiency, setSufficiency] = useState<DataSufficiency | null>(null);
  const [review, setReview] = useState<CoachResult | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cfg, setCfg] = useState<AiConfig>(DEFAULT_AI_CONFIG);

  // Reload from storage on open (picks up edits made elsewhere).
  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    setTodos(loadTodos());
    setCfg(getAiConfig() ?? DEFAULT_AI_CONFIG);
    const suff = dataSufficiency();
    setSufficiency(suff);

    // Instant paint from cache, then refresh (returns cached if still fresh —
    // only calls the model on a new ISO week, a forced refresh, or a fallback→AI
    // upgrade). Skipped entirely until there's enough data.
    setReview(getCachedReview());
    if (suff.ready) {
      setReviewLoading(true);
      getCoachReview()
        .then((r) => !cancelled && setReview(r))
        .finally(() => !cancelled && setReviewLoading(false));
    }

    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  // Close on Escape.
  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const ready = sufficiency?.ready ?? false;
  const aiOn = cfg.enabled && cfg.coachEnabled && Boolean(cfg.openRouterKey);

  const regenerate = () => {
    setReviewLoading(true);
    getCoachReview({ force: true })
      .then(setReview)
      .finally(() => setReviewLoading(false));
  };

  const saveSettings = () => {
    const next: AiConfig = { ...cfg, model: cfg.model.trim() || DEFAULT_AI_MODEL };
    saveAiConfig(next);
    setCfg(next);
    setShowSettings(false);
    // Re-evaluate the review now that config may have changed.
    if (ready) {
      setReviewLoading(true);
      getCoachReview()
        .then(setReview)
        .finally(() => setReviewLoading(false));
    }
  };

  const turnOffAndForget = () => {
    const next: AiConfig = { ...DEFAULT_AI_CONFIG };
    saveAiConfig(next);
    setCfg(next);
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
        aria-label="Coach"
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Coach</h2>
          <p className={styles.subtitle}>Your last {COACH_WINDOW_DAYS} days</p>
          <button
            type="button"
            className={styles.gear}
            onClick={() => setShowSettings((s) => !s)}
            aria-label="AI settings"
            aria-expanded={showSettings}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </header>

        <div className={styles.scroll}>
          {showSettings && (
            <div className={styles.settings}>
              <p className={styles.settingsTitle}>AI Coach (optional)</p>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={cfg.enabled}
                  onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
                />
                <span>Enable in-app AI</span>
              </label>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={cfg.coachEnabled}
                  onChange={(e) => setCfg({ ...cfg, coachEnabled: e.target.checked })}
                  disabled={!cfg.enabled}
                />
                <span>Use AI for the weekly review</span>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>OpenRouter API key</span>
                <input
                  type="password"
                  className={styles.input}
                  placeholder="sk-or-..."
                  value={cfg.openRouterKey ?? ""}
                  onChange={(e) => setCfg({ ...cfg, openRouterKey: e.target.value })}
                  autoComplete="off"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Model</span>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={DEFAULT_AI_MODEL}
                  value={cfg.model}
                  onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
                />
              </label>
              <p className={styles.disclosure}>
                Off by default. When on, the Coach sends a small set of anonymized
                numbers (your time-mix, completion rate, streaks) and up to 5 short
                task titles to OpenRouter with zero-data-retention routing — never
                your notes. Your key is stored only on this device.
              </p>
              <div className={styles.settingsActions}>
                <button type="button" className={styles.primaryBtn} onClick={saveSettings}>
                  Save
                </button>
                <button type="button" className={styles.ghostBtn} onClick={turnOffAndForget}>
                  Turn off &amp; forget key
                </button>
              </div>
            </div>
          )}

          {!ready && (
            <div className={styles.learning}>
              <span className={styles.learningDot} aria-hidden="true" />
              <p className={styles.learningText}>
                Still learning your patterns — your weekly review unlocks after about{" "}
                {MIN_ACTIVE_DAYS} active days
                {sufficiency ? ` (${sufficiency.activeDays} so far)` : ""}. Keep planning,
                focusing, and checking in below.
              </p>
            </div>
          )}

          {ready && (review || reviewLoading) && (
            <section className={styles.reviewCard}>
              {reviewLoading && !review ? (
                <p className={styles.reviewLoading}>Writing your review…</p>
              ) : review ? (
                <>
                  <div className={styles.reviewTop}>
                    <h3 className={styles.reviewHeadline}>{review.review.headline}</h3>
                    <span className={review.source === "ai" ? styles.badgeAi : styles.badgeSummary}>
                      {review.source === "ai" ? "AI" : "Summary"}
                    </span>
                  </div>

                  {review.review.wins.length > 0 && (
                    <ul className={styles.wins}>
                      {review.review.wins.map((w, i) => (
                        <li key={i} className={styles.win}>
                          <span className={styles.winMark} aria-hidden="true">
                            ✓
                          </span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  )}

                  {review.review.focusAreas.map((f, i) => (
                    <div key={i} className={styles.focusArea}>
                      <p className={styles.focusObservation}>{f.observation}</p>
                      <p className={styles.focusWhy}>{f.why}</p>
                      <p className={styles.focusAction}>→ {f.oneAction}</p>
                    </div>
                  ))}

                  <div className={styles.keystone}>
                    <span className={styles.keystoneLabel}>One change</span>
                    <span className={styles.keystoneText}>{review.review.keystoneChange}</span>
                  </div>

                  <div className={styles.reviewFooter}>
                    <span className={styles.privacyNote}>
                      {aiOn
                        ? "Computed on your device; only anonymized numbers are sent to write the wording."
                        : "Generated on your device — no data leaves. Enable AI for richer coaching."}
                    </span>
                    <button
                      type="button"
                      className={styles.regenBtn}
                      onClick={regenerate}
                      disabled={reviewLoading}
                    >
                      {reviewLoading ? "…" : "Refresh"}
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          )}

          <div className={styles.grid}>
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Time mix</h3>
              <Insights todos={todos} />
            </section>
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Reflection</h3>
              <Reflect />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachPanel;
