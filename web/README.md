# CampusFlow Web — Frontend Application

Welcome to the frontend application for **CampusFlow** (Unified Campus Resource, Laboratory, and Facility Booking Platform).

This frontend is built with **React 19**, **Next.js 16 (App Router)**, **JavaScript / JSX**, **Tailwind CSS v4**, and **Three.js / React Three Fiber**.

---

## 📁 Architecture Overview

- **Language & Framework:** Native JavaScript-first architecture with React JSX (`.jsx`) for components, pages, and layouts, and JavaScript (`.js`) for client libraries and utilities.
- **Path Aliases:** Configured via [`jsconfig.json`](./jsconfig.json) where `@/*` maps directly to `./*`.
- **Pages & Routing:** Next.js App Router under `app/`:
  - `app/layout.jsx` — Root layout shell
  - `app/page.jsx` — Landing page with interactive 3D campus visualization
  - `app/signin/page.jsx` — Institutional authentication
  - `app/dashboard/` — Authenticated dashboard pages (Calendar, Bookings, Approvals, Resources)
- **Component Architecture:** Modular UI primitives in `components/ui/`, layout wrappers in `components/layout/`, domain modals in `components/calendar/` and `components/bookings/`, and 3D procedural scenes in `components/3d/`.

---

## 🚀 Getting Started

### 1. Installation

From the `web/` directory:

```bash
npm install
```

### 2. Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the application by modifying `app/page.jsx`. The page auto-updates as you edit the file.

---

## 🧪 Validation & Production Build

### Linting (ESLint):
```bash
npm run lint
```

### Production Build (Turbopack):
```bash
npm run build
```

### Production Run:
```bash
npm start
```

---

## 🎨 Design & Assets

- **Styling:** Tailwind CSS v4 configured via [`globals.css`](./app/globals.css) and PostCSS ([`postcss.config.mjs`](./postcss.config.mjs)).
- **Typography:** Optimizes and loads [Geist](https://vercel.com/font) via `next/font`.
- **3D Engine:** Three.js and `@react-three/fiber` for interactive spatial facility visualization.

