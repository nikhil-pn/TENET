"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import styles from "./SplashScreen.module.css";

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Hide splash screen after 2 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className={styles.splashScreen}>
      <div className={styles.logoContainer}>
        <Image
          src="/logo.png"
          alt="TENET Pomodoro Logo"
          width={150}
          height={150}
          priority
          className={styles.logo}
        />
        {/* <h1 className={styles.title}>TENET</h1> */}
        <p className={styles.subtitle}>Minimalist Pomodoro Timer</p>
      </div>
    </div>
  );
}
