"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function ResourceCardsGrid({
  items = [],
  meta = "02 / Ecosystem",
  title = "Unified platform for all resources",
  subtitle = "Replace fragmented systems with one intuitive, modern ecosystem designed to optimize space and equipment utilization.",
  className,
}) {
  const containerRef = useRef(null);
  const cardRefs = useRef([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Detect desktop breakpoint and reduced motion
  useEffect(() => {
    const checkMedia = () => {
      const desktop = window.innerWidth >= 1024;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setIsDesktop(desktop);
      setIsReducedMotion(reduced);
    };
    checkMedia();
    window.addEventListener("resize", checkMedia, { passive: true });
    return () => window.removeEventListener("resize", checkMedia);
  }, []);

  // 3D Orbit Scroll Physics (Recreating Notable Achievements 3D Carousel)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isDesktop || isReducedMotion) return;

    let ticking = false;

    const updateOrbit = () => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      // 1. Enter Progress: as section scrolls from bottom 95% of viewport to top (0px)
      const enterStart = vh * 0.95;
      const enterEnd = 0;
      const rawEnter = (enterStart - rect.top) / (enterStart - enterEnd);
      const enter = Math.min(Math.max(rawEnter, 0), 1);
      // Ease out quad
      const enterEased = enter * (2 - enter);

      // 2. Pin Scroll Progress: while sticky in viewport (container height - 100vh)
      const pinDistance = rect.height - vh;
      const scrolledInPin = -rect.top;
      const rawProgress = pinDistance > 0 ? scrolledInPin / pinDistance : 0;
      const progress = Math.min(Math.max(rawProgress, 0), 1);

      // 3. Elliptical 3D Orbit Parameters
      const n = items.length;
      const TAU = Math.PI * 2;
      const LAPS = 1.0; // 1 full 360-degree cycle across the scroll track
      const Rx = Math.min(vw * 0.31, 560);
      const Ry = vh * 0.32;

      let closestIdx = 0;
      let maxZ = -Infinity;

      for (let i = 0; i < n; i++) {
        const card = cardRefs.current[i];
        if (!card) continue;

        // Angle around the ellipse
        const a = -Math.PI / n + (i * TAU) / n + progress * TAU * LAPS;
        const x = Math.sin(a) * Rx;
        const z = Math.cos(a); // z: 1 = front, -1 = back
        const d = (z + 1) / 2; // d: 1 = front, 0 = back

        if (z > maxZ) {
          maxZ = z;
          closestIdx = i;
        }

        // y position: back cards are higher (negative offset), front card is lower (positive)
        // plus entrance float translation
        const y = z * Ry - vh * 0.02 + (1 - enterEased) * vh * 0.4;
        const sc = 0.6 + 0.4 * d;
        const bl = Math.pow(1 - d, 1.5) * 10;
        const op = (0.18 + 0.82 * Math.pow(d, 1.3)) * enterEased;
        const zIndex = Math.round(d * 100);
        const isFrontInteractive = d > 0.78 && enterEased > 0.8;

        card.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
        card.style.opacity = op.toFixed(3);
        card.style.filter = bl < 0.3 ? "none" : `blur(${bl.toFixed(1)}px)`;
        card.style.zIndex = zIndex;
        card.style.pointerEvents = isFrontInteractive ? "auto" : "none";
      }

      setActiveCardIndex(closestIdx);
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateOrbit();
          ticking = false;
        });
        ticking = true;
      }
    };

    updateOrbit();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateOrbit, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateOrbit);
    };
  }, [items, isDesktop, isReducedMotion]);

  // Click dot to jump/scroll to that card in orbit
  const scrollToCard = useCallback(
    (index) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight;
      const pinDistance = rect.height - vh;
      const n = items.length;
      if (pinDistance <= 0 || n <= 0) return;

      // Target progress where card index reaches front (a = 0)
      const targetProgress = (n - index) / n;
      const targetScrollTop = window.scrollY + rect.top + targetProgress * pinDistance;

      window.scrollTo({
        top: targetScrollTop,
        behavior: "smooth",
      });
    },
    [items]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full",
        isDesktop && !isReducedMotion ? "h-[320vh]" : "py-20",
        className
      )}
    >
      {/* DESKTOP 3D ORBIT VIEW */}
      {isDesktop && !isReducedMotion ? (
        <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col items-center justify-center select-none">
          {/* Atmospheric Radial Gradient Background */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,var(--surface-2)_0%,transparent_75%)] opacity-60" />

          {/* Center Heading (Z-Index: 50 so back cards pass behind, front cards pass in front) */}
          <div className="relative z-50 text-center max-w-2xl px-6 pointer-events-none pb-[22vh]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full surface border border-border mb-4 pointer-events-auto shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold tracking-wider uppercase text-foreground/80">
                {meta}
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-4 drop-shadow-sm leading-[1.1]">
              {title}
            </h2>

            <p className="text-base md:text-lg text-muted max-w-xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Cards 3D Orbit Stage */}
          <div className="absolute inset-0 pointer-events-none">
            {items.map((item, idx) => {
              const isCurrent = activeCardIndex === idx;

              return (
                <div
                  key={item.title || idx}
                  ref={(el) => (cardRefs.current[idx] = el)}
                  className={cn(
                    "achievement-orbit-card group absolute left-1/2 top-[48%] flex flex-col justify-between rounded-3xl p-7 md:p-8",
                    "w-[330px] sm:w-[370px] md:w-[410px] min-h-[300px]",
                    "border border-border bg-surface text-foreground shadow-2xl transition-shadow duration-300",
                    "outline-none cursor-pointer"
                  )}
                  style={{
                    willChange: "transform, opacity, filter",
                    borderTop: `4px solid ${item.accentColor || "var(--primary)"}`,
                  }}
                >
                  {/* Top Bar: Badge & Icon */}
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-xs font-mono font-bold tracking-widest text-muted group-hover:text-foreground transition-colors">
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
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-foreground mb-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>

                    {/* Subtitle / Category Tag */}
                    <p
                      className="text-xs font-semibold uppercase tracking-wider mb-3"
                      style={{ color: item.accentColor || "var(--primary)" }}
                    >
                      {item.tag || "Core Capability"}
                    </p>

                    {/* Description */}
                    <p className="text-sm leading-relaxed text-muted">
                      {item.desc}
                    </p>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="pt-6 mt-4 border-t border-border/50 flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider uppercase text-muted group-hover:text-primary transition-colors flex items-center gap-1.5">
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

          {/* Bottom Pagination / Orbit Indicator Pill */}
          <div className="absolute bottom-8 z-50 flex items-center gap-2 px-4 py-2 rounded-full surface border border-border shadow-lg">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToCard(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  activeCardIndex === i
                    ? "w-7 bg-primary"
                    : "w-2 bg-muted/40 hover:bg-muted"
                )}
                aria-label={`Scroll to resource card ${i + 1}`}
              />
            ))}
          </div>
        </div>
      ) : (
        /* MOBILE / TABLET / REDUCED MOTION RESPONSIVE GRID */
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full surface border border-border mb-4 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold tracking-wider uppercase text-foreground/80">
                {meta}
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              {title}
            </h2>
            <p className="text-base text-muted leading-relaxed">{subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, idx) => (
              <div
                key={item.title || idx}
                className="flex flex-col justify-between rounded-3xl p-7 border border-border bg-surface text-foreground shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                style={{
                  borderTop: `4px solid ${item.accentColor || "var(--primary)"}`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold tracking-widest text-muted">
                      0{idx + 1}
                    </span>
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${item.accentColor || "var(--primary)"}18`,
                        color: item.accentColor || "var(--primary)",
                      }}
                    >
                      {item.icon}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground mb-1.5">
                    {item.title}
                  </h3>
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2.5"
                    style={{ color: item.accentColor || "var(--primary)" }}
                  >
                    {item.tag || "Core Capability"}
                  </p>
                  <p className="text-sm leading-relaxed text-muted">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-5 mt-5 border-t border-border/50 flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider uppercase text-primary flex items-center gap-1.5">
                    {item.linkText || "View Capability"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.accentColor || "var(--primary)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ResourceCardsGrid;
