"use client";

if (typeof window !== "undefined" && !window.__CAMPUSFLOW_LOG_INIT__) {
  window.__CAMPUSFLOW_LOG_INIT__ = true;
  const originalWarn = console.warn;
  console.warn = function (...args) {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("THREE.Clock: This module has been deprecated") ||
       args[0].includes("Clock: This module has been deprecated"))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

export function ClientInit() {
  return null;
}

