# CampusFlow — Unified Campus Resource & Facility Booking Platform

CampusFlow is an academic resource, laboratory, and facility management platform designed for universities and higher-education institutions. It provides real-time availability tracking, academic timetable conflict avoidance, multi-step role-based approvals, QR-based check-in with autonomous abandoned reservation release, and an interactive 3D digital twin campus visualization.

---

## 🛠️ Technology Stack

CampusFlow is built with a **strictly JavaScript-first architecture** (`.js`, `.jsx`, `.mjs`) with zero TypeScript compilation dependencies:

- **Frontend:**
  - Next.js 16 (App Router)
  - React 19 (JSX)
  - Tailwind CSS v4
  - Three.js & React Three Fiber (3D campus visualization)
  - Lucide React (Icons)
- **Backend:**
  - Node.js (native ES Modules)
  - Express 5
  - MongoDB & Mongoose 9 (replica set `rs0` for multi-document ACID transactions)
  - Redis 6 (optional; operates in documented degraded in-memory mode when offline)
- **Quality & Verification:**
  - ESLint 9/10
  - Native Node.js Test Runner
  - Zero-dependency JavaScript Architecture Validator (`scripts/check-javascript.js`)

---

## 📁 Repository Structure

```text
campus-booking-platform/
├── api/                     # Backend Express API service
│   ├── src/
│   │   ├── config/          # Environment, database, and Redis lifecycle
│   │   ├── controllers/     # Route handlers (auth, bookings, resources, approvals)
│   │   ├── middleware/      # Auth (JWT/RBAC), error handling, request logging
│   │   ├── models/          # Mongoose schemas (User, Resource, Reservation, etc.)
│   │   ├── routes/          # Express route definitions under /api prefix
│   │   ├── schedulers/      # Autonomous background auto-release worker
│   │   ├── services/        # Business logic (availability, quota, booking lifecycle)
│   │   └── utils/           # Response formatters, logger, password hashing
│   ├── tests/               # Backend integration and unit test suites
│   ├── .env.example         # Backend environment template
│   └── package.json
│
├── web/                     # Frontend Next.js web application
│   ├── app/                 # Next.js App Router (pages and layouts)
│   │   ├── dashboard/       # Authenticated pages (Calendar, Bookings, Approvals, Resources)
│   │   ├── signin/          # Institutional authentication page
│   │   └── page.jsx         # Landing page with interactive 3D campus canvas
│   ├── components/          # Reusable UI primitives, modals, calendar grid, 3D scenes
│   ├── lib/                 # Shared API client, authentication context, utilities
│   ├── .env.example         # Frontend environment template
│   └── package.json
│
├── scripts/                 # Monorepo tooling and quality-gate scripts
│   ├── check-javascript.js  # JavaScript-first architecture validator
│   └── check-ports.js       # Preflight port check and MongoDB auto-start helper
│
├── .github/workflows/       # Continuous Integration workflows
│   └── ci.yml               # Automated verification (Node.js 22 quality gates)
│
├── .env.example             # Root environment configuration template
├── mongod-rs0.conf.example  # MongoDB local replica set configuration template
├── package.json             # Root monorepo orchestration & verification scripts
└── README.md                # Main repository documentation (this file)
```

---

## 📋 Prerequisites

Before setting up CampusFlow locally, ensure your environment meets the following requirements:

1. **Node.js:** v20.x or v22.x LTS (Node.js 22 is used in CI; Node.js v26 is also supported).
2. **npm:** v10+ (lockfiles are generated with npm).
3. **MongoDB:** v7.0+ or v8.0+ configured as a **single-node replica set named `rs0`**. Multi-document transactions are required for conflict-free concurrent reservations.
4. **Redis:** (Optional) v6+ or v7+. If Redis is unavailable, CampusFlow automatically operates in documented degraded mode without crashing.

---

## 🚀 Getting Started

### 1. Fresh Checkout Installation

From the repository root, install dependencies across all workspace tiers:

```bash
# Install root orchestration devDependencies (concurrently)
npm install

# Install backend API dependencies
npm --prefix api install

# Install frontend web dependencies
npm --prefix web install
```

*(For reproducible CI installs, use `npm ci`, `npm --prefix api ci`, and `npm --prefix web ci`).*

---

### 2. Environment Configuration

CampusFlow uses separate environment templates for backend and frontend tiers:

#### A. Root & Backend Configuration:
```bash
# Copy root environment template
cp .env.example .env

# Copy API environment template
cp api/.env.example api/.env
```

Review `api/.env`:
- `MONGODB_URI`: Must target your local replica set, e.g. `mongodb://127.0.0.1:27018/campusflow?replicaSet=rs0&directConnection=true`.
- `PORT`: Defaults to `5000`.
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: Set strong, unique secrets (minimum 32 characters in production).

#### B. Frontend Configuration:
```bash
# Copy frontend environment template
cp web/.env.example web/.env.local
```
- `NEXT_PUBLIC_API_URL`: Set to `/api` so Next.js development rewrites forward API calls to the backend on port 5000.

#### C. Local MongoDB Replica Set Configuration:
```bash
cp mongod-rs0.conf.example mongod-rs0.conf
```
Edit `mongod-rs0.conf` with your local data directory path. *(Note: `mongod-rs0.conf` is ignored by git to protect machine-specific paths).*

---

### 3. Database Seeding (Demo Accounts)

To populate the database with initial campus facilities, availability rules, and test accounts:

```bash
npm --prefix api run seed
```

This creates standard institutional demo accounts:
- **Student:** `student@campusflow.edu`
- **Faculty / Dept Head:** `faculty@campusflow.edu`
- **Administrator / Facility Manager:** `admin@campusflow.edu`

*(In production, set `SEED_DEFAULT_PASSWORD` to a secure passphrase before seeding).*

---

### 4. Running the Development Server

Start both the Express API and Next.js frontend concurrently from the repository root:

```bash
npm run dev
```

This executes:
1. `predev` — Port check on `3000` and `5000` and MongoDB readiness check.
2. `dev:api` — Starts Express on [http://localhost:5000](http://localhost:5000) with `--watch` mode.
3. `dev:web` — Starts Next.js on [http://localhost:3000](http://localhost:3000).

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Verification & Quality Gates

CampusFlow enforces strict automated quality gates prior to integration or deployment:

| Gate | Command | Description |
| :--- | :--- | :--- |
| **Architecture** | `npm run check:javascript` | Verifies zero TypeScript source files (`.ts`, `.tsx`) or `tsconfig` artifacts. |
| **Linting** | `npm run lint` | Runs ESLint across both `api` and `web` codebases. |
| **Production Build** | `npm run --prefix web build` | Compiles Next.js frontend with Turbopack for production. |
| **Unified Verification** | `npm run verify` | Sequentially runs architecture check, workspace lint, and frontend build. |

---

## ⚠️ Testing & Database Isolation Notes

- **Backend Integration Tests:** `npm run --prefix api test` executes integration tests using the native Node.js test runner (`node:test`).
- **Safety Restriction:** Do not run backend integration tests against the live development database on port 27017. The test suite strictly requires `MONGODB_TEST_URI` targeting a dedicated test database (`campusflow_test` on port 27018 with replica set `rs0`).
- If an isolated replica set is not running, backend integration tests should be held unrun to prevent test record contamination.

---

## 🔒 Security & Contribution Guidelines

1. **Strictly JavaScript-First:** Do not submit pull requests containing `.ts`, `.tsx`, `.mts`, `.cts`, or `tsconfig.json` files.
2. **Zero Credentials in Git:** Never commit `.env`, `.env.local`, credentials, private keys, or `mongod-rs0.conf`.
3. **RBAC Boundaries:** All administrative, departmental, and facility manager operations are enforced server-side. Frontend hiding is never treated as a replacement for API authorization.
4. **Production Authentication:** In production (`NODE_ENV=production`), fallback development credentials and auto-login helpers are automatically disabled.

---

## 📄 License

Proprietary & Confidential — Academic Institution & CampusFlow Development Team.
