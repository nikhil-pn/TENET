"use client";
import React from "react";
import styles from "./HabitButton.module.css";

interface HabitButtonProps {
  onClick: () => void;
}

const HabitButton = ({ onClick }: HabitButtonProps) => {
  return (
    <button
      className={styles.habitButton}
      onClick={onClick}
      aria-label="Open habits & streaks"
      title="Habits & streaks"
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
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    </button>
  );
};

export default HabitButton;
