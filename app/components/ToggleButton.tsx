"use client";
import { useState, useEffect } from "react";
import styles from "./ToggleButton.module.css";

interface ToggleButtonProps {
  id: string;
}

export default function ToggleButton({ id }: ToggleButtonProps) {
  const [isChecked, setIsChecked] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
