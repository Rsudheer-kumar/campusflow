"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, id = "themeToggle" }) {
  const btnRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    let saved = null;
    try {
      saved = localStorage.getItem("theme");
    } catch {}
    const startDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (startDark) {
      root.setAttribute("data-theme", "dark");
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.removeAttribute("data-theme");
      root.classList.remove("dark");
      root.classList.add("light");
    }
    setIsDarkMode(startDark);
  }, []);

  const applyTheme = (goingDark) => {
    const root = document.documentElement;
    if (goingDark) {
      root.setAttribute("data-theme", "dark");
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.removeAttribute("data-theme");
      root.classList.remove("dark");
      root.classList.add("light");
    }
    try {
      localStorage.setItem("theme", goingDark ? "dark" : "light");
    } catch {}
    setIsDarkMode(goingDark);
  };

  const handleToggle = () => {
    const root = document.documentElement;
    const btn = btnRef.current;
    const goingDark = !isDarkMode;

    const apply = () => {
      applyTheme(goingDark);
    };

    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !btn) {
      apply();
      return;
    }

    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;

    root.style.setProperty("--vt-x", `${x.toFixed(1)}px`);
    root.style.setProperty("--vt-y", `${y.toFixed(1)}px`);

    document.startViewTransition(apply);
  };

  return (
    <button
      ref={btnRef}
      type="button"
      className={cn("theme-toggle", className)}
      id={id}
      onClick={handleToggle}
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      <svg className="icon-moon" viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M17 11.5A7.5 7.5 0 0 1 8.5 3a7.5 7.5 0 1 0 8.5 8.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      <svg className="icon-sun" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M10 1.5v2.2M10 16.3v2.2M1.5 10h2.2M16.3 10h2.2M4 4l1.6 1.6M14.4 14.4 16 16M16 4l-1.6 1.6M5.6 14.4 4 16"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
        />
      </svg>
    </button>
  );
}

export default ThemeToggle;
