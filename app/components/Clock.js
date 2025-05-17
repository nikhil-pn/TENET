"use client";
import { useEffect } from "react";
import styles from "./Clock.module.css";

export default function Clock() {
  useEffect(() => {
    setupClock("skeuomorphic");

    const interval = setInterval(setClockHands, 1000);
    setClockHands(); // Initial positioning

    return () => clearInterval(interval);
  }, []);

  function setClockHands() {
    const now = new Date();
    const hours24 = now.getHours();
    const hours = hours24 % 12 || 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const hourDegrees = (hours % 12) * 30 + minutes * 0.5;
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
