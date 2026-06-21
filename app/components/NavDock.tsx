"use client";
import React from "react";
import styles from "./NavDock.module.css";

export type DockPanel = "calendar" | "tasks" | "matrix";

interface NavDockProps {
  active: DockPanel | null;
  onSelect: (panel: DockPanel) => void;
}

const ICONS: Record<DockPanel, React.ReactNode> = {
  calendar: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2.5" x2="8" y2="6" />
      <line x1="16" y1="2.5" x2="16" y2="6" />
    </svg>
  ),
  tasks: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3.5,6 4.8,7.3 7.2,4.5" />
      <polyline points="3.5,12 4.8,13.3 7.2,10.5" />
      <polyline points="3.5,18 4.8,19.3 7.2,16.5" />
      <line x1="10" y1="6" x2="20.5" y2="6" />
      <line x1="10" y1="12" x2="20.5" y2="12" />
      <line x1="10" y1="18" x2="20.5" y2="18" />
    </svg>
  ),
  matrix: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
};

const LABELS: Record<DockPanel, string> = {
  calendar: "Calendar",
  tasks: "Tasks",
  matrix: "Matrix",
};

const ORDER: DockPanel[] = ["calendar", "tasks", "matrix"];

const NavDock = ({ active, onSelect }: NavDockProps) => {
  return (
    <nav className={styles.dock} aria-label="Main navigation">
      {ORDER.map((key) => (
        <button
          key={key}
          className={active === key ? styles.itemActive : styles.item}
          onClick={() => onSelect(key)}
          aria-current={active === key ? "page" : undefined}
          aria-label={LABELS[key]}
        >
          <span className={styles.icon}>{ICONS[key]}</span>
          <span className={styles.label}>{LABELS[key]}</span>
        </button>
      ))}
    </nav>
  );
};

export default NavDock;
