"use client";
import { useState, useEffect } from "react";
import styles from "./MonthlyChart.module.css";

const MonthlyChart = ({
  isVisible,
  onClose,
  todayProductivity,
  appInstalled,
  deferredPrompt,
  onInstall,
}) => {
  const [monthData, setMonthData] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [currentTimerInfo, setCurrentTimerInfo] = useState("00:00 / 25:00");
  const [totalProductivityMinutes, setTotalProductivityMinutes] = useState(0);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  useEffect(() => {
    if (typeof window !== "undefined" && isVisible) {
      generateMonthData();

      // Get current timer info if exists
      const currentTime = localStorage.getItem("currentTimerInfo");
      if (currentTime) {
        setCurrentTimerInfo(currentTime);
      }

      // Get total productive time
      const productiveTime = localStorage.getItem("productiveTime");
      if (productiveTime) {
        setTotalProductivityMinutes(parseInt(productiveTime, 10));
      }
    }
  }, [currentMonth, currentYear, isVisible]);

  // New useEffect for real-time timer updates
  useEffect(() => {
    if (!isVisible) return;

    // Update timer info from localStorage every second
    const timerInterval = setInterval(() => {
      if (typeof window !== "undefined") {
        const currentTime = localStorage.getItem("currentTimerInfo");
        if (currentTime) {
          setCurrentTimerInfo(currentTime);
        }
      }
    }, 1000);

    // Cleanup interval when component unmounts or becomes invisible
    return () => clearInterval(timerInterval);
  }, [isVisible]);

  const generateMonthData = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Get previous month's last days to fill in the beginning of the calendar
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

    let days = [];
    let total = 0;

    // Previous month's days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      days.push({
        date: day,
        isCurrentMonth: false,
        minutes: 0,
      });
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      // Get productivity data from localStorage if available
      let minutes = 0;
      const dateKey = `${currentYear}-${(currentMonth + 1)
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

      if (typeof window !== "undefined") {
        const savedData = localStorage.getItem(`productiveTime_${dateKey}`);
        if (savedData) {
          minutes = parseInt(savedData, 10);
        }
      }

      total += minutes;
      days.push({
        date: day,
        isCurrentMonth: true,
        minutes: minutes,
      });
    }

    // Next month's days to fill the calendar grid
    const totalDaysShown = Math.ceil(days.length / 7) * 7;
    const nextMonthDays = totalDaysShown - days.length;

    for (let day = 1; day <= nextMonthDays; day++) {
      days.push({
        date: day,
        isCurrentMonth: false,
        minutes: 0,
      });
    }

    setMonthData(days);
    setTotalMinutes(total);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  if (!isVisible) return null;

  return (
    <div
      className={styles.chartOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.chartContainer}>
        <div className={styles.productivitySummary}>
          Current Session: {currentTimerInfo}
        </div>

        <div className={styles.chartHeader}>
          <div className={styles.monthYearDisplay}>
            {monthNames[currentMonth]} {currentYear}
          </div>
          <div className={styles.controlsContainer}>
            <div className={styles.todayButton} onClick={handleToday}>
              Today
            </div>

            <button className={styles.navButton} onClick={handlePrevMonth}>
              ↑
            </button>
            <button className={styles.navButton} onClick={handleNextMonth}>
              ↓
            </button>

            {!appInstalled && deferredPrompt && (
              <button onClick={onInstall} className={styles.installButton}>
                Install App
              </button>
            )}
          </div>
        </div>

        <div className={styles.calendarGrid}>
          {/* Day name headers */}
          {dayNames.map((day, index) => (
            <div key={`header-${index}`} className={styles.dayHeader}>
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {monthData.map((day, index) => (
            <div
              key={`day-${index}`}
              className={`${styles.dayCell} ${
                !day.isCurrentMonth ? styles.otherMonth : ""
              }`}
            >
              <div className={styles.dayNumber}>{day.date}</div>
              {day.minutes > 0 && (
                <div className={styles.minutesValue}>{day.minutes}</div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.totalTime}>Σ {totalProductivityMinutes} min</div>
      </div>
    </div>
  );
};

export default MonthlyChart;
