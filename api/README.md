# CampusFlow API — Backend Architecture & Foundation

Welcome to the backend API service for **CampusFlow** (Unified Campus Resource, Laboratory, and Facility Booking Platform).

This backend is built with **Node.js**, **Express**, native **JavaScript (ES Modules)**, **MongoDB (Mongoose)**, and **Redis**.

---

## 📁 Architecture Overview

```
api/
├── src/
│   ├── config/
│   │   ├── env.js          # Environment validation and central configuration
│   │   ├── database.js     # MongoDB connection lifecycle management (Mongoose)
│   │   └── redis.js        # Redis client connection and lifecycle management
│   ├── controllers/
│   │   └── health.controller.js # Health check controller
│   ├── middleware/
│   │   ├── errorHandler.js # Centralized operational & system error handling
│   │   ├── notFoundHandler.js # JSON 404 response handler
│   │   ├── requestLogger.js # Structured HTTP request logging
│   │   └── validate.js     # Request validation foundation (body, query, params)
│   ├── models/
│   │   └── index.js        # Foundation for Mongoose domain models
│   ├── routes/
│   │   ├── health.routes.js # Health endpoint routing
│   │   └── index.js        # Central API router (/api prefix)
│   ├── services/
│   │   └── health.service.js # System diagnostic and dependency status logic
│   ├── utils/
│   │   ├── errors.js       # Custom AppError classes (BadRequest, NotFound, etc.)
│   │   ├── logger.js       # Structured, secret-sanitizing console logger
│   │   └── response.js     # Standardized JSON success & error response helpers
│   ├── validators/
│   │   └── index.js        # Common validators (MongoDB ID, pagination schemas)
│   ├── app.js              # Express application setup & middleware stack
│   └── server.js           # Server bootstrap, external connections, graceful shutdown
│
├── tests/
│   └── health.test.js      # Integration tests using Node.js native test runner & fetch
├── .env.example            # Environment template with sensible defaults
├── package.json
├── eslint.config.mjs
└── README.md
```

---

## 🚀 Quick Start

### 1. Installation

From the `api/` directory:

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Default configuration variables:

| Variable | Default Value | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `PORT` | `5000` | Port for the Express HTTP server |
| `MONGODB_URI` | `mongodb://localhost:27017/campusflow` | MongoDB connection string |
| `MONGODB_AUTO_START` | `true` on local Windows development | Automatically start the configured local MongoDB instance when stopped |
| `MONGOD_PATH` | `C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe` | Local Windows MongoDB executable path |
| `MONGODB_CONFIG_PATH` | `C:\path\to\campus-booking-platform\mongod-rs0.conf` | Local Windows MongoDB configuration path |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin for CORS |

### 3. Running the Server

#### Development Mode (with hot-reload):
```bash
npm run dev
```

#### Production Run:
```bash
npm start
```
*(Native JavaScript ES modules — no transpilation or build step required; `npm run build` confirms no build needed)*

---

## 🔍 Health & Diagnostic Endpoint

### `GET /api/health`

Returns server status and truthful verification of external dependency connections.

#### Example Response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-09-26T17:46:00.668Z",
    "uptime": 12,
    "environment": "development",
    "services": {
      "database": "disconnected",
      "redis": "disconnected"
    }
  }
}
```

---

## 🧪 Testing & Validation

Run the test suite (uses Node.js native test runner):

```bash
npm test
```

Run code quality and linting check (ESLint):

```bash
npm run lint
```

Build check (confirms no build step needed):

```bash
npm run build
```

---

## 🛡️ Response Standards

### Standard Success Format:
```json
{
  "success": true,
  "data": {}
}
```

### Standard Error Format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```
