"use client";
import React from "react";
import styles from "./InfoButton.module.css";

interface InfoButtonProps {
  onClick: () => void;
  todayProductivity: string;
}

const InfoButton = ({ onClick, todayProductivity }: InfoButtonProps) => {
  return (
    <button
      className={styles.infoButton}
      onClick={onClick}
      aria-label="Open calendar & planner"
      title={`Calendar · Today: ${todayProductivity}`}
    >
      <svg
        width="18"
        height="18"
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
    </button>
  );
};

export default InfoButton;
