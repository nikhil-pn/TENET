"use client";
import { useEffect, useState, useRef } from "react";
import styles from "./Clock.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Clock({ onTimerUpdate }) {
  const [isTimerMode, setIsTimerMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isPomodoroCompleted, setIsPomodoroCompleted] = useState(false);
  const [isBreakMode, setIsBreakMode] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [waitingToStartBreak, setWaitingToStartBreak] = useState(false);
  const [waitingToStartSession, setWaitingToStartSession] = useState(false);
  const [totalProductiveMinutes, setTotalProductiveMinutes] = useState(0);

  // Timer settings
  const pomodoroMinutes = 25;
  const pomodoroSeconds = pomodoroMinutes * 60;
  const shortBreakMinutes = 1;
  const shortBreakSeconds = shortBreakMinutes * 60;
  const longBreakMinutes = 30;
  const longBreakSeconds = longBreakMinutes * 60;

  // Ref to track if toast has been shown
  const toastShownRef = useRef(false);

  // Load total productive time from localStorage on component mount
  useEffect(() => {
    const savedTime = localStorage.getItem("productiveTime");
    if (savedTime) {
      setTotalProductiveMinutes(parseInt(savedTime, 10));
    }
  }, []);

  // Update the timer status when relevant state changes
  useEffect(() => {
    if (onTimerUpdate) {
      let status;
      if (waitingToStartBreak) {
        status = "Click to start break";
      } else if (waitingToStartSession) {
        status = "Click to start next session";
      } else if (isBreakMode) {
        const breakSeconds =
          pomodoroCount >= 4 ? longBreakSeconds : shortBreakSeconds;
        status =
          pomodoroCount >= 4
            ? `Long Break: ${formatTime(timerSeconds)} / ${formatTime(
                longBreakSeconds
              )}`
            : `Break: ${formatTime(timerSeconds)} / ${formatTime(
                shortBreakSeconds
              )}`;
      } else {
        status = `Today's Productivity: ${formatTimeHours(
          totalProductiveMinutes * 60
        )} (Current: ${formatTime(timerSeconds)} / ${formatTime(
          pomodoroSeconds
        )})`;
      }
      onTimerUpdate(status);
    }
  }, [
    timerSeconds,
    isBreakMode,
    waitingToStartBreak,
    waitingToStartSession,
    pomodoroCount,
    onTimerUpdate,
    totalProductiveMinutes,
  ]);

  useEffect(() => {
    setupClock("skeuomorphic");

    // Initial positioning
    setClockHands();

    // Set up event listener for the toggle button
    const mainToggle = document.getElementById("main-toggle");

    if (mainToggle) {
      mainToggle.addEventListener("change", (e) => {
        const isOn = e.target.checked;

        if (isOn) {
          if (waitingToStartBreak) {
            // User clicked to start a break
            setWaitingToStartBreak(false);
            setIsBreakMode(true);
            setTimerSeconds(0);
            setIsTimerMode(true);
            toastShownRef.current = false;

            // Change toggle button back to normal
            const toggleButton = document.querySelector(
              `#main-toggle ~ .${styles.button}`
            );
            if (toggleButton) {
              toggleButton.classList.remove("button-red");
            }
          } else if (waitingToStartSession) {
            // User clicked to start a new session
            setWaitingToStartSession(false);
            setIsBreakMode(false);
            setTimerSeconds(0);
            setIsTimerMode(true);
            toastShownRef.current = false;

            // Change toggle button back to normal
            const toggleButton = document.querySelector(
              `#main-toggle ~ .${styles.button}`
            );
            if (toggleButton) {
              toggleButton.classList.remove("button-red");
            }
          } else {
            // Regular toggle on - resume timer
            setIsTimerMode(true);
            toastShownRef.current = false;
          }
        } else {
          // Toggle off - pause the timer
          setIsTimerMode(false);
        }
      });
    }

    return () => {
      const mainToggle = document.getElementById("main-toggle");
      if (mainToggle) {
        mainToggle.removeEventListener("change", () => {});
      }
    };
  }, [waitingToStartBreak, waitingToStartSession]);

  useEffect(() => {
    let interval;

    if (isTimerMode) {
      // Timer mode - increment seconds
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          const newValue = prev + 1;

          // Check if we're in break mode
          if (isBreakMode) {
            const breakSeconds =
              pomodoroCount >= 4 ? longBreakSeconds : shortBreakSeconds;

            // Check if break is completed
            if (newValue >= breakSeconds && !toastShownRef.current) {
              const breakType = pomodoroCount >= 4 ? "long" : "short";

              // Reset pomodoro count after long break
              if (pomodoroCount >= 4) {
                setPomodoroCount(0);
              }

              // Show break completed toast
              toastShownRef.current = true;
              toast.info(
                `${
                  breakType.charAt(0).toUpperCase() + breakType.slice(1)
                } break completed! Click to start a new session.`,
                {
                  position: "top-right",
                  autoClose: 5000,
                  hideProgressBar: false,
                  closeOnClick: true,
                  pauseOnHover: true,
                  draggable: true,
                  toastId: "break-complete",
                }
              );

              // Stop timer and wait for user to start new session
              setIsTimerMode(false);
              setIsBreakMode(false);
              setWaitingToStartSession(true);

              // Uncheck the toggle button and make it red
              const mainToggle = document.getElementById("main-toggle");
              const toggleButton = document.querySelector(
                `#main-toggle ~ .${styles.button}`
              );
              if (mainToggle) {
                mainToggle.checked = false;
              }
              if (toggleButton) {
                toggleButton.classList.add("button-red");
              }
            }
          } else {
            // Regular pomodoro session
            if (newValue >= pomodoroSeconds && !toastShownRef.current) {
              // Show session completed toast
              toastShownRef.current = true;
              toast.success("Session completed! Click to start a break.", {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                toastId: "pomodoro-complete",
              });

              // Save completed Pomodoro time to localStorage
              const newTotalMinutes = totalProductiveMinutes + pomodoroMinutes;
              setTotalProductiveMinutes(newTotalMinutes);
              
              // Save total productivity time
              localStorage.setItem(
                "productiveTime",
                newTotalMinutes.toString()
              );
              
              // Save daily productivity data with date information
              const today = new Date();
              const dateKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
              const dailyMinutes = parseInt(localStorage.getItem(`productiveTime_${dateKey}`) || '0', 10);
              localStorage.setItem(
                `productiveTime_${dateKey}`,
                (dailyMinutes + pomodoroMinutes).toString()
              );

              // Increment pomodoro count
              setPomodoroCount((prevCount) => prevCount + 1);

              // Stop timer and wait for user to start break
              setIsTimerMode(false);
              setWaitingToStartBreak(true);

              // Uncheck the toggle button and make it red
              const mainToggle = document.getElementById("main-toggle");
              const toggleButton = document.querySelector(
                `#main-toggle ~ .${styles.button}`
              );
              if (mainToggle) {
                mainToggle.checked = false;
              }
              if (toggleButton) {
                toggleButton.classList.add("button-red");
              }
            }
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
  }, [
    isTimerMode,
    timerSeconds,
    isBreakMode,
    pomodoroCount,
    totalProductiveMinutes,
    pomodoroMinutes,
  ]);

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Format seconds to HH:MM for total productive time
  const formatTimeHours = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  function setClockHands() {
    let hours, minutes, seconds;

    // Use the current timer value directly, rather than calculating remaining time
    hours = Math.floor(timerSeconds / 3600) % 12;
    minutes = Math.floor((timerSeconds % 3600) / 60);
    seconds = timerSeconds % 60;

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
      <div className={styles.pomodoroIndicator}>
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className={`${styles.tomatoEmoji} ${
              index < pomodoroCount ? styles.active : ""
            }`}
          >
            🍅
          </span>
        ))}
      </div>
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
