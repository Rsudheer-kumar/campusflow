"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ResourceCardsGrid({ items, className }) {
  const [activeIdx, setActiveIdx] = useState(null);
  const containerRef = useRef(null);
  const prefersReduced = useReducedMotion();

  const handlePointerOver = useCallback((idx) => {
    setActiveIdx(idx);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setActiveIdx(null);
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseLeave={handlePointerLeave}
      className={cn(
        "resource-3d-grid relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
        activeIdx !== null && "has-active",
        className
      )}
      style={{
        perspective: "1200px",
        perspectiveOrigin: "50% 40%",
      }}
    >
      {items.map((item, idx) => {
        const isActive = activeIdx === idx;
        const isMuted = activeIdx !== null && !isActive;

        return (
          <motion.div
            key={item.title || idx}
            initial={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, y: 32, scale: 0.96, rotateX: -8 }
            }
            whileInView={
              prefersReduced
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1, rotateX: 0 }
            }
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 0.65,
              delay: idx * 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
            onMouseEnter={() => handlePointerOver(idx)}
            onFocus={() => handlePointerOver(idx)}
            onBlur={handlePointerLeave}
            tabIndex={0}
            className={cn(
              "resource-card group relative flex flex-col justify-between rounded-3xl p-8 border border-border bg-surface text-foreground outline-none",
              "transition-all duration-500 ease-out",
              isActive && "is-active z-20 shadow-2xl",
              isMuted && "is-muted z-0"
            )}
            style={{
              transformStyle: "preserve-3d",
              willChange: "transform, filter, opacity",
              borderTop: `3px solid ${item.accentColor || "var(--primary)"}`,
              "--card-accent": item.accentColor || "var(--primary)",
            }}
          >
            {/* Top illumination accent glow on hover */}
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 -top-px h-1 rounded-t-3xl opacity-0 transition-opacity duration-300",
                isActive && "opacity-100"
              )}
              style={{
                background: `linear-gradient(90deg, transparent, ${item.accentColor || "var(--primary)"}, transparent)`,
                boxShadow: `0 0 20px ${item.accentColor || "var(--primary)"}`,
              }}
            />

            <div>
              {/* Icon Container with glowing backdrop */}
              <div
                className={cn(
                  "relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300",
                  item.bg || "bg-primary/10",
                  isActive ? "scale-110 shadow-lg" : "group-hover:scale-105"
                )}
                style={{
                  boxShadow: isActive
                    ? `0 8px 24px ${item.accentColor ? `${item.accentColor}33` : "rgba(66, 107, 139, 0.25)"}`
                    : undefined,
                }}
              >
                {item.icon}
              </div>

              {/* Title */}
              <h3 className="mb-3 text-xl font-bold tracking-tight text-foreground transition-colors duration-200">
                {item.title}
              </h3>

              {/* Description */}
              <p className="text-sm md:text-base leading-relaxed text-muted transition-colors duration-200">
                {item.desc}
              </p>
            </div>

            {/* Subtle bottom indicator / accent line on card */}
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-border/50">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted/70 group-hover:text-primary transition-colors">
                Capability 0{idx + 1}
              </span>
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  isActive ? "scale-150" : "opacity-40"
                )}
                style={{
                  backgroundColor: item.accentColor || "var(--primary)",
                  boxShadow: isActive ? `0 0 10px ${item.accentColor || "var(--primary)"}` : undefined,
                }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default ResourceCardsGrid;

