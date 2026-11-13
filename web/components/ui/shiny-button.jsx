"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const animationProps = {
  initial: { "--x": "100%", scale: 1 },
  animate: { "--x": "-100%", scale: 1 },
  whileTap: { scale: 0.97 },
  transition: {
    repeat: Infinity,
    repeatType: "loop",
    repeatDelay: 1.2,
    type: "spring",
    stiffness: 20,
    damping: 15,
    mass: 2,
    scale: {
      type: "spring",
      stiffness: 200,
      damping: 5,
      mass: 0.5,
    },
  },
};

export const ShinyButton = React.forwardRef(
  ({ children, className, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center cursor-pointer rounded-xl border border-primary/40 bg-surface-2/80 px-8 py-3.5 font-medium text-foreground backdrop-blur-xl transition-all duration-300 ease-in-out hover:shadow-[0_0_25px_rgba(66,107,139,0.25)] active:scale-95",
          className
        )}
        {...animationProps}
        {...props}
      >
        <span
          className="relative z-10 flex items-center justify-center gap-2 text-base font-semibold tracking-wide"
          style={{
            WebkitMaskImage:
              "linear-gradient(-75deg, #000 calc(var(--x) + 20%), rgba(0,0,0,0.45) calc(var(--x) + 30%), #000 calc(var(--x) + 100%))",
            maskImage:
              "linear-gradient(-75deg, #000 calc(var(--x) + 20%), rgba(0,0,0,0.45) calc(var(--x) + 30%), #000 calc(var(--x) + 100%))",
          }}
        >
          {children}
        </span>
        <span
          style={{
            mask: "linear-gradient(#000, #000) content-box exclude, linear-gradient(#000, #000)",
            WebkitMask:
              "linear-gradient(#000, #000) content-box exclude, linear-gradient(#000, #000)",
            backgroundImage:
              "linear-gradient(-75deg, rgba(66,107,139,0.2) calc(var(--x) + 20%), var(--primary) calc(var(--x) + 25%), rgba(66,107,139,0.2) calc(var(--x) + 100%))",
          }}
          className="pointer-events-none absolute inset-0 z-20 block rounded-[inherit] p-px"
        />
      </motion.button>
    );
  }
);

ShinyButton.displayName = "ShinyButton";
export default ShinyButton;

