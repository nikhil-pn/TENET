"use client";
import Image from "next/image";
import Clock from "./components/Clock";
import ToggleButton from "./components/ToggleButton";
import styles from "./components/Clock.module.css";
import { useState } from "react";

export default function Home() {
  const [timerStatus, setTimerStatus] = useState(
    "Today's Productivity : 25:00"
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 relative">
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className={styles.timerStatusContainer}>
          <div className={styles.timerStatus}>{timerStatus}</div>
        </div>
        <Clock onTimerUpdate={(status) => setTimerStatus(status)} />
        <div className="mt-8">
          <ToggleButton id="main-toggle" />
        </div>
      </div>
    </div>
  );
}
