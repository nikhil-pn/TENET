"use client";
import { useState } from "react";
import styles from "./ToggleButton.module.css";

export default function ToggleButton() {
  const [isChecked, setIsChecked] = useState(false);

  const handleToggle = () => {
    setIsChecked(!isChecked);
  };

  return (
    <div className={styles["toggle-wrapper"]}>
      <input
        className={styles["toggle-checkbox"]}
        type="checkbox"
        checked={isChecked}
        onChange={handleToggle}
      />
      <div className={styles["toggle-container"]}>
        <div className={styles["toggle-button"]}>
          <div className={styles["toggle-button-circles-container"]}>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
            <div className={styles["toggle-button-circle"]}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
