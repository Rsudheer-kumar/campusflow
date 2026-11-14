"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ResourceCardsGrid({
  items = [],
  meta = "01 / Unified Platform",
  title = "Unified platform for all resources",
  subtitle = "Replace fragmented systems with one intuitive, modern ecosystem designed to optimize space and equipment utilization.",
  className,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);
  const totalItems = items.length;

  const nextCard = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % totalItems);
  }, [totalItems]);

  const prevCard = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
  }, [totalItems]);

  // Auto-advance orbit carousel every 4.5s when not hovered or interacting
  useEffect(() => {
    if (isPaused || totalItems <= 1) return;
    const interval = setInterval(nextCard, 4500);
    return () => clearInterval(interval);
  }, [isPaused, totalItems, nextCard]);

  // Touch swipe support for mobile/tablet
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
    setIsPaused(true);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        nextCard();
      } else {
        prevCard();
      }
    }
    setTouchStartX(null);
    setIsPaused(false);
  };

  return (
    <section
      className={cn(
        "relative w-full py-16 md:py-24 bg-background overflow-hidden select-none",
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Campus Resources Capabilities Carousel"
    >
      {/* Background Soft Atmospheric Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_50%_at_50%_45%,var(--surface-2)_0%,transparent_75%)] opacity-50" />

      {/* Header Info */}
      <div className="container mx-auto px-4 md:px-6 relative z-30 text-center max-w-3xl mx-auto mb-10 md:mb-14 pointer-events-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border mb-4 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold tracking-wider uppercase text-foreground/80">
            {meta}
          </span>
        </div>

        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4 drop-shadow-sm leading-[1.15]">
          {title}
        </h2>

        <p className="text-base md:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* 3D Orbit Carousel Stage (Rotates cleanly within the section space) */}
      <div className="relative w-full max-w-6xl mx-auto h-[460px] sm:h-[490px] md:h-[520px] flex items-center justify-center">
        {/* Navigation Arrow Left */}
        <button
          type="button"
          onClick={prevCard}
          className="absolute left-2 sm:left-4 md:left-8 z-40 p-3 rounded-full bg-surface/90 hover:bg-surface border border-border text-foreground hover:text-primary shadow-xl backdrop-blur-md transition-all hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Previous capability card"
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        {/* Navigation Arrow Right */}
        <button
          type="button"
          onClick={nextCard}
          className="absolute right-2 sm:right-4 md:right-8 z-40 p-3 rounded-full bg-surface/90 hover:bg-surface border border-border text-foreground hover:text-primary shadow-xl backdrop-blur-md transition-all hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Next capability card"
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        {/* Cards Carousel Container */}
        <div className="relative w-full h-full flex items-center justify-center perspective-[1200px]">
          {items.map((item, idx) => {
            // Compute wrapped difference from activeIndex
            const rawDiff = idx - activeIndex;
            let diff = rawDiff;
            if (rawDiff > totalItems / 2) diff = rawDiff - totalItems;
            if (rawDiff < -totalItems / 2) diff = rawDiff + totalItems;

            const isFront = diff === 0;
            const angle = (diff * (2 * Math.PI)) / totalItems;

            // Compute orbit geometry based on current window size
            const isFlank = Math.abs(diff) === 1;
            const isFar = Math.abs(diff) === 2;
            const isBack = Math.abs(diff) >= 3;

            // Orbital depth calculations
            const z = Math.cos(angle); // 1 = front, -1 = back
            const depth = (z + 1) / 2; // 1 = front, 0 = back

            // Responsive horizontal radius
            // On mobile use tighter spread, on desktop use wider spread
            const Rx = typeof window !== "undefined" && window.innerWidth < 640 ? 160 : typeof window !== "undefined" && window.innerWidth < 1024 ? 260 : 360;
            const x = Math.sin(angle) * Rx;
            const y = (1 - depth) * -22;
            const scale = 0.72 + 0.28 * depth;
            const opacity = isFront ? 1 : isFlank ? 0.78 : isFar ? 0.45 : 0.15;
            const blur = isFront ? 0 : isFlank ? 0.5 : isFar ? 2 : 4;
            const zIndex = Math.round(depth * 50);
            const rotateY = diff * -12;

            return (
              <div
                key={item.title || idx}
                onClick={() => {
                  if (!isFront) {
                    setActiveIndex(idx);
                  }
                }}
                className={cn(
                  "absolute flex flex-col justify-between rounded-3xl p-6 sm:p-7 md:p-8",
                  "w-[290px] sm:w-[340px] md:w-[380px] min-h-[290px] sm:min-h-[310px]",
                  "border border-border bg-surface text-foreground shadow-2xl",
                  "cursor-pointer transition-all duration-500 ease-out select-none",
                  isFront
                    ? "ring-1 ring-primary/40 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
                    : "hover:border-primary/50"
                )}
                style={{
                  transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)}) rotateY(${rotateY.toFixed(1)}deg)`,
                  left: "50%",
                  top: "50%",
                  opacity: opacity.toFixed(2),
                  filter: blur > 0 ? `blur(${blur.toFixed(1)}px)` : "none",
                  zIndex,
                  borderTop: `4px solid ${item.accentColor || "var(--primary)"}`,
                  pointerEvents: isBack ? "none" : "auto",
                }}
              >
                {/* Top Info: Index & Icon */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold tracking-widest text-muted">
                      0{idx + 1}
                    </span>
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                      style={{
                        backgroundColor: `${item.accentColor || "var(--primary)"}18`,
                        color: item.accentColor || "var(--primary)",
                      }}
                    >
                      {item.icon}
                    </div>
                  </div>

                  {/* Card Title */}
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground mb-1.5 transition-colors">
                    {item.title}
                  </h3>

                  {/* Category Tag */}
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: item.accentColor || "var(--primary)" }}
                  >
                    {item.tag || "Core Capability"}
                  </p>

                  {/* Description */}
                  <p className="text-xs sm:text-sm leading-relaxed text-muted line-clamp-3 sm:line-clamp-none">
                    {item.desc}
                  </p>
                </div>

                {/* Bottom CTA Bar */}
                <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider uppercase text-primary flex items-center gap-1.5">
                    {item.linkText || "View Capability"}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.accentColor || "var(--primary)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination Indicators / Direct Selection Dots */}
      <div className="relative z-30 flex items-center justify-center gap-2 mt-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface/90 border border-border shadow-md backdrop-blur-sm">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                activeIndex === i
                  ? "w-8 bg-primary"
                  : "w-2 bg-muted/40 hover:bg-muted"
              )}
              aria-label={`Jump to resource card ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ResourceCardsGrid;
