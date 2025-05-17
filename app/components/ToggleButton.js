"use client";
import { useState } from "react";
import styles from "./ToggleButton.module.css";

export default function ToggleButton({ onToggle, id }) {
  const [isChecked, setIsChecked] = useState(false);

  const handleToggle = () => {
    const newState = !isChecked;
    setIsChecked(newState);
    if (onToggle) {
      onToggle(newState);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.toggle}>
        <input
          id={id}
          type="checkbox"
          checked={isChecked}
          onChange={handleToggle}
        />
        <span className={styles.button}></span>
        <span className={styles.label}>☼</span>
      </div>
    </div>
  );
}
