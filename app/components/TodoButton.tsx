"use client";
import React from "react";
import styles from "./TodoButton.module.css";

interface TodoButtonProps {
  onClick: () => void;
}

const TodoButton = ({ onClick }: TodoButtonProps) => {
  return (
    <button
      className={styles.todoButton}
      onClick={onClick}
      aria-label="Open daily checklist"
      title="Daily checklist"
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
        <polyline points="3.5,6 4.8,7.3 7.2,4.5" />
        <polyline points="3.5,12 4.8,13.3 7.2,10.5" />
        <polyline points="3.5,18 4.8,19.3 7.2,16.5" />
        <line x1="10" y1="6" x2="20.5" y2="6" />
        <line x1="10" y1="12" x2="20.5" y2="12" />
        <line x1="10" y1="18" x2="20.5" y2="18" />
      </svg>
    </button>
  );
};

export default TodoButton;
