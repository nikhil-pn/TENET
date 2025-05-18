"use client";
import Image from "next/image";
import Clock from "./components/Clock";
import ToggleButton from "./components/ToggleButton";
import InfoButton from "./components/InfoButton";
import MonthlyChart from "./components/MonthlyChart";
import styles from "./components/Clock.module.css";
import { useState, useEffect } from "react";

export default function Home() {
  const [timerStatus, setTimerStatus] = useState("");
  const [showChart, setShowChart] = useState(false);
  const [todayProductivity, setTodayProductivity] = useState("0h 0m");

  // Get current time only
  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      setTimerStatus(`${hours}:${minutes}`);
    };

    // Initial update
    updateCurrentTime();

    // Update every minute
    const interval = setInterval(updateCurrentTime, 60000);

    return () => clearInterval(interval);
  }, []);

  // Fetch productivity time from localStorage on component mount
  useEffect(() => {
    // Only run in the browser
    if (typeof window !== "undefined") {
      const savedTime = localStorage.getItem("productiveTime");
      const minutes = savedTime ? parseInt(savedTime, 10) : 0;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      setTodayProductivity(`${hours}h ${mins}m`);
    }
  }, []);

  const toggleChart = () => {
    setShowChart(!showChart);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 relative">
      <InfoButton onClick={toggleChart} todayProductivity={todayProductivity} />
      <MonthlyChart
        isVisible={showChart}
        onClose={() => setShowChart(false)}
        todayProductivity={todayProductivity}
      />

      <div className="flex flex-col items-center justify-center min-h-screen">
        {/* <div className={styles.timerStatusContainer}>
          <div className={styles.timerStatus}>{timerStatus}</div>
        </div> */}
        <Clock onTimerUpdate={() => {}} />
        <div className="mt-8">
          <ToggleButton id="main-toggle" />
        </div>
      </div>
    </div>
  );
}
