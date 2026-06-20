"use client";
import Image from "next/image";
import Clock from "./components/Clock";
import ToggleButton from "./components/ToggleButton";
import MonthlyChart from "./components/MonthlyChart";
import TodoPanel from "./components/TodoPanel";
import HabitPanel from "./components/HabitPanel";
import MatrixDashboard from "./components/MatrixDashboard";
import DeadlineReminder from "./components/DeadlineReminder";
import NotesPanel from "./components/NotesPanel";
import AuthButton from "./components/AuthButton";
import NavDock, { type DockPanel } from "./components/NavDock";
import SplashScreen from "./components/SplashScreen";
import styles from "./components/Clock.module.css";
import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { startSync, stopSync } from "@/lib/cloud/sync";

// The beforeinstallprompt event is not part of the standard DOM lib types yet,
// so we declare the minimal shape we rely on here.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function Home() {
  const [timerStatus, setTimerStatus] = useState("");
  const [activePanel, setActivePanel] = useState<DockPanel | null>(null);
  const [todayProductivity, setTodayProductivity] = useState("0h 0m");
  const [appInstalled, setAppInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

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
      setDeferredPrompt(e as BeforeInstallPromptEvent);
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

  const closePanel = () => setActivePanel(null);
  const selectPanel = (panel: DockPanel) =>
    setActivePanel((cur) => (cur === panel ? null : panel));

  // Cloud sync follows auth: pull + watch on login, stop on logout. No-ops
  // entirely when Supabase isn't configured (local-first default).
  const handleUserChange = useCallback((user: User | null) => {
    if (user) void startSync(user.id);
    else stopSync();
  }, []);

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
    <div className="h-screen bg-gray-50 p-8 relative">
      <SplashScreen />

      <MonthlyChart
        isVisible={activePanel === "calendar"}
        onClose={closePanel}
        todayProductivity={todayProductivity}
        appInstalled={appInstalled}
        deferredPrompt={deferredPrompt}
        onInstall={installApp}
      />
      <TodoPanel isVisible={activePanel === "tasks"} onClose={closePanel} />
      <HabitPanel isVisible={activePanel === "habits"} onClose={closePanel} />
      <MatrixDashboard isVisible={activePanel === "matrix"} onClose={closePanel} />
      <NotesPanel isVisible={activePanel === "notes"} onClose={closePanel} />

      <AuthButton onUserChange={handleUserChange} />

      <DeadlineReminder
        activePanel={activePanel}
        onOpenTasks={() => selectPanel("tasks")}
      />

      <div className="flex flex-col items-center justify-center h-full">
        <Clock onTimerUpdate={() => {}} />
        <div className="mt-8">
          <ToggleButton id="main-toggle" />
        </div>
        <p className="mt-3 text-sm text-gray-400">Tap to start a 25-min focus</p>
      </div>

      <NavDock active={activePanel} onSelect={selectPanel} />
    </div>
  );
}
