"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useAnimate } from "framer-motion";
import { cn } from "@/lib/utils";

const HAS_SEGMENTER = typeof Intl !== "undefined" && "Segmenter" in Intl;

const splitIntoCharacters = (text) => {
  if (HAS_SEGMENTER) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
};

const extractTextFromChildren = (children) => {
  if (children == null) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);

  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join("");
  }

  if (React.isValidElement(children)) {
    if (children.type === "br") {
      return "\n";
    }
    const props = children.props || {};
    const childText = props.children;
    if (childText != null) {
      return extractTextFromChildren(childText);
    }
  }

  return "";
};

const ROTATION_MAP = {
  top: "rotateX(90deg)",
  right: "rotateY(90deg)",
  bottom: "rotateX(-90deg)",
  left: "rotateY(-90deg)",
};

const DEFAULT_TRANSITION = {
  type: "spring",
  damping: 25,
  stiffness: 160,
};

const SECOND_FACE_TRANSFORMS = {
  top: "rotateX(-90deg) translateZ(0.5lh)",
  right:
    "rotateY(90deg) translateX(50%) rotateY(-90deg) translateX(-50%) rotateY(-90deg) translateX(50%)",
  bottom: "rotateX(90deg) translateZ(0.5lh)",
  left: "rotateY(90deg) translateX(50%) rotateY(-90deg) translateX(50%) rotateY(-90deg) translateX(50%)",
};

const FRONT_FACE_TRANSFORMS = {
  top: "translateZ(0.5lh)",
  bottom: "translateZ(0.5lh)",
  left: "rotateY(90deg) translateX(50%) rotateY(-90deg)",
  right: "rotateY(-90deg) translateX(50%) rotateY(90deg)",
};

const CONTAINER_TRANSFORMS = {
  top: "translateZ(-0.5lh)",
  bottom: "translateZ(-0.5lh)",
  left: "rotateY(90deg) translateX(50%) rotateY(-90deg)",
  right: "rotateY(90deg) translateX(50%) rotateY(-90deg)",
};

const CharBox = memo(function CharBox({
  char,
  textClassName,
  flipTextClassName,
  rotateDirection,
}) {
  return (
    <span
      className="text-3d-flip-char inline-block transform-3d select-none"
      style={{
        transform: CONTAINER_TRANSFORMS[rotateDirection],
      }}
    >
      <span
        className={cn("relative inline-block h-[1lh] backface-hidden", textClassName)}
        style={{
          transform: FRONT_FACE_TRANSFORMS[rotateDirection],
        }}
      >
        {char}
      </span>
      <span
        className={cn(
          "absolute top-0 left-0 inline-block h-[1lh] backface-hidden pointer-events-none",
          flipTextClassName
        )}
        style={{
          transform: SECOND_FACE_TRANSFORMS[rotateDirection],
        }}
        aria-hidden="true"
      >
        {char}
      </span>
    </span>
  );
});

CharBox.displayName = "CharBox";

export default function Text3DFlip({
  children,
  as: ElementTag = "p",
  className,
  textClassName,
  flipTextClassName,
  staggerDuration = 0.03,
  staggerFrom = "first",
  transition = DEFAULT_TRANSITION,
  rotateDirection = "top",
  ...props
}) {
  const isAnimatingRef = useRef(false);
  const isMountedRef = useRef(false);
  const [scope, animate] = useAnimate();

  const rotationTransform = ROTATION_MAP[rotateDirection] || ROTATION_MAP.top;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isAnimatingRef.current = false;
    };
  }, []);

  const text = useMemo(() => {
    try {
      return extractTextFromChildren(children);
    } catch {
      return "";
    }
  }, [children]);

  const lines = useMemo(() => {
    const rawLines = text.split("\n");
    return rawLines.map((line) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      return words.map((word, i) => ({
        characters: splitIntoCharacters(word),
        needsSpace: i !== words.length - 1,
      }));
    });
  }, [text]);

  const totalChars = useMemo(() => {
    return lines.reduce(
      (sum, words) =>
        sum + words.reduce((wSum, w) => wSum + w.characters.length, 0),
      0
    );
  }, [lines]);

  const getStaggerDelay = useCallback(
    (index) => {
      if (staggerFrom === "first") return index * staggerDuration;
      if (staggerFrom === "last")
        return (totalChars - 1 - index) * staggerDuration;
      if (staggerFrom === "center") {
        const center = Math.floor(totalChars / 2);
        return Math.abs(center - index) * staggerDuration;
      }
      if (staggerFrom === "random") {
        const randomIndex = Math.floor(Math.random() * totalChars);
        return Math.abs(randomIndex - index) * staggerDuration;
      }
      if (typeof staggerFrom === "number") {
        return Math.abs(staggerFrom - index) * staggerDuration;
      }
      return index * staggerDuration;
    },
    [staggerFrom, staggerDuration, totalChars]
  );

  const handleHoverStart = useCallback(async () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    try {
      const delays = Array.from({ length: totalChars }, (_, i) =>
        getStaggerDelay(i)
      );

      await animate(
        ".text-3d-flip-char",
        { transform: rotationTransform },
        {
          ...transition,
          delay: (i) => delays[i],
        }
      );

      if (!isMountedRef.current) return;

      await animate(
        ".text-3d-flip-char",
        { transform: "rotateX(0deg) rotateY(0deg)" },
        { duration: 0 }
      );
    } catch {
      // ignore cancelled animation
    } finally {
      if (isMountedRef.current) {
        isAnimatingRef.current = false;
      }
    }
  }, [totalChars, transition, getStaggerDelay, rotationTransform, animate]);

  let charCounter = 0;

  return (
    <ElementTag
      className={cn("relative flex flex-wrap cursor-pointer", className)}
      style={{ perspective: "1000px", ...props.style }}
      onMouseEnter={handleHoverStart}
      ref={scope}
      {...props}
    >
      <span className="sr-only">{text}</span>

      {lines.map((words, lineIndex) => (
        <React.Fragment key={lineIndex}>
          <span className="inline-flex flex-wrap items-baseline">
            {words.map((wordObj, wordIndex) => (
              <span key={wordIndex} className="inline-flex items-baseline">
                {wordObj.characters.map((char) => {
                  const currentIndex = charCounter++;
                  return (
                    <CharBox
                      key={currentIndex}
                      char={char}
                      textClassName={textClassName}
                      flipTextClassName={flipTextClassName}
                      rotateDirection={rotateDirection}
                    />
                  );
                })}
                {wordObj.needsSpace && (
                  <span className="whitespace-pre"> </span>
                )}
              </span>
            ))}
          </span>
          {lineIndex < lines.length - 1 && (
            <span className="basis-full h-0 hidden md:block" />
          )}
        </React.Fragment>
      ))}
    </ElementTag>
  );
}

Text3DFlip.displayName = "Text3DFlip";
export { Text3DFlip };
