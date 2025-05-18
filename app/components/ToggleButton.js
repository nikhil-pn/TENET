"use client";
import { useState, useEffect } from "react";
import styles from "./ToggleButton.module.css";

export default function ToggleButton({ id }) {
  const [isChecked, setIsChecked] = useState(false);

  const handleChange = (e) => {
    setIsChecked(e.target.checked);
  };

  return (
    <div className={styles.container}>
      <div className={styles.toggle}>
        <input
          id={id}
          type="checkbox"
          checked={isChecked}
          onChange={handleChange}
        />
        <span className={styles.button}></span>
        <span className={styles.label}>☼</span>
      </div>
    </div>
  );
}
