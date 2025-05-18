"use client";
import React from "react";
import styles from "./InfoButton.module.css";

const InfoButton = ({ onClick, todayProductivity }) => {
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
