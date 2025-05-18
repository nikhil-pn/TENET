"use client";
import React from "react";
import styles from "./InfoButton.module.css";

const InfoButton = ({ onClick }) => {
  return (
    <button
      className={styles.infoButton}
      onClick={onClick}
      aria-label="Show monthly statistics"
    >
      i
    </button>
  );
};

export default InfoButton;
