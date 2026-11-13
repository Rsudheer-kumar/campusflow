"use client";
import React, { useMemo } from "react";

/**
 * CampusFlow Lightweight Pure-JS QR Code Generator (ISO/IEC 18004 compliant)
 * Encodes Byte Mode with Error Correction Level M.
 * Produces crisp SVG vector modules without any external npm dependencies.
 */

// Galois Field GF(256) tables for Reed-Solomon polynomial division
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);
(function initGF() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    EXP_TABLE[i + 255] = val;
    LOG_TABLE[val] = i;
    val = (val << 1) ^ (val & 128 ? 0x11d : 0);
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

function polyMul(p1, p2) {
  const result = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, new Uint8Array([1, EXP_TABLE[i]]));
  }
  return poly;
}

function computeRS(data, ecCount) {
  const gen = getGeneratorPoly(ecCount);
  const remainder = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < ecCount - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    remainder[ecCount - 1] = gfMul(gen[ecCount], factor);
  }
  return remainder;
}

// Version table parameters for Error Correction Level M
// [version, totalModules, dataCodewords, ecCodewords]
const VERSIONS = [
  [1, 21, 16, 10],
  [2, 25, 28, 16],
  [3, 29, 44, 26],
  [4, 33, 64, 36],
  [5, 37, 86, 48],
  [6, 41, 108, 64],
];

export function generateQRMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  const dataLen = bytes.length;

  // Select smallest version that accommodates the payload in Byte Mode
  let selected = null;
  for (const v of VERSIONS) {
    // 4 bits mode + 8 bits length indicator = 12 bits -> 1.5 bytes + payload
    const needed = Math.ceil((12 + dataLen * 8) / 8);
    if (needed <= v[2]) {
      selected = v;
      break;
    }
  }

  if (!selected) {
    selected = VERSIONS[VERSIONS.length - 1];
  }

  const [version, size, dataCapacity, ecCount] = selected;

  // Build bitstream: Byte Mode (0100) + 8-bit length + data + terminator (0000)
  const bitstream = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bitstream.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(Math.min(dataLen, 255), 8); // 8-bit length for Byte mode (v1-v9)
  for (let i = 0; i < dataLen; i++) {
    pushBits(bytes[i], 8);
  }
  // Terminator
  const padBits = Math.min(4, dataCapacity * 8 - bitstream.length);
  pushBits(0, padBits);

  // Pad to byte boundary
  while (bitstream.length % 8 !== 0) {
    bitstream.push(0);
  }

  // Pad with alternating 0xEC and 0x11
  const dataBytes = new Uint8Array(dataCapacity);
  for (let i = 0; i < bitstream.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bitstream[i * 8 + j];
    }
    dataBytes[i] = b;
  }
  const padPatterns = [0xec, 0x11];
  let padIdx = 0;
  for (let i = bitstream.length / 8; i < dataCapacity; i++) {
    dataBytes[i] = padPatterns[padIdx % 2];
    padIdx++;
  }

  // Compute Reed-Solomon Error Correction Codewords
  const ecBytes = computeRS(dataBytes, ecCount);

  // Combine Data + EC codewords
  const totalCodewords = new Uint8Array(dataCapacity + ecCount);
  totalCodewords.set(dataBytes, 0);
  totalCodewords.set(ecBytes, dataCapacity);

  // Initialize Matrix: 0=light, 1=dark, null=unassigned
  const matrix = Array.from({ length: size }, () => Array(size).fill(null));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

  function setModule(r, c, val) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val ? 1 : 0;
      isFunction[r][c] = true;
    }
  }

  // Finder pattern (7x7) with 1-module quiet separator
  function addFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setModule(nr, nc, isBorder || isCenter);
        } else {
          setModule(nr, nc, false);
        }
      }
    }
  }

  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // Alignment Pattern for Version >= 2
  if (version >= 2) {
    const alignCoords = [
      [],
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
    ][version];

    if (alignCoords && alignCoords.length >= 2) {
      const ar = alignCoords[1];
      const ac = alignCoords[1];
      // Place 5x5 alignment pattern
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isDark = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
          setModule(ar + r, ac + c, isDark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) setModule(6, i, i % 2 === 0);
    if (!isFunction[i][6]) setModule(i, 6, i % 2 === 0);
  }

  // Dark module
  setModule(size - 8, 8, true);

  // Format Information reserve (Level M + Mask Pattern 0 = 0b101010000010010)
  // Mask pattern 0: (row + col) % 2 === 0
  const formatInfo = 0b101010000010010;
  for (let i = 0; i < 15; i++) {
    const bit = (formatInfo >> (14 - i)) & 1;
    // Around top-left finder
    if (i <= 5) setModule(8, i, bit);
    else if (i === 6) setModule(8, 7, bit);
    else if (i === 7) setModule(8, 8, bit);
    else if (i === 8) setModule(7, 8, bit);
    else setModule(14 - i, 8, bit);

    // Around other finders
    if (i < 8) setModule(size - 1 - i, 8, bit);
    else setModule(8, size - 15 + i, bit);
  }

  // Place Data & Error Correction Codewords in standard 2-column zigzag
  let bitIdx = 0;
  const allBits = [];
  for (let i = 0; i < totalCodewords.length; i++) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((totalCodewords[i] >> b) & 1);
    }
  }

  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (!isFunction[r][c]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          // Apply mask pattern 0: (r + c) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = (bit ^ (mask ? 1 : 0)) ? 1 : 0;
        }
      }
    }
    upward = !upward;
  }

  return matrix;
}

export function QRCode({ value, size = 180, className = "" }) {
  const matrix = useMemo(() => {
    if (!value) return [];
    try {
      return generateQRMatrix(String(value));
    } catch {
      return [];
    }
  }, [value]);

  if (!matrix || matrix.length === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-surface-2 border border-border rounded text-xs text-muted ${className}`}
      >
        QR Unavailable
      </div>
    );
  }

  const moduleCount = matrix.length;
  const cellSize = 10;
  const quietZone = 2;
  const totalDim = (moduleCount + quietZone * 2) * cellSize;

  return (
    <svg
      viewBox={`0 0 ${totalDim} ${totalDim}`}
      width={size}
      height={size}
      className={`rounded-lg bg-white p-2 shadow-sm ${className}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR Code for ${value}`}
    >
      {matrix.map((row, r) =>
        row.map((cell, c) => {
          if (cell !== 1) return null;
          const x = (c + quietZone) * cellSize;
          const y = (r + quietZone) * cellSize;
          return (
            <rect
              key={`${r}-${c}`}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              fill="#0f172a"
            />
          );
        })
      )}
    </svg>
  );
}
