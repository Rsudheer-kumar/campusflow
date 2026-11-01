"use client";

import { useState, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value = "",
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
  className,
  ...props
}) {
  const [internalValue, setInternalValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const timerRef = useRef(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setInternalValue(value);
  }

  const handleChange = (e) => {
    const nextVal = e.target.value;
    setInternalValue(nextVal);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      onChange(nextVal);
    }, debounceMs);
  };

  const handleClear = () => {
    setInternalValue("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange("");
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        className="absolute left-3 h-4 w-4 text-muted pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="text"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl bg-surface border border-border pl-9 pr-9 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted/70",
          "transition-all duration-150 outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
        )}
        {...props}
      />
      {internalValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search input"
          className="absolute right-3 p-0.5 text-muted hover:text-foreground rounded transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
