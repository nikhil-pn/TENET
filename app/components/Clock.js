"use client";
import { useEffect, useState, useRef } from "react";
import styles from "./Clock.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Clock() {
  const [isTimerMode, setIsTimerMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isPomodoroCompleted, setIsPomodoroCompleted] = useState(false);
  const pomodoroMinutes = 1;
  const pomodoroSeconds = pomodoroMinutes * 60;

  // Ref to keep track of previous timer state for resuming
  const prevTimerState = useRef({
    isOn: false,
    seconds: 0,
  });

  // Ref to track if toast has been shown
  const toastShownRef = useRef(false);

  useEffect(() => {
    setupClock("skeuomorphic");

    // Initial positioning
    setClockHands();

    // Set up event listener for the toggle button
    const mainToggle = document.getElementById("main-toggle");
    if (mainToggle) {
      mainToggle.addEventListener("change", (e) => {
        const isOn = e.target.checked;

        if (isOn && isPomodoroCompleted) {
          // Resuming after Pomodoro completion - keep the timer at 25 min
          setIsPomodoroCompleted(false);
          // Reset timer if resuming after completion
          setTimerSeconds(0);
          // Reset toast shown flag when starting a new session
          toastShownRef.current = false;
        }

        setIsTimerMode(isOn);
        prevTimerState.current.isOn = isOn;
      });
    }

    return () => {
      const mainToggle = document.getElementById("main-toggle");
      if (mainToggle) {
        mainToggle.removeEventListener("change", (e) => {
          setIsTimerMode(e.target.checked);
        });
      }
    };
  }, [isPomodoroCompleted]);

  useEffect(() => {
    let interval;

    if (isTimerMode && !isPomodoroCompleted) {
      // Timer mode - increment seconds
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          const newValue = prev + 1;

          // Check if we reached the Pomodoro time (25 minutes)
          if (newValue === pomodoroSeconds && !toastShownRef.current) {
            console.log("saving reached 25m");
            setIsPomodoroCompleted(true);

            // Show toast notification only if not shown already
            toastShownRef.current = true;
            toast.success("Session completed! Time for a 5 minute break.", {
              position: "top-right",
              autoClose: 5000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              toastId: "pomodoro-complete", // Add a unique ID to prevent duplicates
            });

            // Uncheck the toggle button to indicate pause
            const mainToggle = document.getElementById("main-toggle");
            if (mainToggle) {
              mainToggle.checked = false;
            }

            // Store current state for potential resume
            prevTimerState.current.seconds = newValue;
            setIsTimerMode(false);
          }

          return newValue;
        });
        setClockHands();
      }, 1000);
    } else {
      // When timer is paused, just update the display without changing time
      interval = setInterval(() => {
        setClockHands();
      }, 1000);
    }

    setClockHands(); // Update immediately after mode change

    return () => clearInterval(interval);
  }, [isTimerMode, timerSeconds, isPomodoroCompleted]);

  function setClockHands() {
    let hours, minutes, seconds;

    // Always use timer seconds, regardless of mode
    const secondsToUse = isPomodoroCompleted ? pomodoroSeconds : timerSeconds;

    hours = Math.floor(secondsToUse / 3600) % 12;
    minutes = Math.floor((secondsToUse % 3600) / 60);
    seconds = secondsToUse % 60;

    const hourDegrees = hours * 30 + minutes * 0.5;
    const minuteDegrees = minutes * 6 + seconds * 0.1;
    const secondDegrees = seconds * 6;

    const hourHand = document.getElementById("skeuomorphic-hour-hand");
    const minuteHand = document.getElementById("skeuomorphic-minute-hand");
    const secondHand = document.getElementById("skeuomorphic-second-hand");

    if (hourHand) hourHand.style.transform = `rotate(${hourDegrees}deg)`;
    if (minuteHand) minuteHand.style.transform = `rotate(${minuteDegrees}deg)`;
    if (secondHand) secondHand.style.transform = `rotate(${secondDegrees}deg)`;
  }

  function setupClock(style) {
    const hourMarksElement = document.getElementById(`${style}-hour-marks`);
    const clockFaceElement = document.querySelector(`.${styles.clockFace}`);

    if (!hourMarksElement || !clockFaceElement) return;

    // Clear existing marks/numbers if any
    hourMarksElement.innerHTML = "";
    clockFaceElement
      .querySelectorAll(`.${styles.hourNumber}`)
      .forEach((el) => el.remove());

    // Add hour marks and numbers
    for (let i = 0; i < 12; i++) {
      // Create hour marks (thicker marks for 3, 6, 9, 12)
      const isMainMark = i % 3 === 0;
      const hourMark = document.createElement("div");
      hourMark.className = isMainMark ? styles.mainHourMark : styles.hourMark;
      hourMark.style.transform = `rotate(${i * 30}deg)`;
      hourMarksElement.appendChild(hourMark);

      // Create hour numbers
      const hourNumber = document.createElement("div");
      hourNumber.className = styles.hourNumber;
      hourNumber.textContent = i === 0 ? 12 : i;

      const angle = i * 30;
      const radius = 110;
      const x = 140 + radius * Math.sin((angle * Math.PI) / 180);
      const y = 140 - radius * Math.cos((angle * Math.PI) / 180);

      hourNumber.style.left = `${x - 20}px`;
      hourNumber.style.top = `${y - 20}px`;
      clockFaceElement.appendChild(hourNumber);

      // Add minute marks between hours
      for (let j = 1; j <= 4; j++) {
        const minuteMark = document.createElement("div");
        minuteMark.className = styles.minuteMark;
        minuteMark.style.transform = `rotate(${i * 30 + j * 6}deg)`;
        hourMarksElement.appendChild(minuteMark);
      }
    }
  }

  return (
    <div className={styles.skeuomorphic}>
      <ToastContainer />
      <div className={styles.clockContainer}>
        <div className={styles.clockBezel}></div>
        <div className={styles.clockFace}></div>
        <div className={styles.hourMarks} id="skeuomorphic-hour-marks"></div>
        <div
          className={`${styles.hourHand} ${styles.hand}`}
          id="skeuomorphic-hour-hand"
        ></div>
        <div
          className={`${styles.minuteHand} ${styles.hand}`}
          id="skeuomorphic-minute-hand"
        ></div>
        <div
          className={`${styles.secondHand} ${styles.hand}`}
          id="skeuomorphic-second-hand"
        ></div>
        <div className={styles.clockCenter}></div>
      </div>
    </div>
  );
}
