"use client";
import Image from "next/image";
import Clock from "./components/Clock";
import ToggleButton from "./components/ToggleButton";
import InfoButton from "./components/InfoButton";
import MonthlyChart from "./components/MonthlyChart";
import SplashScreen from "./components/SplashScreen";
import styles from "./components/Clock.module.css";
import { useState, useEffect } from "react";

export default function Home() {
  const [timerStatus, setTimerStatus] = useState("");
  const [showChart, setShowChart] = useState(false);
  const [todayProductivity, setTodayProductivity] = useState("0h 0m");
  const [appInstalled, setAppInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Check if the app is already installed or being used in standalone mode
  useEffect(() => {
    // Check if the app is in standalone mode (installed)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setAppInstalled(true);
    }

    // Listen for beforeinstallprompt event to detect if app can be installed
    window.addEventListener("beforeinstallprompt", (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event so it can be triggered later
      setDeferredPrompt(e);
    });

    // Listen for app installation
    window.addEventListener("appinstalled", () => {
      setAppInstalled(true);
      setDeferredPrompt(null);
    });
  }, []);

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

  const installApp = async () => {
    if (!deferredPrompt) return;

    // Show the installation prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // We no longer need the prompt. Clear it.
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 relative">
      <SplashScreen />

      <InfoButton onClick={toggleChart} todayProductivity={todayProductivity} />
      <MonthlyChart
        isVisible={showChart}
        onClose={() => setShowChart(false)}
        todayProductivity={todayProductivity}
        appInstalled={appInstalled}
        deferredPrompt={deferredPrompt}
        onInstall={installApp}
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
