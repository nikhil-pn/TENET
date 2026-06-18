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
      aria-label="Show monthly statistics"
      title={`Today's Productivity: ${todayProductivity}`}
    >
      i
    </button>
  );
};

export default InfoButton;
